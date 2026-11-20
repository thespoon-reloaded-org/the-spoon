# syntax=docker/dockerfile:1.7
#
# Deux images à partir du même fichier :
#   - `runner`   : l'application (Next.js en mode standalone) pour Cloud Run ;
#   - `migrator` : `prisma migrate deploy`, lancé comme job Cloud Run avant
#                  chaque déploiement (la base n'a qu'une IP privée : seul le
#                  réseau du projet GCP peut l'atteindre).
#
#   docker build --target runner   -t thespoon .
#   docker build --target migrator -t thespoon-migrator .
#   docker build --target outils   -t thespoon-outils .

ARG NODE_VERSION=24.14.1

FROM node:${NODE_VERSION}-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

# --- Dépendances (cache tant que le lockfile ne change pas) -----------------
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# --- Build ------------------------------------------------------------------
FROM deps AS build
COPY . .
# Le build ne touche pas la base, mais src/lib/env.ts valide l'environnement
# au chargement des modules : des valeurs factices suffisent ici. Les vraies
# sont posées sur le service Cloud Run.
RUN DATABASE_URL="postgresql://build@localhost:5432/build" \
    BETTER_AUTH_SECRET="build-only-not-a-secret" \
    BETTER_AUTH_URL="http://localhost:3100" \
    pnpm run build

# --- Outils -----------------------------------------------------------------
# Code source et dépendances complètes, pour lancer les scripts du dépôt
# (`pnpm seed:dev`...) contre la base d'un environnement, depuis un job Cloud
# Run du réseau privé — voir .github/workflows/donnees.yml.
FROM build AS outils
CMD ["pnpm", "run", "seed:dev"]

# --- Migrations -------------------------------------------------------------
# Image à part, réduite au CLI Prisma (même version que package.json) et aux
# migrations : ni le code de l'app, ni ses dépendances de dev.
FROM base AS migrator
ENV NODE_ENV=production
RUN npm install --no-save --no-audit --no-fund prisma@7.10.0 dotenv@17.4.2
COPY prisma ./prisma
COPY prisma.config.ts ./
CMD ["npx", "prisma", "migrate", "deploy"]

# --- Application ------------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=8080 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 8080
CMD ["node", "server.js"]

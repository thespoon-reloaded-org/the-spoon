# TheSpoon

Plateforme de réservation de restaurants — concurrent de LaFourchette, note
en cuillères. Voir la page Notion « 🥄 TheSpoon » (backlog + vision) pour le
contexte produit, et `../thespoon-env/CANON.md` pour la mécanique métier
détaillée (facturation, commission, litiges) dont ce produit s'inspire.

**Approche : produit et écrans d'abord, schéma ensuite.** Le modèle de
données n'est pas conçu à l'avance en un bloc — chaque table arrive avec
l'écran qui en a besoin. `prisma/schema.prisma` ne contient aujourd'hui que
`Restaurant`/`PlatCuillere` (recherche + fiche établissement) et les tables
d'auth dîneur (`User`/`Session`/`Account`/`Verification`, générées par
better-auth).

Identité visuelle non décidée : les couleurs dans `globals.css` sont un
placeholder neutre, à ne pas confondre avec la charte Hymaïa (TheSpoon est sa
propre marque, pas une interface interne Hymaïa).

## Démarrer en local

```bash
nvm use
pnpm install
cp .env.example .env   # puis éditer DATABASE_URL, BETTER_AUTH_SECRET et BETTER_AUTH_URL
pnpm db:push            # à relancer après chaque changement de prisma/schema.prisma
pnpm seed:dev
pnpm dev                # http://localhost:3100
```

`BETTER_AUTH_SECRET` se génère avec `openssl rand -hex 32`.

## Ce qui existe

- Recherche de restaurants (`/`) et fiche établissement (`/restaurants/[id]`),
  branchées sur une vraie base PostgreSQL via Prisma.
- Auth dîneur (`/connexion`) : inscription, connexion, session, déconnexion —
  via better-auth. Restaurant partenaire et staff TheSpoon restent à faire.

## Ce qui n'existe pas encore

Tout le reste du backlog Notion : réservation, auth restaurant partenaire /
staff, espace restaurant, BO admin, facturation, litiges, avis, ticketing,
base documentaire.

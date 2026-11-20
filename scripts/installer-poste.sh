#!/usr/bin/env bash
# Prépare un Mac pour travailler sur TheSpoon, sans Docker :
#   ./scripts/installer-poste.sh
#
# Installe (via Homebrew) Node.js de .nvmrc (nvm s'il est là, sinon fnm),
# pnpm, PostgreSQL 17 et le CLI GitHub,
# démarre PostgreSQL en service de fond, crée la base locale, écrit `.env`,
# installe les dépendances, applique les migrations et remplit la base.
# Relançable sans risque : chaque étape vérifie d'abord ce qui existe déjà.
# Ne touche jamais à une base distante ni à un `.env` existant.
set -euo pipefail
cd "$(dirname "$0")/.."

ok()    { printf '  \033[32m✓\033[0m %s\n' "$1"; }
etape() { printf '\n\033[1m%s\033[0m\n' "$1"; }
stop()  { printf '\n\033[31m✗ %s\033[0m\n' "$1"; exit 1; }

BASE=thespoon_dev
PG=postgresql@17

etape "1. Système"
[ "$(uname)" = Darwin ] || stop "Ce script est prévu pour macOS. Sous Linux ou Windows (WSL), suivre « Démarrer en local » dans le README."
xcode-select -p >/dev/null 2>&1 || { xcode-select --install || true; stop "Installez les outils en ligne de commande d'Apple (fenêtre ouverte), puis relancez ce script."; }
ok "macOS $(sw_vers -productVersion), $(uname -m)"

etape "2. Homebrew"
if ! command -v brew >/dev/null; then
  for b in /opt/homebrew/bin/brew /usr/local/bin/brew; do [ -x "$b" ] && eval "$("$b" shellenv)"; done
fi
command -v brew >/dev/null || stop "Homebrew absent. L'installer (mot de passe du Mac demandé) :
  /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\"
puis relancer ce script."
ok "$(brew --version | head -1)"

etape "3. Outils"
# Node : la version de .nvmrc, seulement pour ce projet. Avec nvm déjà sur le
# poste, on s'en sert (deux gestionnaires de versions se marchent dessus) ;
# sinon fnm, qui bascule tout seul en entrant dans le dossier.
NVM_SH="${NVM_DIR:-$HOME/.nvm}/nvm.sh"
[ -s "$NVM_SH" ] || NVM_SH="$(brew --prefix)/opt/nvm/nvm.sh"
OUTILS=("$PG" gh); [ -s "$NVM_SH" ] || OUTILS=(fnm "${OUTILS[@]}")
for f in "${OUTILS[@]}"; do
  if brew list --formula "$f" >/dev/null 2>&1; then ok "$f déjà installé"
  else brew install "$f" >/dev/null && ok "$f installé"; fi
done
PREFIXE=$(brew --prefix)
PROFIL="$HOME/.zshrc"
grep -qF "# TheSpoon : psql" "$PROFIL" 2>/dev/null || \
  echo "export PATH=\"$PREFIXE/opt/$PG/bin:\$PATH\" # TheSpoon : psql, createdb" >> "$PROFIL"
export PATH="$PREFIXE/opt/$PG/bin:$PATH"
if [ -s "$NVM_SH" ]; then
  set +u; source "$NVM_SH"; nvm install >/dev/null; nvm use >/dev/null; set -u
  ok "node $(node --version) (nvm, selon .nvmrc — tapez « nvm use » dans ce dossier)"
else
  grep -qF "# TheSpoon : Node" "$PROFIL" 2>/dev/null || \
    echo 'eval "$(fnm env --use-on-cd --shell zsh)" # TheSpoon : Node selon .nvmrc' >> "$PROFIL"
  eval "$(fnm env --shell bash)"
  fnm install "$(cat .nvmrc)" >/dev/null && fnm use "$(cat .nvmrc)" >/dev/null
  ok "node $(node --version) (fnm, bascule automatique dans ce dossier)"
fi
corepack enable
COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm --version >/dev/null
ok "pnpm $(COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm --version)"

etape "4. PostgreSQL"
if lsof -nP -iTCP:5432 -sTCP:LISTEN >/dev/null 2>&1 && ! brew services list | grep -q "^$PG *started"; then
  stop "Le port 5432 est déjà pris par un autre PostgreSQL (Postgres.app, Docker ?). Arrêtez-le, puis relancez."
fi
brew services list | grep -q "^$PG *started" || brew services start "$PG" >/dev/null
for _ in $(seq 1 20); do pg_isready -q -h localhost && break; sleep 1; done
pg_isready -q -h localhost || stop "PostgreSQL ne répond pas. Voir : brew services info $PG"
ok "PostgreSQL $(postgres --version | awk '{print $3}') démarré"
if psql -h localhost -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$BASE'" | grep -q 1; then ok "base $BASE déjà là"
else createdb -h localhost "$BASE" && ok "base $BASE créée"; fi

etape "5. Configuration (.env)"
if [ -f .env ]; then ok ".env existant gardé tel quel"
else
  sed -e "s|^DATABASE_URL=.*|DATABASE_URL=\"postgresql://$(whoami)@localhost:5432/$BASE\"|" \
      -e "s|^BETTER_AUTH_SECRET=.*|BETTER_AUTH_SECRET=\"$(openssl rand -hex 32)\"|" \
      .env.example > .env
  ok ".env créé (base locale, secret généré)"
fi
grep -q "localhost" <(grep '^DATABASE_URL' .env) || stop ".env pointe vers une base qui n'est pas locale : ce script s'arrête là pour ne rien abîmer."

etape "6. Projet"
COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm install --frozen-lockfile >/dev/null && ok "dépendances installées"
pnpm -s db:deploy >/dev/null && ok "migrations appliquées"
if [ "$(psql -h localhost -d "$BASE" -tAc 'SELECT count(*) FROM "Restaurant"')" = 0 ]; then
  pnpm -s seed:dev >/dev/null && ok "base remplie (seed:dev)"
else ok "base déjà remplie, rien touché"; fi

etape "7. GitHub"
if gh auth status >/dev/null 2>&1; then ok "connecté à GitHub ($(gh api user --jq .login))"
else echo "  → lancer : gh auth login   (puis relancer ce script pour vérifier)"; fi

printf '\n\033[32mPrêt.\033[0m Lancer :  pnpm dev   puis ouvrir http://localhost:3100\n'
printf 'Comptes de démo : mot de passe password123 (voir README, « Démarrer en local »).\n'
printf 'Ouvrez un nouveau terminal pour que node et psql soient trouvés partout.\n'

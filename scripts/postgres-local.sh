#!/usr/bin/env bash
# PostgreSQL local, seulement pendant qu'on code :
#   ./scripts/postgres-local.sh start    # lance en fond (pas au démarrage du Mac)
#   ./scripts/postgres-local.sh stop     # arrête, sauf si quelqu'un s'en sert encore
#   ./scripts/postgres-local.sh status
#   ... start|stop --hook   # depuis un hook Claude Code (JSON du hook sur stdin)
#
# Appelé par Claude Code (hooks SessionStart et SessionEnd, .claude/settings.json),
# par `pnpm dev` et `pnpm test` (predev, pretest), et par installer-poste.sh.
# `brew services run` démarre le service sans l'inscrire au démarrage de la
# session macOS, à l'inverse de `brew services start`.
# Sans Homebrew ni PostgreSQL 17 (CI, Linux, poste pas encore installé) : ne
# fait rien.
set -euo pipefail
PG=postgresql@17
ACTION=${1:-status}

[ "$(uname)" = Darwin ] || exit 0
command -v brew >/dev/null 2>&1 || exit 0
brew list --formula "$PG" >/dev/null 2>&1 || exit 0
BIN="$(brew --prefix)/opt/$PG/bin"
# Une session Claude Code ouverte = un fichier ici (hooks, `--hook`). On
# n'arrête PostgreSQL qu'une fois le dossier vide. Fichiers de plus de 12 h :
# sessions mortes sans SessionEnd, ignorés.
SESSIONS_DIR="${TMPDIR:-/tmp}/thespoon-postgres-sessions"
ENTREE=""; [ "${2:-}" = --hook ] && ENTREE=$(cat)
champ() { printf '%s' "$ENTREE" | sed -n "s/.*\"$1\" *: *\"\([^\"]*\)\".*/\1/p" | head -1; }
SID=$(champ session_id)

info() { brew services info "$PG" --json | sed -n "s/.*\"$1\": *\([a-z]*\).*/\1/p" | head -1; }
pret() { "$BIN/pg_isready" -q -h localhost; }

case "$ACTION" in
  start)
    # Ancienne installation : service inscrit au démarrage du Mac. On le
    # désinscrit, il ne tournera plus que pendant les sessions.
    if [ "$(info registered)" = true ]; then brew services stop "$PG" >/dev/null 2>&1 || true; fi
    [ -z "$SID" ] || { mkdir -p "$SESSIONS_DIR"; touch "$SESSIONS_DIR/$SID"; }
    if pret; then exit 0; fi
    if lsof -nP -iTCP:5432 -sTCP:LISTEN >/dev/null 2>&1; then
      echo "PostgreSQL : le port 5432 est pris par un autre serveur (Postgres.app, Docker ?)." >&2; exit 1
    fi
    brew services run "$PG" >/dev/null
    for _ in $(seq 1 20); do pret && break; sleep 0.5; done
    pret || { echo "PostgreSQL ne répond pas : brew services info $PG" >&2; exit 1; }
    echo "PostgreSQL local démarré (arrêt à la fin de la session Claude Code, ou pnpm db:stop)."
    ;;
  stop)
    [ "$(info running)" = true ] || exit 0
    [ -z "$SID" ] || rm -f "$SESSIONS_DIR/$SID"
    # /clear ferme la session et en ouvre aussitôt une autre : pas d'arrêt.
    [ "$(champ reason)" != clear ] || exit 0
    find "$SESSIONS_DIR" -type f -mmin +720 -delete 2>/dev/null || true
    # Encore utilisé : une autre session Claude Code (clone ou worktree), ou
    # des connexions ouvertes (pnpm dev, Prisma Studio, psql…).
    SESSIONS=$(find "$SESSIONS_DIR" -type f 2>/dev/null | wc -l | tr -d ' ')
    CONNEXIONS=$("$BIN/psql" -h localhost -d postgres -tAc \
      "SELECT count(*) FROM pg_stat_activity WHERE backend_type = 'client backend' AND pid <> pg_backend_pid()" 2>/dev/null || echo 0)
    if [ "${FORCER:-}" != 1 ] && { [ "$CONNEXIONS" -gt 0 ] || [ "$SESSIONS" -gt 0 ]; }; then
      echo "PostgreSQL laissé en marche : $CONNEXIONS connexion(s), $SESSIONS autre(s) session(s) Claude Code. Forcer : FORCER=1 pnpm db:stop"
      exit 0
    fi
    brew services stop "$PG" >/dev/null && echo "PostgreSQL local arrêté."
    ;;
  status)
    if pret; then echo "PostgreSQL local : en marche"; else echo "PostgreSQL local : arrêté (pnpm db:start)"; fi
    [ "$(info registered)" = true ] && echo "  ⚠ inscrit au démarrage du Mac : pnpm db:start le désinscrit" || true
    ;;
  *) echo "usage : $0 start|stop|status" >&2; exit 2 ;;
esac

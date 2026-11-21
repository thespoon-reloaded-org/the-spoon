---
name: installer-poste
description: Prépare le poste d'un participant pour travailler sur son dépôt TheSpoon (Node.js 24 via nvm ou fnm, pnpm, PostgreSQL 17 local lancé seulement pendant les sessions, GitHub CLI, .env, migrations, données de démo), sans Docker. À utiliser quand on demande d'installer le projet, de préparer son Mac, de « faire marcher pnpm dev », quand la base locale, Node ou pnpm sont introuvables, ou quand PostgreSQL tourne en permanence ou ne démarre pas.
---

# Installer le poste

Chaque participant travaille dans son propre dépôt, `thespoon-reloaded-org/the-spoon-<prénom>` (sa CI, sa production). Si le dossier courant est un clone du dépôt commun `the-spoon` (le script le signale à l'étape 7), le faire cloner : `gh repo clone thespoon-reloaded-org/the-spoon-<prénom>`, puis ouvrir Claude Code dans ce dossier et relancer cette skill. L'ancien clone peut être supprimé une fois son éventuel travail en cours récupéré.

Le script `scripts/installer-poste.sh` fait tout, sur macOS, avec Homebrew. Il est relançable : chaque étape vérifie ce qui existe déjà. Il ne touche jamais à un `.env` existant ni à une base distante.

1. Lancer `./scripts/installer-poste.sh` depuis la racine du dépôt et lire la sortie. Chaque étape affiche ✓ ou s'arrête sur ✗ avec la raison.
2. Si une étape échoue, appliquer le correctif ci-dessous, puis relancer le script. Ne pas contourner le script en installant les outils autrement (Docker, nvm, Postgres.app) : tout le groupe doit avoir le même poste.
3. À la fin, lancer `pnpm dev` en arrière-plan, vérifier que http://localhost:3100 répond 200 et liste des restaurants, puis l'arrêter. Dire au participant d'ouvrir un nouveau terminal.

## PostgreSQL seulement pendant qu'on code

PostgreSQL n'est pas inscrit au démarrage du Mac. `scripts/postgres-local.sh` le lance en fond (`brew services run`) et l'arrête :

- les hooks de `.claude/settings.json` le démarrent à l'ouverture d'une session Claude Code et l'arrêtent à sa fermeture, sauf s'il sert encore (autre session Claude Code dans un clone ou un worktree, `pnpm dev` ou `psql` connecté) ;
- `pnpm dev` et `pnpm test` le démarrent s'il est arrêté ;
- à la main : `pnpm db:start`, `pnpm db:stop` (`FORCER=1 pnpm db:stop` pour passer outre), `pnpm db:status`.

Une installation faite avant (service lancé avec `brew services start`, donc à chaque démarrage du Mac) est corrigée par `pnpm db:start` ou par le script d'installation.

## Échecs connus

| Message | Cause | Correctif |
|---|---|---|
| « Homebrew absent » | Homebrew pas installé | Le participant lance lui-même la commande affichée : elle demande le mot de passe du Mac. Ne jamais la lancer à sa place. |
| « Installez les outils en ligne de commande d'Apple » | Xcode Command Line Tools absents | Le participant valide la fenêtre d'installation macOS (5–10 min), puis relance. |
| « Le port 5432 est déjà pris » | Un autre PostgreSQL tourne (Postgres.app, Docker, autre version Homebrew) | Identifier le processus avec `lsof -nP -iTCP:5432 -sTCP:LISTEN`. Demander au participant avant de l'arrêter : il peut s'en servir pour un autre projet. |
| « .env pointe vers une base qui n'est pas locale » | `.env` copié d'ailleurs | Montrer la ligne `DATABASE_URL` au participant. Ne jamais lancer `seed:dev` ni de migration contre une base distante. |
| `node --version` ≠ v24 dans le dépôt | Avec nvm : `nvm use` pas tapé. Avec fnm : terminal ouvert avant l'installation | nvm : `nvm use` dans le dossier. fnm : ouvrir un nouveau terminal dans le dépôt. Puis relancer. |
| Migrations ou tests : `P1001`, `ECONNREFUSED 5432` | PostgreSQL arrêté (session Claude Code fermée entre-temps) | `pnpm db:start`, puis relancer. |
| `pnpm db:stop` : « laissé en marche » | Autre session Claude Code ouverte, ou connexion (`pnpm dev`, Prisma Studio) | Fermer ce qui s'en sert, ou `FORCER=1 pnpm db:stop`. |

## Hors macOS

Sous Windows (WSL) ou Linux, le script s'arrête. Suivre « Démarrer en local » dans le README : Node 24 (via `nvm use`), pnpm via `corepack enable`, PostgreSQL 17 du gestionnaire de paquets du système.

---
name: installer-poste
description: Prépare le poste d'un participant pour travailler sur TheSpoon (Node.js 24 via nvm ou fnm, pnpm, PostgreSQL 17 local, GitHub CLI, .env, migrations, données de démo), sans Docker. À utiliser quand on demande d'installer le projet, de préparer son Mac, de « faire marcher pnpm dev », ou quand la base locale, Node ou pnpm sont introuvables.
---

# Installer le poste

Le script `scripts/installer-poste.sh` fait tout, sur macOS, avec Homebrew. Il est relançable : chaque étape vérifie ce qui existe déjà. Il ne touche jamais à un `.env` existant ni à une base distante.

1. Lancer `./scripts/installer-poste.sh` depuis la racine du dépôt et lire la sortie. Chaque étape affiche ✓ ou s'arrête sur ✗ avec la raison.
2. Si une étape échoue, appliquer le correctif ci-dessous, puis relancer le script. Ne pas contourner le script en installant les outils autrement (Docker, nvm, Postgres.app) : tout le groupe doit avoir le même poste.
3. À la fin, lancer `pnpm dev` en arrière-plan, vérifier que http://localhost:3100 répond 200 et liste des restaurants, puis l'arrêter. Dire au participant d'ouvrir un nouveau terminal.

## Échecs connus

| Message | Cause | Correctif |
|---|---|---|
| « Homebrew absent » | Homebrew pas installé | Le participant lance lui-même la commande affichée : elle demande le mot de passe du Mac. Ne jamais la lancer à sa place. |
| « Installez les outils en ligne de commande d'Apple » | Xcode Command Line Tools absents | Le participant valide la fenêtre d'installation macOS (5–10 min), puis relance. |
| « Le port 5432 est déjà pris » | Un autre PostgreSQL tourne (Postgres.app, Docker, autre version Homebrew) | Identifier le processus avec `lsof -nP -iTCP:5432 -sTCP:LISTEN`. Demander au participant avant de l'arrêter : il peut s'en servir pour un autre projet. |
| « .env pointe vers une base qui n'est pas locale » | `.env` copié d'ailleurs | Montrer la ligne `DATABASE_URL` au participant. Ne jamais lancer `seed:dev` ni de migration contre une base distante. |
| `node --version` ≠ v24 dans le dépôt | Avec nvm : `nvm use` pas tapé. Avec fnm : terminal ouvert avant l'installation | nvm : `nvm use` dans le dossier. fnm : ouvrir un nouveau terminal dans le dépôt. Puis relancer. |
| Migrations : `P1001` | PostgreSQL arrêté | `brew services restart postgresql@17`, puis relancer. |

## Hors macOS

Sous Windows (WSL) ou Linux, le script s'arrête. Suivre « Démarrer en local » dans le README : Node 24 (via `nvm use`), pnpm via `corepack enable`, PostgreSQL 17 du gestionnaire de paquets du système.

---
name: installer-poste
description: Prépare le poste d'un participant pour travailler sur TheSpoon (Node.js 24 via nvm ou fnm, pnpm, PostgreSQL 17 local, GitHub CLI, .env, migrations, données de démo), sans Docker. À utiliser quand on demande d'installer le projet, de préparer son Mac, de « faire marcher pnpm dev », ou quand la base locale, Node ou pnpm sont introuvables.
---

# Installer le poste

Le script `scripts/installer-poste.sh` fait tout, sur macOS, avec Homebrew. Il est relançable : chaque étape vérifie ce qui existe déjà. Il ne touche jamais à un `.env` existant ni à une base distante.

Lance toi-même les commandes avec ton outil Bash. Ne donne pas un script ou une commande à copier au participant, sauf quand une étape demande son mot de passe (voir l'étape 1).

1. **Homebrew d'abord.** Vérifier qu'il est là : `command -v brew || ls /opt/homebrew/bin/brew /usr/local/bin/brew`.
   - S'il est là, passer à l'étape 2.
   - S'il manque, il faut le mot de passe du Mac, que tu ne peux pas taper. Ouvrir une fenêtre Terminal qui l'installe : `open -a Terminal scripts/installer-homebrew.sh`. Dire au participant : « Une fenêtre Terminal vient de s'ouvrir. Tapez-y le mot de passe de votre Mac (rien ne s'affiche, c'est normal), puis Entrée quand il le demande. Revenez ici quand elle affiche « Homebrew prêt ». »
   - Attendre en arrière-plan que Homebrew apparaisse, jusqu'à 15 minutes : `for i in $(seq 1 90); do [ -x /opt/homebrew/bin/brew ] || [ -x /usr/local/bin/brew ] && break; sleep 10; done`. Si le participant signale une erreur dans la fenêtre, lui demander de la copier ici.
   - Si `open` échoue (pas d'interface graphique), donner la commande `./scripts/installer-homebrew.sh` à lancer dans son propre terminal, puis attendre de la même façon.
2. Lancer `./scripts/installer-poste.sh` depuis la racine du dépôt et lire la sortie. Chaque étape affiche ✓ ou s'arrête sur ✗ avec la raison.
3. Si une étape échoue, appliquer le correctif ci-dessous, puis relancer le script. Ne pas contourner le script en installant les outils autrement (Docker, nvm, Postgres.app) : tout le groupe doit avoir le même poste.
4. À la fin, lancer `pnpm dev` en arrière-plan, vérifier que http://localhost:3100 répond 200 et liste des restaurants, puis l'arrêter. Dire au participant d'ouvrir un nouveau terminal.

## Échecs connus

| Message | Cause | Correctif |
|---|---|---|
| « Homebrew absent » | Homebrew pas installé | Étape 1 : `open -a Terminal scripts/installer-homebrew.sh`, le participant tape son mot de passe dans cette fenêtre. Ne jamais lui demander son mot de passe ici. |
| Homebrew : « Need sudo access » / « not an Administrator » | Le compte du Mac n'est pas administrateur | Le participant demande les droits admin à son support informatique. Rien à contourner. |
| « Installez les outils en ligne de commande d'Apple » | Xcode Command Line Tools absents | Le participant valide la fenêtre d'installation macOS (5–10 min), puis relance. |
| « Le port 5432 est déjà pris » | Un autre PostgreSQL tourne (Postgres.app, Docker, autre version Homebrew) | Identifier le processus avec `lsof -nP -iTCP:5432 -sTCP:LISTEN`. Demander au participant avant de l'arrêter : il peut s'en servir pour un autre projet. |
| « .env pointe vers une base qui n'est pas locale » | `.env` copié d'ailleurs | Montrer la ligne `DATABASE_URL` au participant. Ne jamais lancer `seed:dev` ni de migration contre une base distante. |
| `node --version` ≠ v24 dans le dépôt | Avec nvm : `nvm use` pas tapé. Avec fnm : terminal ouvert avant l'installation | nvm : `nvm use` dans le dossier. fnm : ouvrir un nouveau terminal dans le dépôt. Puis relancer. |
| Migrations : `P1001` | PostgreSQL arrêté | `brew services restart postgresql@17`, puis relancer. |

## Hors macOS

Sous Windows (WSL) ou Linux, le script s'arrête. Suivre « Démarrer en local » dans le README : Node 24 (via `nvm use`), pnpm via `corepack enable`, PostgreSQL 17 du gestionnaire de paquets du système.

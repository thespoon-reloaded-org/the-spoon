---
name: configurer-mon-depot
description: Passe le poste d'un participant sur son dépôt personnel thespoon-reloaded-org/the-spoon-<prénom> (sa CI, sa production) : accepte l'invitation GitHub, transforme un clone du dépôt commun the-spoon (origin devient « modele », en lecture seule), aligne les branches sans perdre de commit, règle gh, puis lance installer-poste. À utiliser quand on demande de configurer son dépôt, de passer à son propre dépôt ou à « sa » version, quand un push vers the-spoon est refusé, quand gh pr ou gh run visent le mauvais dépôt, ou au début d'une session si origin pointe encore sur thespoon-reloaded-org/the-spoon.
---

# Configurer mon dépôt

Depuis la session 2, chaque participant travaille dans son propre dépôt, `thespoon-reloaded-org/the-spoon-<prénom>`, créé par le formateur à partir du modèle `the-spoon` : même historique (mêmes hashs), même CI, et une production à lui (variable de dépôt `URL_PROD`). Le participant y est admin.

Le script `scripts/configurer-mon-depot.sh` fait tout. Il est relançable et ne supprime ni n'écrase jamais un commit local.

1. Vérifier d'où part le participant : `git remote -v`.
   - Clone du dépôt commun (`.../the-spoon.git`) : le script le transforme sur place, travail en cours et worktrees compris. Si le script n'existe pas encore dans ce clone, faire d'abord `git pull --ff-only` sur main.
   - Pas encore de clone : `gh repo clone thespoon-reloaded-org/the-spoon-<prénom>`, puis ouvrir Claude Code dans ce dossier et relancer cette skill.
2. Lancer `./scripts/configurer-mon-depot.sh` depuis la racine du dépôt (ajouter le prénom en argument s'il le demande) et lire la sortie. Chaque étape affiche ✓, → (à faire par le participant) ou s'arrête sur ✗ avec la raison.
3. Si une étape échoue, appliquer le correctif ci-dessous puis relancer. L'étape 5 est `installer-poste.sh` : pour ses échecs, suivre la skill `installer-poste`.
4. Reprendre chaque ligne → pour le participant, en particulier les commits locaux pas encore poussés et les branches qui n'existent que sur son poste. Proposer la commande, ne pas pousser à sa place.
5. Finir par `git remote -v`, `gh repo set-default --view` et le lien vers sa production.

## Ce que le script ne fait pas

- Il ne pousse rien. Les commits locaux restent locaux jusqu'à ce que le participant les pousse.
- Il ne touche pas au `.env` ni à la base locale (installer-poste les garde tels quels).
- Il ne pousse jamais vers le modèle : le remote `modele` a une URL de push invalide exprès.

## Échecs connus

| Message | Cause | Correctif |
|---|---|---|
| « Pas connecté à GitHub » | `gh` jamais connecté sur ce poste | Le participant lance `gh auth login` (navigateur), puis relance. |
| « Aucun dépôt the-spoon-<prénom> pour @… » | Dépôt pas encore créé, ou invitation envoyée à un autre compte GitHub | Donner au formateur le compte affiché. Il relance `participant.sh <prénom> <compte>`. |
| « Plusieurs dépôts possibles » | Compte admin de l'organisation (formateur) | Relancer avec le prénom en argument. |
| « Un remote « modele » existe déjà » | Script interrompu, ou remote ajouté à la main | Montrer `git remote -v`. Si `modele` pointe sur `the-spoon` et origin aussi, proposer `git remote remove origin` puis relancer ; seulement avec l'accord du participant. |
| « origin pointe vers … ni le dépôt commun ni le vôtre » | Fork ou clone d'un autre dépôt | Ne rien changer. Demander au participant ce qu'est ce dépôt. |
| « divergente de origin/… » | Commits des deux côtés (par exemple une synchro du modèle pendant qu'il travaillait) | Montrer `git log --oneline --graph <branche> origin/<branche>`. Proposer `git pull` (merge) et laisser le participant décider. |
| Production : code 000 ou 503 | Base partagée arrêtée la nuit, ou déploiement en cours ou en échec | `gh run list --workflow deploy.yml --limit 3`. En journée, si le dernier run est rouge, prévenir le formateur. |

## Après

- Les PR s'ouvrent sur son dépôt : `gh pr create` vise `origin` grâce à `gh repo set-default`.
- Les nouveautés du modèle arrivent sur son dépôt avant chaque session (avance rapide de main, ou PR « Mise à jour du modèle » s'il a commité sur main). Ensuite : `git pull`.
- Le modèle reste consultable : `git fetch modele`, `git log modele/main`.

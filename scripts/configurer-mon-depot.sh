#!/usr/bin/env bash
# Passe ce clone sur le dépôt personnel du participant, puis prépare le poste :
#   ./scripts/configurer-mon-depot.sh            # trouve le dépôt tout seul
#   ./scripts/configurer-mon-depot.sh laurene    # ou le désigne par le prénom
#
# Chaque participant a son dépôt, thespoon-reloaded-org/the-spoon-<prénom>,
# avec sa CI et sa production. Ce script :
#   1. vérifie la connexion GitHub et accepte l'invitation au dépôt ;
#   2. si ce clone vient du dépôt commun (the-spoon), le renomme en remote
#      « modele » (lecture seule) et fait de son dépôt le remote « origin » ;
#   3. aligne main et les branches suivies sur origin, sans jamais écraser un
#      commit local ;
#   4. règle `gh` sur son dépôt (PR, CI, workflows) ;
#   5. lance installer-poste.sh (Node, pnpm, PostgreSQL, .env, migrations) ;
#   6. vérifie que sa production répond.
# Relançable sans risque.
set -euo pipefail
cd "$(dirname "$0")/.."

ok()    { printf '  \033[32m✓\033[0m %s\n' "$1"; }
info()  { printf '  → %s\n' "$1"; }
etape() { printf '\n\033[1m%s\033[0m\n' "$1"; }
stop()  { printf '\n\033[31m✗ %s\033[0m\n' "$1"; exit 1; }

ORG=thespoon-reloaded-org
MODELE="$ORG/the-spoon"
PRENOM=${1:-}

etape "1. GitHub"
command -v gh >/dev/null || stop "CLI GitHub absent. Lancer d'abord ./scripts/installer-poste.sh (il l'installe), puis ce script."
gh auth status >/dev/null 2>&1 || stop "Pas connecté à GitHub. Lancer : gh auth login   puis relancer ce script."
LOGIN=$(gh api user --jq .login)
ok "connecté en @$LOGIN"

# Invitations en attente vers un dépôt the-spoon-* de l'organisation.
for ligne in $(gh api user/repository_invitations --jq \
    ".[] | select(.repository.full_name | startswith(\"$ORG/the-spoon-\")) | \"\(.id):\(.repository.full_name)\""); do
  gh api -X PATCH "user/repository_invitations/${ligne%%:*}" >/dev/null
  ok "invitation acceptée : ${ligne#*:}"
done

if [ -n "$PRENOM" ]; then
  R="$ORG/the-spoon-$PRENOM"
  gh repo view "$R" >/dev/null 2>&1 || stop "Dépôt $R introuvable, ou pas d'accès. Vérifier le prénom (minuscules, sans accent) ou demander au formateur."
else
  DEPOTS=$(gh api "user/repos?affiliation=collaborator,organization_member&per_page=100" --paginate --jq \
    ".[] | select(.owner.login == \"$ORG\" and (.name | startswith(\"the-spoon-\")) and .permissions.admin) | .full_name")
  N=$(printf '%s' "$DEPOTS" | grep -c . || true)
  [ "$N" -ge 1 ] || stop "Aucun dépôt the-spoon-<prénom> pour @$LOGIN. Le formateur ne l'a pas encore créé, ou l'invitation est partie vers un autre compte GitHub : lui donner « $LOGIN »."
  [ "$N" -eq 1 ] || stop "Plusieurs dépôts possibles :
$DEPOTS
Relancer avec le prénom : ./scripts/configurer-mon-depot.sh <prénom>"
  R=$DEPOTS
fi
ok "dépôt personnel : $R"

etape "2. Remotes"
git rev-parse --git-dir >/dev/null 2>&1 || stop "Ce dossier n'est pas un clone git."
URL_ORIGIN=$(git remote get-url origin 2>/dev/null || true)
# Même protocole que le clone actuel (ssh ou https).
case "$URL_ORIGIN" in
  git@github.com:*|ssh://*) URL_PERSO="git@github.com:$R.git" ;;
  *)                        URL_PERSO="https://github.com/$R.git" ;;
esac
nom_depot() { printf '%s' "$1" | sed -E 's#^(https://github\.com/|git@github\.com:|ssh://git@github\.com/)##; s#\.git$##; s#/$##'; }

case "$(nom_depot "$URL_ORIGIN")" in
  "$R")
    ok "origin pointe déjà sur $R" ;;
  "$MODELE")
    git remote get-url modele >/dev/null 2>&1 && stop "Un remote « modele » existe déjà. Le montrer au formateur : git remote -v"
    git remote rename origin modele
    git remote set-url --push modele "PAS-DE-PUSH-sur-le-modele"
    git remote add origin "$URL_PERSO"
    ok "ancien origin (dépôt commun) renommé « modele », en lecture seule"
    ok "origin → $URL_PERSO" ;;
  "")
    git remote add origin "$URL_PERSO"; ok "origin → $URL_PERSO" ;;
  *)
    stop "origin pointe vers $URL_ORIGIN, ni le dépôt commun ni le vôtre. Le montrer au formateur avant de toucher à quoi que ce soit." ;;
esac
git fetch -q --prune origin
ok "origin récupéré"

etape "3. Branches"
COURANTE=$(git symbolic-ref -q --short HEAD || true)
PROPRE=1; git diff --quiet && git diff --cached --quiet || PROPRE=0
SANS_SUIVI=""
for b in $(git for-each-ref --format='%(refname:short)' refs/heads); do
  # Branche distante visée : celle que la branche suivait sur le modèle
  # (ex. vieille → modele/refonte-annulation), sinon le même nom.
  AMONT=$(git rev-parse -q --abbrev-ref "$b@{upstream}" 2>/dev/null || true)
  case "$AMONT" in modele/*|origin/*) CIBLE=${AMONT#*/} ;; *) CIBLE=$b ;; esac
  O="origin/$CIBLE"
  if git show-ref -q --verify "refs/remotes/$O"; then
    git branch -q --set-upstream-to="$O" "$b"
    if git merge-base --is-ancestor "$b" "$O"; then
      if [ "$(git rev-parse "$b")" = "$(git rev-parse "$O")" ]; then ok "$b : à jour avec $O"
      elif [ "$b" = "$COURANTE" ]; then
        if [ "$PROPRE" = 1 ]; then git merge -q --ff-only "$O"; ok "$b : avancée sur $O"
        else info "$b : en retard sur $O, mais des modifications non commitées sont en cours. Plus tard : git pull --ff-only"; fi
      elif git branch -q -f "$b" "$O" 2>/dev/null; then ok "$b : avancée sur $O"
      else info "$b : ouverte dans un autre worktree. Là-bas : git pull --ff-only"; fi
    elif git merge-base --is-ancestor "$O" "$b"; then
      info "$b : $(git rev-list --count "$O..$b") commit(s) local(aux) pas encore poussé(s). Pour les envoyer : git push origin $b:$CIBLE"
    else
      info "$b : divergente de $O (commits des deux côtés). Rien touché : demander de l'aide avant de pousser."
    fi
  else
    SANS_SUIVI="$SANS_SUIVI $b"
  fi
done
[ -z "$SANS_SUIVI" ] || info "branches seulement sur ce poste :$SANS_SUIVI. Pour les mettre sur votre dépôt : git push -u origin <branche>"
git worktree list | tail -n +2 | grep -q . && info "worktrees : rien à changer, ils partagent ces remotes."

etape "4. CLI GitHub"
gh repo set-default "$R" >/dev/null
ok "gh travaille sur $R (gh pr, gh run, gh workflow)"

etape "5. Poste"
./scripts/installer-poste.sh

etape "6. Production"
URL_PROD=$(gh variable get URL_PROD -R "$R" 2>/dev/null || true)
if [ -z "$URL_PROD" ]; then info "pas encore de variable URL_PROD : la production n'est pas prête, prévenir le formateur."
else
  CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$URL_PROD" || true)
  if [ "$CODE" = 200 ]; then ok "$URL_PROD répond (200)"
  else info "$URL_PROD répond $CODE (la base partagée est arrêtée la nuit ; sinon voir gh run list)"; fi
fi

printf '\n\033[32mPrêt.\033[0m Vos PR, votre CI et votre production : https://github.com/%s\n' "$R"
printf 'Le dépôt commun reste lisible sous « modele » (git fetch modele) ; on ne pousse jamais dessus.\n'

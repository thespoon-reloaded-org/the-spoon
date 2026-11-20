# Affaire N° 1 · Les Clés — Versioning & Review

Ce backlog fait pratiquer Git sur le vrai dépôt de TheSpoon, dans ton propre fork de `thespoon-reloaded-org/the-spoon` (fork créé en décochant « Copy the main branch only », pour garder les anciennes branches) : lire l'historique pour comprendre pourquoi le code est comme il est (`git log -S`, `git log -L`, `git blame`), travailler sur deux branches à la fois (`git worktree`), choisir entre merge et rebase, retrouver le commit fautif (`git bisect`), et relire une pull request, écrite par un humain ou par un agent, avec la grille `REVIEW.md`. Les items S1-01 à S1-05, S1-08, S1-09 (bisect piloté à l'écran) et S1-15 conviennent bien à des non-développeurs : ils demandent de lire, de comparer, d'essayer et de rédiger, pas de coder. Référence : `origin/main` (commit `d2dc6c8`, qui ajoute l'assistant de recherche, la console formateur et la connexion Google des formateurs) ; faire `git pull` sur `main` avant de commencer, les chiffres ci-dessous sont comptés sur cette version. Chaque joueur travaille dans son fork, une branche par item, nommée `affaire-01/<id>` (par exemple `affaire-01/s1-06`). Les items d'enquête rendent leurs conclusions dans `docs/affaires/01/<ID>.md`. Chevauchements à surveiller : S1-08, S1-11 et S1-14 partent tous de la branche `origin/claude/reservation-login-flow-cb96d3` (seul S1-14 la mène jusqu'au merge, les deux autres ne poussent que sur leur propre branche) ; S1-03 ouvre le ticket que S2-06 (affaire 2) corrigera ; S1-09, S1-10 et S1-12 travaillent sur des branches préparées par le formateur et ne touchent pas `main`.

| ID | Titre | Type | Taille | Demandé par |
|---|---|---|---|---|
| S1-01 | Pourquoi 100 couverts ? | enquête | S | Gérante d'un restaurant partenaire |
| S1-02 | Le fuseau qu'on a débranché | enquête | S | Ex-SRE |
| S1-03 | Un commentaire qui date | enquête | S | Ex-QA |
| S1-04 | Ce qu'on a livré aux restaurants depuis la rentrée | chore | S | Ex-CEO |
| S1-05 | Relire « fix: mv files » | enquête | S | Ex-Scrum Master |
| S1-06 | Hotfix du 1er janvier, sans lâcher sa branche | bug | M | Ex-CTO |
| S1-07 | Rattraper `main` : merge ou rebase ? | chore | M | Ex-architecte |
| S1-08 | Lire l'historique de `main` et fixer une règle de merge | enquête | M | Ex-Scrum Master |
| S1-09 | Le créneau de 22 h a disparu | bug | M | Dîneur (email au support) |
| S1-10 | L'annulation qui ne tient plus parole | bug | M | Gérant d'un restaurant partenaire |
| S1-11 | Relire la PR « La réservation survit au passage par la connexion » | enquête | M | Ex-CTO |
| S1-12 | Relire un diff écrit par un agent | enquête | M | Ex-QA |
| S1-13 | Un modèle de pull request qui suit `REVIEW.md` | chore | M | Ex-Scrum Master |
| S1-14 | Mener la branche « retour après connexion » jusqu'au merge | feature | L | Ex-CPO |
| S1-15 | Inventaire des 53 branches laissées sur le dépôt | enquête | L | Ex-DevOps |

## S1-01 · Pourquoi 100 couverts ?

- **Type** : enquête · **Taille** : S · **Demandé par** : Gérante d'un restaurant partenaire
- **Contexte** : « Ma salle fait 28 places. Samedi, TheSpoon m'a envoyé 40 couverts sur le même créneau de 20 h. Qui a décidé de ce chiffre ? »
- **À faire** : retrouver dans l'historique d'où vient la capacité utilisée quand un restaurant n'a pas renseigné la sienne. Partir de `CAPACITE_PAR_DEFAUT` dans `src/lib/reservation.ts`, puis `git log -S "CAPACITE_PAR_DEFAUT" --oneline main` et `git blame -L 5,16 src/lib/reservation.ts`. Lire le message du commit trouvé. Rédiger une réponse courte à la gérante (ce qui s'est passé, ce qu'elle doit faire sur sa fiche) et une recommandation pour l'équipe (garder 100, le baisser, ou bloquer la réservation tant que la capacité n'est pas renseignée).
- **Critères d'acceptation** :
  - Le fichier `docs/affaires/01/S1-01.md` cite le commit qui a introduit la constante (hash court, date, auteur) et la raison donnée dans le commentaire (31 % des fiches sans capacité).
  - Il explique en une phrase pourquoi 40 couverts sont passés (capacité vide sur la fiche, donc plafond de 100 par créneau, compté sur l'instant exact du créneau).
  - Il contient la réponse à la gérante, en mots simples, sans jargon Git.
  - Il contient une recommandation argumentée, sans modifier le code.
- **Fichiers concernés** : `src/lib/reservation.ts`, `src/app/espace-restaurant/fiche/actions.ts` (lecture seule).
- **Ce que ça exerce** : `git log -S`, `git blame`, lire un message de commit comme une trace de décision.

## S1-02 · Le fuseau qu'on a débranché

- **Type** : enquête · **Taille** : S · **Demandé par** : Ex-SRE
- **Contexte** : « Je me souviens qu'on avait forcé `TZ=Europe/Paris` quelque part pour régler les heures de réservation. Je ne le retrouve plus. Qui l'a enlevé, et est-ce qu'on doit le remettre ? »
- **À faire** : `git log -S "process.env.TZ" --oneline main` pour trouver le commit qui l'a ajouté et celui qui l'a retiré. Lire les deux diffs (`git show <hash> -- src/lib/env.ts`). Puis `git log -L :instantLocal:src/lib/fuseau.ts main` pour voir comment la fonction qui a remplacé ce réglage a évolué. Répondre à la question « faut-il le remettre ? ».
- **Critères d'acceptation** :
  - `docs/affaires/01/S1-02.md` nomme les deux commits (ajout et retrait), avec leur date.
  - Il explique en 5 lignes maximum pourquoi le réglage global ne protégeait pas la production (le poste de dev est déjà à Paris, Netlify tourne en UTC), en citant le commentaire d'en-tête de `src/lib/fuseau.ts`.
  - Il conclut par oui ou non, avec la règle à suivre à la place (les deux règles de la section « L'heure, c'est l'heure de Paris » du `README.md`).
- **Fichiers concernés** : `src/lib/env.ts`, `src/lib/fuseau.ts`, `README.md` (lecture seule).
- **Ce que ça exerce** : `git log -S` pour retrouver du code disparu, `git log -L` sur une fonction.

## S1-03 · Un commentaire qui date

- **Type** : enquête · **Taille** : S · **Demandé par** : Ex-QA
- **Contexte** : Trouvé en relisant `src/lib/facturation.ts` : `referenceAvoir` dit « Mois local, pas UTC » et utilise `getFullYear()` / `getMonth()`. « Local » de quelle machine ?
- **À faire** : `git blame -L 54,66 src/lib/facturation.ts` pour dater ces lignes, puis `git log --format='%h %ad %s' --date=short -- src/lib/fuseau.ts | tail -1` pour dater l'arrivée des règles d'heure de Paris. Comparer les deux dates. Écrire un ticket (issue GitHub, ou fichier si le dépôt n'a pas d'issues) qui décrit le défaut probable : en production (UTC), un avoir émis le 1er octobre à 0 h 30 à Paris porterait la référence `AV-202609`. Ne pas corriger : la correction est l'item S2-06 de l'affaire 2.
- **Critères d'acceptation** :
  - `docs/affaires/01/S1-03.md` cite le commit d'origine de `referenceAvoir` (hash, date) et celui qui a introduit `src/lib/fuseau.ts`, et montre que le premier est antérieur.
  - Le ticket contient : le symptôme attendu, un exemple daté précis, la règle du `README.md` qui n'est pas respectée, et les fonctions de `src/lib/fuseau.ts` à utiliser.
  - Aucun fichier de `src/` n'est modifié.
- **Fichiers concernés** : `src/lib/facturation.ts`, `src/lib/fuseau.ts` (lecture seule).
- **Ce que ça exerce** : `git blame`, dater une décision, transformer une trouvaille d'historique en ticket exploitable.

## S1-04 · Ce qu'on a livré aux restaurants depuis la rentrée

- **Type** : chore · **Taille** : S · **Demandé par** : Ex-CEO
- **Contexte** : « Je rappelle les 50 restaurants la semaine prochaine. Avant, je veux une liste de ce qui a changé pour eux depuis septembre. Pas pour les dîneurs, pas pour le staff : pour eux. »
- **À faire** : lister les changements arrivés sur `main` avec `git log --first-parent --since=2026-09-01 --format='%h %ad %s' --date=short main`. Garder ceux qui touchent l'espace restaurant (`src/app/espace-restaurant/`, `git log --first-parent ... -- src/app/espace-restaurant`). Rédiger une note d'une page, en mots de restaurateur, que l'ex-CEO peut lire au téléphone.
- **Critères d'acceptation** :
  - `docs/affaires/01/S1-04.md` contient au plus 10 points, chacun relié à au moins un hash de commit.
  - Chaque point dit ce que le restaurateur peut faire maintenant (exemples attendus : disponibilités et exceptions datées, politique d'annulation, signalement honoré / no-show, allergènes, factures et contestation).
  - Aucun point ne décrit une fonction absente de `main` (vérifier dans le code, pas seulement dans le message de commit).
  - La note explique en une ligne pourquoi `--first-parent` a été utilisé.
- **Fichiers concernés** : aucun fichier modifié hors `docs/affaires/01/`.
- **Ce que ça exerce** : filtrer l'historique par date, par chemin et par premier parent ; traduire des commits en langage métier.

## S1-05 · Relire « fix: mv files »

- **Type** : enquête · **Taille** : S · **Demandé par** : Ex-Scrum Master
- **Contexte** : « Le 1er octobre, quelqu'un a poussé deux commits sur `feat/accept_or_reject_resto` : un `feat:` et un `fix: mv files`. La PR #51 les a fusionnés. Personne n'a jamais su ce que ça faisait, ni ce que ça a lancé. »
- **À faire** : `git show --name-status -M d04eaf9 06d9933`, puis retrouver leur fusion (`git log --merges --oneline main | grep accept_or_reject`). Lire la section « SDLC and specs » d'`AGENTS.md` et `docs/sdlc/README.md`. Suivre ensuite le parcours des deux specs jusqu'à aujourd'hui (`git log --follow --format='%h %ad %s' --date=short -- docs/specs/*/013-qualification-demandes-restaurateurs/SPEC.md`, idem pour la spec 012). Dire en clair ce que font ces commits et ce que leur fusion a déclenché.
- **Critères d'acceptation** :
  - `docs/affaires/01/S1-05.md` dit que le commit `feat:` n'ajoute que des specs (aucun code) et que `fix: mv files` déplace deux specs de `00-backlog/` vers `01-ready-to-implement/`.
  - Il explique, en citant `AGENTS.md`, que ce déplacement lance une exécution automatique et demande une validation humaine, et dit si la PR #51 montre une telle validation.
  - Il donne l'état actuel des deux specs (012 dans `03-done/`, 013 encore dans `02-implementing/`) et se demande si 013 est réellement en cours ou oubliée.
  - Il propose deux messages de commit réécrits qui disent vraiment ce qui a été fait.
  - Il donne un verdict de relecture (`approve` ou `changes_requested`) avec la raison.
- **Fichiers concernés** : `docs/specs/`, `AGENTS.md`, `docs/sdlc/README.md` (lecture seule).
- **Ce que ça exerce** : relire un diff sans savoir coder, détection des renommages (`-M`), qualité des messages de commit.

## S1-06 · Hotfix du 1er janvier, sans lâcher sa branche

- **Type** : bug · **Taille** : M · **Demandé par** : Ex-CTO
- **Contexte** : « Le pied de page affiche `© {new Date().getFullYear()}`. En production on tourne en UTC : le 1er janvier entre minuit et 1 h, la page dira encore 2026. On est le 22 janvier pour le contrat, ça peut attendre une heure, pas un mois. »
- **À faire** : sans toucher à la branche sur laquelle le binôme travaille déjà (garder des fichiers modifiés non commités dessus), créer un second dossier de travail : `git worktree add ../the-spoon-hotfix -b affaire-01/s1-06-<binome> main`. Dans ce dossier : ajouter dans `src/lib/fuseau.ts` une fonction qui rend l'année à Paris (en s'appuyant sur `composantesLocales`), son test dans `src/lib/fuseau.test.ts`, et l'utiliser dans `src/components/SiteFooter.tsx`. Vérifier aussi, avec la sortie de `pnpm build`, si la page d'accueil est rendue une fois au build (dans ce cas l'année serait figée au jour du déploiement) et le noter dans la PR. Ouvrir la PR, revenir dans le dossier principal, retrouver son travail intact, puis `git worktree remove ../the-spoon-hotfix`.
- **Critères d'acceptation** :
  - `git worktree list` a montré deux dossiers pendant le travail (capture ou copie dans la PR).
  - Le nouveau test passe avec `TZ=UTC pnpm vitest run src/lib/fuseau.test.ts` et vérifie qu'à `2026-12-31T23:30:00Z` l'année rendue est 2027.
  - `pnpm typecheck` et `pnpm lint` passent.
  - La PR décrit le problème, la correction, et la réponse à la question « page rendue au build ou à chaque requête ».
  - Le travail en cours sur l'autre branche n'a été ni commité ni remisé (`git stash list` vide).
- **Fichiers concernés** : `src/components/SiteFooter.tsx`, `src/lib/fuseau.ts`, `src/lib/fuseau.test.ts`.
- **Ce que ça exerce** : `git worktree` (deux branches ouvertes en même temps), petite PR de correction, règle d'heure de Paris.

## S1-07 · Rattraper `main` : merge ou rebase ?

- **Type** : chore · **Taille** : M · **Demandé par** : Ex-architecte
- **Contexte** : La branche `origin/claude/reservation-login-flow-cb96d3` (un commit, 23 septembre) a 91 commits de retard sur `main`. Entre-temps, `main` a reçu l'assistant de recherche, qui pré-remplit aussi la carte de réservation (propriété `souhait` de `BookingCard`). Avant de la reprendre, il faut la remettre à jour, et choisir comment.
- **À faire** : créer deux branches locales à partir d'elle : `affaire-01/s1-07-merge-<binome>` et `affaire-01/s1-07-rebase-<binome>`. Sur la première, `git merge main` ; sur la seconde, `git rebase main`. Résoudre les conflits (attendus dans `src/app/(site)/restaurants/[id]/page.tsx` et `src/components/BookingCard.tsx`) de la même façon des deux côtés, en gardant les deux pré-remplissages qui marchent. Comparer `git log --graph --oneline -15` des deux branches et `git diff affaire-01/s1-07-merge-<binome> affaire-01/s1-07-rebase-<binome>`. Recommander une des deux pour cette branche.
- **Critères d'acceptation** :
  - Les deux branches compilent (`pnpm typecheck`) et `pnpm vitest run src/lib/retour.test.ts` passe sur les deux.
  - `git diff` entre les deux branches est vide (même code, histoires différentes).
  - `docs/affaires/01/S1-07.md` montre les deux graphes et explique en mots simples la différence (un commit de fusion d'un côté, un commit réécrit avec un nouveau hash de l'autre), et pourquoi on ne rebase pas une branche que d'autres ont déjà récupérée.
  - Aucune des deux branches n'est poussée sur `claude/reservation-login-flow-cb96d3` (c'est S1-14 qui la reprend).
- **Fichiers concernés** : `src/app/(site)/restaurants/[id]/page.tsx`, `src/components/BookingCard.tsx`, `src/lib/retour.ts` (sur des branches à soi).
- **Ce que ça exerce** : merge contre rebase, résolution de conflit, lecture d'un graphe d'historique.

## S1-08 · Lire l'historique de `main` et fixer une règle de merge

- **Type** : enquête · **Taille** : M · **Demandé par** : Ex-Scrum Master
- **Contexte** : « Quand on était encore là, chacun fusionnait à sa façon. Si on reprend, je veux une règle, une seule. »
- **À faire** : lire `git log --first-parent --oneline main` et `git log --graph --oneline main | head -80`. Compter les trois façons dont le code est arrivé sur `main` : commits de fusion (« Merge pull request #… »), PR écrasées en un commit (titre qui finit par « (#29) », par exemple `e105ad6`), commits poussés directement. Pour un cas de PR écrasée, comparer avec la branche d'origine : `git cherry -v main origin/claude/onboarding-parcours` et `git cherry -v main origin/claude/gestion-reservation-87fab1`, et expliquer pourquoi l'une sort en « - » et l'autre en « + » alors que les deux ont été livrées. Proposer une règle (merge commit, squash ou rebase) pour la suite du programme.
- **Critères d'acceptation** :
  - `docs/affaires/01/S1-08.md` donne les trois comptes (avec la commande qui les produit).
  - Il explique le résultat des deux `git cherry` en mots simples.
  - Il recommande une règle et dit ce qu'elle rend facile (relire, annuler une PR avec `git revert`, `git bisect`) et ce qu'elle fait perdre.
  - La recommandation tient en 5 lignes, lisible par un non-développeur.
- **Fichiers concernés** : aucun fichier modifié hors `docs/affaires/01/`.
- **Ce que ça exerce** : lire un historique réel, merge commit contre squash contre rebase, `git cherry`.

## S1-09 · Le créneau de 22 h a disparu

- **Type** : bug · **Taille** : M · **Demandé par** : Dîneur (email au support)
- **Contexte** : « Je réserve toujours à 22 h chez vous, le restaurant est ouvert jusqu'à 23 h. Depuis quelques jours, 22 h n'apparaît plus dans la liste. »
- **À faire** : sur la branche `affaire-01/bisect-22h` préparée par le formateur, trouver le commit qui a cassé l'affichage. Aucun test ne couvre cet écran : lancer `pnpm dev` une fois, puis piloter `git bisect start`, `git bisect bad`, `git bisect good <hash de départ>` et, à chaque étape, recharger une fiche restaurant ouverte le soir pour dire `good` ou `bad` (le serveur de dev recharge le code à chaque changement de commit). Une fois le commit trouvé, écrire un correctif sur une branche à soi.
- **Critères d'acceptation** :
  - `docs/affaires/01/S1-09.md` donne le hash du commit fautif, le nombre d'étapes de bisect, et la sortie de `git bisect log`.
  - Le correctif rétablit `22:00` dans la liste du soir de `src/components/BookingCard.tsx` (vérifié à l'écran sur une fiche ouverte jusqu'à 23 h).
  - La note propose le test qui aurait attrapé le problème (en mots simples suffit).
  - `git bisect reset` a été fait (on est revenu sur sa branche).
- **Fichiers concernés** : `src/components/BookingCard.tsx`, `src/lib/creneaux.ts` (lecture).
- **Ce que ça exerce** : `git bisect` manuel quand aucun test n'existe.
- **Préparation formateur** : créer depuis `main` la branche `affaire-01/bisect-22h` avec environ 30 petits commits plausibles (libellés, commentaires, espacements dans des écrans du site). Vers le 18e, remplacer dans `src/components/BookingCard.tsx` la ligne `["Soir", CRENEAUX_SOIR]` par `["Soir", CRENEAUX_SOIR.slice(0, -1)]` sous un message anodin (« Relecture : alignement des créneaux du soir »). Pousser la branche. Noter le hash du commit de départ « good » à donner aux binômes.

## S1-10 · L'annulation qui ne tient plus parole

- **Type** : bug · **Taille** : M · **Demandé par** : Gérant d'un restaurant partenaire
- **Contexte** : « Ma politique dit annulation gratuite jusqu'à 24 h avant. Hier soir, une table de 6 a annulé à 18 h pour 20 h. Votre site l'a laissé faire. »
- **À faire** : sur la branche `affaire-01/bisect-annulation` préparée par le formateur, constater d'abord que `pnpm vitest run src/lib/annulation.test.ts` échoue. Puis laisser Git chercher seul : `git bisect start HEAD <hash good>` et `git bisect run pnpm vitest run src/lib/annulation.test.ts`. Expliquer pourquoi personne ne l'a vu (les commits ont été poussés directement sur la branche, et la CI ne tourne que sur les pull requests, voir `.github/workflows/ci.yml`). Corriger avec `git revert` du seul commit fautif.
- **Critères d'acceptation** :
  - `docs/affaires/01/S1-10.md` contient la commande `git bisect run` utilisée et le hash trouvé.
  - Le correctif est un `git revert` (un commit « Revert … » qui cite le hash fautif), pas une réécriture à la main.
  - `pnpm vitest run src/lib/annulation.test.ts` passe après le revert.
  - La note explique en deux lignes pourquoi la CI n'a rien dit.
- **Fichiers concernés** : `src/lib/annulation.ts`, `src/lib/annulation.test.ts`, `.github/workflows/ci.yml` (lecture).
- **Ce que ça exerce** : `git bisect run` automatisé par un test, `git revert`, limite de la CI déclenchée sur `pull_request` seulement.
- **Préparation formateur** : créer depuis `main` la branche `affaire-01/bisect-annulation` avec environ 25 commits plausibles (commentaires, libellés dans `MESSAGES_REFUS_ANNULATION`, mise en forme d'écrans). Vers le 12e, changer dans `limiteAnnulation` (`src/lib/annulation.ts`) `delaiHeures * 60 * 60 * 1000` en `delaiHeures * 60 * 1000`, message « Relecture : simplifie le calcul de la limite ». Pousser directement, sans PR. Donner aux binômes le hash du premier commit de la branche comme « good ».

## S1-11 · Relire la PR « La réservation survit au passage par la connexion »

- **Type** : enquête · **Taille** : M · **Demandé par** : Ex-CTO
- **Contexte** : Une branche jamais fusionnée, `origin/claude/reservation-login-flow-cb96d3` : un dîneur qui choisit sa table avant de se connecter retrouve sa sélection après connexion. Écrite avec un agent, jamais relue.
- **À faire** : relire le diff (`git diff main...origin/claude/reservation-login-flow-cb96d3`) avec la grille `REVIEW.md` : une note de 1 à 5 par dimension, chaque note sous 5 justifiée par une trouvaille avec fichier et ligne. Pour l'essayer, l'ouvrir dans un second dossier (`git worktree add ../the-spoon-revue origin/claude/reservation-login-flow-cb96d3`, `pnpm install`, `cp ../the-spoon_bootcamp/.env .`, `pnpm dev --port 3101`) et comparer avec `main` sur le port 3100. Regarder en particulier le filtre `cheminRetour` de `src/lib/retour.ts` : essayer des valeurs piégées (`//exemple.com`, `/\exemple.com`, `/%09/exemple.com`, une tabulation après la première barre) et noter ce qui passe. Comparer ensuite sa relecture avec celle de `/code-review` lancée sur la même branche.
- **Critères d'acceptation** :
  - `docs/affaires/01/S1-11.md` contient les 5 notes, les trouvailles classées blocker / major / minor, et un verdict `approve` ou `changes_requested` conforme à la règle de `REVIEW.md`.
  - Au moins une trouvaille porte sur la sécurité de la redirection, appuyée par un essai réel (valeur testée, résultat observé).
  - Une section « humain contre agent » liste ce que chacun a trouvé que l'autre a manqué.
  - Le dossier de relecture a été retiré (`git worktree remove`).
- **Fichiers concernés** : `src/lib/retour.ts`, `src/lib/retour.test.ts`, `src/app/(connexion)/connexion/page.tsx`, `src/components/BookingCard.tsx`, `src/app/(site)/restaurants/[id]/actions.ts` (lecture, sur la branche).
- **Ce que ça exerce** : relecture humaine avec une grille, relecture par un agent, worktree pour essayer une branche sans quitter la sienne.
- **Préparation formateur** : si aucune PR n'existe pour cette branche sur GitHub, en ouvrir une en brouillon pour que les binômes puissent y laisser leurs commentaires.

## S1-12 · Relire un diff écrit par un agent

- **Type** : enquête · **Taille** : M · **Demandé par** : Ex-QA
- **Contexte** : « Avant de partir, quelqu'un a demandé à un agent d'afficher la date du dernier avis sur la fiche restaurant. La PR est verte en local, d'après lui. Je ne la fusionne pas sans une vraie relecture. »
- **À faire** : relire la PR préparée par le formateur (branche `affaire-01/agent-dernier-avis`) avec `REVIEW.md`, sans lancer d'agent d'abord. Lister chaque problème avec fichier, ligne, gravité et la règle du dépôt qu'il enfreint. Ensuite seulement, lancer `/code-review` sur la même branche et comparer.
- **Critères d'acceptation** :
  - Les commentaires sont posés sur la PR GitHub (ou dans `docs/affaires/01/S1-12.md`), un par problème.
  - Les cinq défauts plantés sont trouvés, ou ceux qui manquent sont nommés après comparaison avec la relecture de l'agent.
  - Le verdict est `changes_requested`, avec au moins un blocker justifié par une règle écrite (`README.md`, `REVIEW.md` ou `AGENTS.md`).
  - Une ligne dit quel défaut l'agent relecteur a manqué, s'il en a manqué un.
- **Fichiers concernés** : ceux de la branche préparée : `src/app/(site)/restaurants/[id]/page.tsx`, `src/lib/avis.ts`, `src/app/(site)/restaurants/[id]/actions.ts`, une migration, `src/components/SiteFooter.tsx`.
- **Ce que ça exerce** : attraper un mauvais changement, relire un diff d'agent, comparer relecture humaine et relecture agent.
- **Préparation formateur** : créer depuis `main` la branche `affaire-01/agent-dernier-avis` (et une PR) qui ajoute « Dernier avis le … » sur la fiche restaurant, avec cinq défauts : (1) date affichée par `toLocaleDateString("fr-FR")` sans `timeZone` au lieu de `formaterDate` ; (2) une colonne `dernierAvisLe` ajoutée en modifiant `prisma/migrations/20260923100000_allergenes_plats/migration.sql` au lieu de créer une migration ; (3) un test qui passe toujours (un `expect` dans un `forEach` sur une liste vide, ou `expect(true).toBe(true)`) ; (4) `console.log` de l'email du dîneur dans `deposerAvis` ; (5) `src/components/SiteFooter.tsx` reformaté sans raison. Écrire une description de PR confiante (« tests OK, prêt à fusionner »).

## S1-13 · Un modèle de pull request qui suit `REVIEW.md`

- **Type** : chore · **Taille** : M · **Demandé par** : Ex-Scrum Master
- **Contexte** : « Nos PR disaient “voir commit”. Le relecteur devait tout deviner. Si on rouvre, chaque PR dit ce qu'elle change et comment on l'a vérifiée. »
- **À faire** : créer `.github/pull_request_template.md`, en français, court, aligné sur les cinq dimensions de `REVIEW.md` et sur la section « What to test » de `docs/sdlc/templates/TASK.md`. Rubriques attendues : ce qui change et pourquoi, comment l'essayer, ce qui a été lancé (`pnpm typecheck`, `pnpm lint`, `pnpm test`), migration oui / non, données personnelles ou secrets touchés oui / non, captures si écran. L'utiliser tout de suite pour la PR de cet item.
- **Critères d'acceptation** :
  - Le fichier fait moins de 40 lignes et se lit sans connaître Git.
  - La PR de cet item est remplie avec ce modèle (GitHub le propose automatiquement une fois sur la branche par défaut ; en attendant, le copier à la main).
  - Un autre binôme relit la PR et confirme qu'il a pu l'essayer avec la seule rubrique « comment l'essayer ».
- **Fichiers concernés** : `.github/pull_request_template.md` (nouveau), `REVIEW.md`, `docs/sdlc/templates/TASK.md` (lecture).
- **Ce que ça exerce** : rédiger une PR utile au relecteur, relier la PR à la grille de relecture.

## S1-14 · Mener la branche « retour après connexion » jusqu'au merge

- **Type** : feature · **Taille** : L · **Demandé par** : Ex-CPO
- **Contexte** : « La moitié des dîneurs qui composent une réservation sans être connectés abandonnent après la connexion : ils retombent sur l'accueil. La branche qui corrige ça existe depuis septembre. Finissez-la. »
- **À faire** : reprendre `origin/claude/reservation-login-flow-cb96d3` sur `affaire-01/s1-14-retour-connexion`, la remettre à jour sur `main` selon la règle choisie en S1-08 (ou S1-07 si S1-08 n'a pas conclu), traiter les trouvailles de S1-11 (en particulier le filtre de `cheminRetour`), faire passer la sélection retrouvée après connexion par la propriété `souhait` que l'assistant de recherche a ajoutée à `BookingCard` plutôt que de garder deux mécanismes de pré-remplissage, compléter les tests, ouvrir la PR avec le modèle de S1-13, la faire relire par un autre binôme, et fusionner.
- **Critères d'acceptation** :
  - `src/lib/retour.test.ts` couvre au moins les valeurs piégées relevées en S1-11 (tabulation ou retour à la ligne après la première barre, `/%2F` en tête), et `cheminRetour` refuse celles qui mèneraient hors du site.
  - `BookingCard` n'a qu'un seul chemin de pré-remplissage (`souhait`), utilisé à la fois par l'assistant et par le retour après connexion ; le pré-remplissage par l'assistant marche toujours.
  - Scénario vérifié à l'écran : déconnecté, choisir 4 convives, un jour et 20:00 sur une fiche, se connecter, revenir sur la fiche avec la sélection pré-remplie, confirmer, voir la réservation dans `/mes-reservations`.
  - `pnpm typecheck`, `pnpm lint`, `pnpm test` passent, et la CI de la PR est verte.
  - La PR a au moins une relecture approuvée d'un autre binôme, et l'historique final respecte la règle de merge choisie.
- **Fichiers concernés** : `src/lib/retour.ts`, `src/lib/retour.test.ts`, `src/app/(connexion)/connexion/page.tsx`, `src/components/BookingCard.tsx`, `src/app/(site)/restaurants/[id]/page.tsx`, `src/app/(site)/restaurants/[id]/actions.ts`.
- **Ce que ça exerce** : tout le cycle branche → mise à jour → relecture → corrections → merge.

## S1-15 · Inventaire des 53 branches laissées sur le dépôt

- **Type** : enquête · **Taille** : L · **Demandé par** : Ex-DevOps
- **Contexte** : « Il reste 53 branches sur `origin`, dont 11 jamais fusionnées. Certaines sont livrées, d'autres abandonnées, d'autres contiennent peut-être la seule copie d'un travail. Avant de supprimer quoi que ce soit, je veux savoir. »
- **À faire** : pour chaque branche de `git branch -r`, établir son état : fusionnée (`git branch -r --merged main`), livrée sous une autre forme (`git cherry -v main <branche>` tout en « - », ou contenu retrouvé dans `main` malgré des hash différents, comme `claude/onboarding-parcours`), en avance sur `main` avec du travail jamais livré (`git log --oneline main..<branche>`, par exemple `feature/spec-013` avec 3 commits d'avance, `claude/chatbot-deepseek` avec 1, `claude/repare-auth-restaurant-prod` avec 8), ou abandonnée. Proposer une action par branche. Ne rien supprimer.
- **Critères d'acceptation** :
  - `docs/affaires/01/S1-15.md` contient un tableau : branche, dernier commit (date), commits d'avance / de retard, état, action proposée (supprimer, garder, reprendre).
  - Chaque branche « à reprendre » a une phrase qui dit ce qu'elle apporte.
  - Le tableau signale les branches qui dépendent les unes des autres (une branche fusionnée dans une autre avant d'arriver sur `main`, par exemple `claude/admin-propositions-assistant` qui a intégré `claude/chatbot-correction-biais`).
  - Aucune branche distante n'a été supprimée.
- **Fichiers concernés** : aucun fichier modifié hors `docs/affaires/01/`.
- **Ce que ça exerce** : lire l'état d'un dépôt à grande échelle, `--merged`, `git cherry`, plages `A..B`, préparer une décision de ménage.

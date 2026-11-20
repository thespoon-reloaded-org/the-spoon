# Affaire N° 3 · La Livraison — CI/CD

4 décembre 2026 · J-49. Ce backlog fait pratiquer le trajet d'un changement jusqu'à la production de TheSpoon : lire une CI rouge, décider ce qui doit bloquer un merge, accélérer les vérifications, comprendre ce que Netlify construit vraiment, et surtout ce qu'une Deploy Preview fait à la base de production partagée (`pnpm build` lance `prisma migrate deploy` contre la vraie base Neon, y compris pour une preview). Accessibles sans être développeur : S3-01 (lire un log rouge), S3-03 (décider des vérifications obligatoires), S3-04 (enquête écrite), S3-08 (procédure de mise en production et de retour arrière), S3-14 (relever ce que Netlify fait, en partie). Chevauchements à surveiller : S3-02 et S3-06 modifient tous deux `.github/workflows/ci.yml` (les faire dans cet ordre, ou par la même paire) ; S3-05 et S3-14 touchent la commande de build (`package.json` et `netlify.toml`) : merger S3-14 d'abord ; les deux L (S3-10, S3-15) démarrent après S3-05 et S3-14. Les autres items créent leurs propres fichiers (workflows séparés, scripts, docs). Une seule production : aucun item ne déploie en production pendant la séance, seules les Deploy Previews sont utilisées.

Référence : `main` du dépôt `the-spoon_bootcamp` à jour d'`origin/main` (commit `e5860a3`, avec l'assistant de recherche et la console formateur).

| ID | Titre | Type | Taille | Demandé par |
|---|---|---|---|---|
| S3-01 | Lire une CI rouge et l'expliquer dans la PR | enquête | S | ex-QA |
| S3-02 | Faire tourner la CI aussi sur `main` | chore | S | ex-DevOps |
| S3-03 | Décider quelles vérifications bloquent un merge | chore | S | ex-CTO |
| S3-04 | Une Deploy Preview peut migrer la base de production | enquête | M | ex-DBA |
| S3-05 | Ne plus migrer la base depuis une Deploy Preview | feature | M | ex-DBA |
| S3-06 | Diviser par deux la durée de la CI | chore | M | ex-Scrum Master |
| S3-07 | Vérifier une Deploy Preview juste après son déploiement | feature | M | ex-SRE |
| S3-08 | Écrire la procédure de mise en production et de retour arrière | chore | M | gérante d'un restaurant partenaire |
| S3-09 | Mises à jour de dépendances automatiques | chore | S | ex-DevOps |
| S3-10 | Une base Neon par Deploy Preview | feature | L | ex-architecte |
| S3-11 | Un test qui passe une fois sur trois | bug | M | ex-QA |
| S3-12 | Vérifier le jeu de formation dans la CI | chore | S | ex-CPO |
| S3-13 | Refuser une PR dont le schéma et les migrations divergent | feature | M | ex-DBA |
| S3-14 | Écrire dans le dépôt ce que Netlify construit | chore | M | ex-SRE |
| S3-15 | Construire dans GitHub Actions et livrer le résultat à Netlify | feature | L | ex-CTO |

## S3-01 · Lire une CI rouge et l'expliquer dans la PR

- **Type** : enquête · **Taille** : S · **Demandé par** : ex-QA
- **Contexte** : Une PR « Horaires du dimanche » est restée ouverte depuis le départ de l'équipe. Son auteur avait écrit en description : « La CI est rouge mais c'est sûrement rien. »
- **À faire** : Ouvrir la PR, aller dans l'onglet Checks, identifier quels jobs de `.github/workflows/ci.yml` échouent (typecheck, lint, build) et pourquoi. Reproduire en local la commande du job en échec (`pnpm lint`, `pnpm test`). Écrire un commentaire de revue en français simple : ce qui casse, dans quel fichier, ce que le test attendait et ce qu'il a reçu, et si la PR peut être mergée.
- **Critères d'acceptation** :
  - Le commentaire nomme chaque job en échec et la ligne du log qui explique l'échec.
  - Le commentaire indique le fichier et le test concernés (nom du `test(...)` Vitest).
  - La même erreur est reproduite en local et la commande utilisée est donnée dans le commentaire.
  - Le commentaire conclut par « peut être mergée » ou « ne peut pas être mergée », avec la raison.
- **Fichiers concernés** : `.github/workflows/ci.yml` (lecture), `src/lib/horaires.ts`, `src/lib/horaires.test.ts` (lecture).
- **Ce que ça exerce** : lire un log de CI, relier un job à une commande locale, distinguer un échec de lint d'un échec de test, rédiger une revue utile.
- **Préparation formateur** : créer une branche `pr/horaires-du-dimanche` avec deux commits : l'un modifie `src/lib/horaires.ts` pour que dimanche vaille 7 au lieu de 0 (ce qui fait échouer `src/lib/horaires.test.ts` dans le job `build`), l'autre laisse un import inutilisé dans `src/app/espace-restaurant/disponibilites/page.tsx` (échec du job `lint`). Ouvrir la PR sans la merger.

## S3-02 · Faire tourner la CI aussi sur `main`

- **Type** : chore · **Taille** : S · **Demandé par** : ex-DevOps
- **Contexte** : Message laissé par l'ex-DevOps : « La CI ne tourne que sur les PR. Si quelqu'un pousse directement sur main, personne ne le voit avant la prod. »
- **À faire** : Ajouter à `.github/workflows/ci.yml` le déclencheur `push` sur `main` et `workflow_dispatch` (lancement à la main). Ajouter un bloc `concurrency` qui annule une exécution en cours sur une PR quand un nouveau commit arrive, mais jamais sur `main`. Ajouter `timeout-minutes` à chaque job.
- **Critères d'acceptation** :
  - Après merge, un push sur `main` déclenche les trois jobs (visible dans l'onglet Actions).
  - Le bouton « Run workflow » apparaît sur le workflow CI.
  - Deux pushs rapprochés sur la même PR : la première exécution est annulée.
  - Chaque job a un `timeout-minutes` (15 au plus).
- **Fichiers concernés** : `.github/workflows/ci.yml`.
- **Ce que ça exerce** : déclencheurs d'un workflow, différence entre vérifier une PR et vérifier la branche principale, annulation des exécutions obsolètes.

## S3-03 · Décider quelles vérifications bloquent un merge

- **Type** : chore · **Taille** : S · **Demandé par** : ex-CTO
- **Contexte** : Note trouvée dans le README de l'ex-CTO : « Aujourd'hui, on peut merger une PR rouge. Personne ne l'a interdit, donc tout le monde l'a fait. »
- **À faire** : Lister les vérifications existantes (jobs de `ci.yml`, revue automatique décrite dans `REVIEW.md`, revue humaine décrite dans `docs/sdlc/README.md`). Proposer les règles de protection de `main` : checks obligatoires, nombre d'approbations, PR obligatoire, interdiction du force-push, et ce qu'on fait des PR du runner SDLC. Écrire la proposition dans `docs/livraison/protection-main.md`, avec pour chaque règle ce qu'elle empêche et ce qu'elle coûte.
- **Critères d'acceptation** :
  - Le document liste les noms exacts des checks à rendre obligatoires (`typecheck`, `lint`, `build`).
  - Chaque règle a une ligne « ce que ça empêche » et une ligne « ce que ça coûte ».
  - La proposition dit qui peut contourner la règle en cas d'urgence.
  - Le formateur applique la règle ; une PR rouge affiche alors « Merging is blocked ».
- **Fichiers concernés** : `docs/livraison/protection-main.md` (nouveau), `REVIEW.md`, `docs/sdlc/README.md` (lecture).
- **Ce que ça exerce** : branch protection, checks requis, arbitrage entre sécurité et vitesse. Accessible sans coder.
- **Préparation formateur** : avoir les droits d'administration du dépôt GitHub pour appliquer la règle en fin de séance.

## S3-04 · Une Deploy Preview peut migrer la base de production

- **Type** : enquête · **Taille** : M · **Demandé par** : ex-DBA
- **Contexte** : Message de l'ex-DBA, resté épinglé : « J'ai vu une colonne apparaître en prod alors que la PR n'était pas encore relue. »
- **À faire** : Suivre le chemin d'une PR qui ajoute une migration : `package.json` (`build` = `prisma migrate deploy && next build`), `prisma.config.ts` (`DATABASE_URL_UNPOOLED`), README (« Une seule base, la vraie » et « Migrations de base de données »). Établir ce qui se passe quand Netlify construit la Deploy Preview de cette PR, puis quand la PR est fermée sans merge. Écrire la conclusion dans `docs/livraison/migrations-et-previews.md` : le scénario pas à pas, ce qui casse (une colonne supprimée par une preview casse la prod, une migration abandonnée reste en base), et au moins trois options (migrer seulement en production, une base par preview, migrations en deux temps « ajouter puis retirer ») avec leurs coûts. Tenir compte du choix assumé dans le README : les formations se bâtissent sur la base réelle.
- **Critères d'acceptation** :
  - Le document cite les lignes de `package.json` et `prisma.config.ts` qui causent le comportement.
  - Il décrit le cas « PR fermée sans merge » et ce qui reste dans `_prisma_migrations`.
  - Il compare au moins trois options et en recommande une.
  - Aucune commande n'a été lancée contre la base de production pendant l'enquête.
- **Fichiers concernés** : `package.json`, `prisma.config.ts`, `README.md` (lecture), `docs/livraison/migrations-et-previews.md` (nouveau).
- **Ce que ça exerce** : ce qu'une preview partage avec la production, lien entre build et migration, raisonnement sur un risque sans le provoquer.

## S3-05 · Ne plus migrer la base depuis une Deploy Preview

- **Type** : feature · **Taille** : M · **Demandé par** : ex-DBA
- **Contexte** : Suite de S3-04 : « Tant qu'on n'a pas mieux, une preview ne doit jamais toucher au schéma de la prod. »
- **À faire** : Remplacer `prisma migrate deploy` dans le script `build` par un script `scripts/migrer-au-build.ts` qui lit la variable Netlify `CONTEXT` : en `production`, il applique les migrations ; en `deploy-preview` ou `branch-deploy`, il lance `prisma migrate status` et échoue avec un message clair si une migration est en attente (« Cette PR contient une migration : la preview ne peut pas tourner sur la base partagée. Voir docs/livraison. ») ; hors Netlify (local, CI), il applique les migrations comme aujourd'hui. Mettre à jour la section « Migrations de base de données » du README.
- **Critères d'acceptation** :
  - `CONTEXT=deploy-preview` avec une migration en attente : le build échoue avec le message prévu, sans rien appliquer.
  - `CONTEXT=production` : les migrations sont appliquées comme avant.
  - Sans `CONTEXT` (job `build` de la CI) : le comportement est inchangé, la CI reste verte.
  - Un test Vitest couvre le choix de l'action selon `CONTEXT` (la fonction de décision est séparée de l'appel à Prisma).
- **Fichiers concernés** : `package.json`, `scripts/migrer-au-build.ts` (nouveau), `scripts/migrer-au-build.test.ts` (nouveau), `README.md`.
- **Ce que ça exerce** : comportement différent selon l'environnement de déploiement, faire échouer un build volontairement et lisiblement.

## S3-06 · Diviser par deux la durée de la CI

- **Type** : chore · **Taille** : M · **Demandé par** : ex-Scrum Master
- **Contexte** : Rétrospective archivée : « On attend la CI plus longtemps qu'on ne code. Trois jobs, trois `pnpm install`. »
- **À faire** : Relever la durée des dix dernières exécutions (`gh run list --workflow CI`, `gh run view <id>`), et le temps pris par chaque étape. Proposer et appliquer des gains dans `ci.yml` : cache du dossier `.next/cache`, regrouper typecheck et lint dans un seul job si l'installation domine, ne pas relancer le build quand seul `docs/` change (`paths-ignore`). Mesurer après.
- **Critères d'acceptation** :
  - La PR contient un tableau avant / après (durée totale, durée par job) sur au moins trois exécutions.
  - Les mêmes vérifications tournent qu'avant : typecheck, lint, build, test.
  - Une PR qui ne modifie que `docs/` ne lance pas le job `build`.
- **Fichiers concernés** : `.github/workflows/ci.yml` (chevauchement avec S3-02).
- **Ce que ça exerce** : mesurer avant d'optimiser, cache en CI, coût d'un job.

## S3-07 · Vérifier une Deploy Preview juste après son déploiement

- **Type** : feature · **Taille** : M · **Demandé par** : ex-SRE
- **Contexte** : L'ex-Head of Growth, passé chez Caro Pizzo, a posté une capture de TheSpoon en erreur 500 avec « Toujours en ligne ? ». Le déploiement était vert.
- **À faire** : Écrire `scripts/verifier-deploiement.ts`, qui prend une URL et vérifie : `/` répond 200 et contient « TheSpoon » ; une fiche `/restaurants/<id>` (id lu sur l'accueil) répond 200 ; `/api/admin` répond 404 ou 401, jamais 200 sans jeton ; `/connexion` répond 200. Ajouter un workflow `.github/workflows/verification-deploiement.yml` déclenché par `deployment_status` (statut `success`) qui lance le script sur l'URL déployée.
- **Critères d'acceptation** :
  - `pnpm tsx scripts/verifier-deploiement.ts http://localhost:3100` passe sur un `pnpm dev` avec `seed:dev`.
  - Le script sort en erreur, avec la vérification fautive, si une page répond autre chose que prévu.
  - Sur une PR de démonstration, le workflow tourne après la Deploy Preview et apparaît dans les checks.
  - Le script n'écrit rien (uniquement des `GET`).
- **Fichiers concernés** : `scripts/verifier-deploiement.ts` (nouveau), `.github/workflows/verification-deploiement.yml` (nouveau).
- **Ce que ça exerce** : test de fumée, différence entre « déployé » et « fonctionne », événement de déploiement GitHub.
- **Préparation formateur** : vérifier que l'intégration Netlify du dépôt publie bien des `deployment_status` sur GitHub (sinon, donner l'URL de la preview à la main).

## S3-08 · Écrire la procédure de mise en production et de retour arrière

- **Type** : chore · **Taille** : M · **Demandé par** : gérante d'un restaurant partenaire
- **Contexte** : Email au support : « Vendredi soir, pendant 40 minutes, vos clients ne pouvaient plus réserver. Qui décide quand vous changez le site, et qui peut revenir en arrière ? »
- **À faire** : Établir comment un merge sur `main` arrive en production (Netlify, déploiement automatique ou non, qui reçoit les échecs). Écrire `docs/livraison/mise-en-production.md` : les étapes d'une mise en production, la vérification après (S3-07 si disponible), le retour arrière dans Netlify (« Publish deploy » d'un déploiement précédent) et sa limite : il ne défait pas une migration déjà appliquée. Ajouter un modèle de message à envoyer aux restaurants en cas d'incident.
- **Critères d'acceptation** :
  - Le document a une checklist « avant », « pendant », « après » d'au plus 12 lignes en tout.
  - Le retour arrière est décrit avec les écrans Netlify à utiliser, et le cas « une migration est passée » a sa propre conduite à tenir.
  - Un relecteur non développeur peut dire, à la lecture, qui fait quoi.
- **Fichiers concernés** : `docs/livraison/mise-en-production.md` (nouveau), `README.md` (lien), `prisma/migrations/` (lecture).
- **Ce que ça exerce** : chemin vers la production, retour arrière d'une version vs d'un schéma, communication d'incident. Accessible sans coder.
- **Préparation formateur** : donner un accès en lecture au site Netlify (liste des déploiements), ou montrer l'écran en partage.

## S3-09 · Mises à jour de dépendances automatiques

- **Type** : chore · **Taille** : S · **Demandé par** : ex-DevOps
- **Contexte** : Ticket ouvert par l'ex-DevOps : « Personne n'a mis à jour une dépendance depuis septembre. Et `prisma` est figé à 7.10.0 alors que `@prisma/client` suit `^7.10.0`. »
- **À faire** : Ajouter `.github/dependabot.yml` : écosystème `npm` (pnpm est pris en charge) et `github-actions`, rythme hebdomadaire, les paquets `prisma` et `@prisma/*` regroupés dans une seule PR, `next` et `eslint-config-next` regroupés, les versions majeures dans des PR séparées. Écrire dans la PR pourquoi Prisma CLI et client doivent avancer ensemble.
- **Critères d'acceptation** :
  - Le fichier passe la validation GitHub (onglet Insights → Dependency graph → Dependabot sans erreur).
  - Les groupes `prisma` et `next` sont définis.
  - La première vague de PR Dependabot passe par la CI comme une PR normale.
- **Fichiers concernés** : `.github/dependabot.yml` (nouveau), `package.json` (lecture).
- **Ce que ça exerce** : maintenance continue, PR automatiques soumises aux mêmes vérifications.

## S3-10 · Une base Neon par Deploy Preview

- **Type** : feature · **Taille** : L · **Demandé par** : ex-architecte
- **Contexte** : Ébauche de l'ex-architecte : « Une preview devrait avoir sa propre copie de la base, jetée à la fermeture de la PR. Neon sait faire des branches. »
- **À faire** : Sur plusieurs séances. Créer une branche Neon à l'ouverture d'une PR (copie de la production, donc avec les vraies données de formation), y appliquer les migrations de la PR, faire construire la Deploy Preview contre cette branche, et supprimer la branche à la fermeture de la PR. Écrire la décision dans `docs/livraison/migrations-et-previews.md` en reprenant S3-04, en traitant ce que le README assume aujourd'hui (une seule base pour les formations) et les données personnelles copiées dans chaque branche.
- **Critères d'acceptation** :
  - Une PR qui ajoute une colonne : la preview fonctionne, la base de production n'a pas la colonne.
  - Fermer la PR supprime la branche Neon (visible dans la console Neon).
  - Une PR sans migration continue de fonctionner.
  - Le README décrit le nouveau fonctionnement.
- **Fichiers concernés** : `.github/workflows/base-preview.yml` (nouveau), `netlify.toml` (après S3-14), `scripts/migrer-au-build.ts` (après S3-05), `README.md`.
- **Ce que ça exerce** : environnement de prévisualisation complet, cycle de vie lié à une PR, coût et données d'une copie.
- **Préparation formateur** : clé API Neon et identifiant du projet Neon en secrets GitHub (`NEON_API_KEY`, `NEON_PROJECT_ID`), jeton Netlify si la variable doit être posée côté Netlify ; vérifier le quota de branches du plan Neon.

## S3-11 · Un test qui passe une fois sur trois

- **Type** : bug · **Taille** : M · **Demandé par** : ex-QA
- **Contexte** : Dernier message de l'ex-QA : « Le job build est rouge une fois sur trois. J'ai relancé jusqu'à ce que ça passe. »
- **À faire** : Sur la branche préparée, relancer la CI plusieurs fois (`gh run rerun`), constater l'instabilité, trouver le test en cause et la raison (ici, l'ordre des fichiers de test sur la base partagée). Corriger le test sans le supprimer : isoler ses données (préfixe unique, comme `src/lib/console-formateur.integration.test.ts` le fait avec `randomUUID`). Ajouter dans `REVIEW.md` une ligne sur les tests qui dépendent de l'ordre d'exécution ou de l'heure réelle.
- **Critères d'acceptation** :
  - La cause est écrite dans la PR en deux phrases.
  - La suite passe dix fois de suite en local (`for i in $(seq 10); do pnpm test || break; done`), et la CI passe trois fois de suite sur la PR.
  - Le test vérifie toujours la même règle qu'avant.
- **Fichiers concernés** : `src/lib/instable-a.test.ts`, `src/lib/instable-b.test.ts` (plantés), `REVIEW.md`.
- **Ce que ça exerce** : diagnostiquer un check instable au lieu de relancer, tests d'intégration qui partagent une base.
- **Préparation formateur** : pousser une branche `ci/test-instable` (et ouvrir sa PR) avec deux fichiers de test qui partagent la base de la CI : `src/lib/instable-a.test.ts` crée un restaurant nommé « Test instable » puis le supprime en `afterAll` ; `src/lib/instable-b.test.ts` vérifie que `prisma.restaurant.count({ where: { nom: { startsWith: "Test instable" } } })` vaut 0. Vitest exécute les fichiers en parallèle : le second échoue selon l'ordre d'arrivée. Vérifier avant la séance qu'il échoue au moins une fois sur cinq.

## S3-12 · Vérifier le jeu de formation dans la CI

- **Type** : chore · **Taille** : S · **Demandé par** : ex-CPO
- **Contexte** : Note de l'ex-CPO : « Le jeu de formation sert à toutes les démos. S'il ne se génère plus, on le découvre devant le client. »
- **À faire** : Ajouter un workflow `.github/workflows/jeu-formation.yml`, déclenché sur les PR qui touchent `scripts/jeu-formation/**` ou `src/lib/api-admin/**`, qui lance `pnpm jeu-formation plan` avec `JEU_FORMATION_DOSSIER` dans un dossier temporaire du runner et publie le bilan dans le résumé du job (`$GITHUB_STEP_SUMMARY`). Ajouter une étape qui échoue si `identifiants.csv` ou un dossier `.jeu-formation/` est suivi par git.
- **Critères d'acceptation** :
  - Une PR qui modifie `scripts/jeu-formation/generer.ts` déclenche le job, et le bilan apparaît dans le résumé.
  - Une PR qui ne touche pas ces chemins ne le déclenche pas.
  - Un `identifiants.csv` ajouté au dépôt fait échouer le job.
  - Aucun `ADMIN_API_TOKEN` n'est utilisé : on génère, on n'injecte pas.
- **Fichiers concernés** : `.github/workflows/jeu-formation.yml` (nouveau), `scripts/jeu-formation/index.ts` (lecture).
- **Ce que ça exerce** : déclencher un job selon les chemins modifiés, résumé de job, contrôle qui empêche un fichier sensible d'entrer.

## S3-13 · Refuser une PR dont le schéma et les migrations divergent

- **Type** : feature · **Taille** : M · **Demandé par** : ex-DBA
- **Contexte** : README, section migrations : « trois incidents de prod ont déjà été causés par un schéma poussé à la main ». L'ex-DBA voulait que la CI le refuse.
- **À faire** : Ajouter un workflow `.github/workflows/migrations.yml` sur les PR qui touchent `prisma/**` : (1) échouer si `prisma/schema.prisma` décrit un état que les migrations ne produisent pas (`prisma migrate diff` entre le dossier de migrations et le schéma, avec une base Postgres de service ; vérifier la syntaxe exacte avec `pnpm prisma migrate diff --help`, Prisma 7) ; (2) échouer si une migration existante est modifiée ou supprimée (`git diff --name-status origin/main...HEAD -- prisma/migrations`).
- **Critères d'acceptation** :
  - Une branche de test qui modifie `schema.prisma` sans migration : job rouge, message qui dit quoi faire (`pnpm db:migrate`).
  - Une branche qui modifie `prisma/migrations/20260914000000_init/migration.sql` : job rouge.
  - Une PR avec un schéma et une nouvelle migration cohérents : job vert.
- **Fichiers concernés** : `.github/workflows/migrations.yml` (nouveau), `prisma/schema.prisma`, `prisma/migrations/` (lecture).
- **Ce que ça exerce** : transformer une règle écrite (« on ne modifie jamais une ancienne migration ») en vérification automatique.

## S3-14 · Écrire dans le dépôt ce que Netlify construit

- **Type** : chore · **Taille** : M · **Demandé par** : ex-SRE
- **Contexte** : Il n'y a pas de `netlify.toml` dans le dépôt. L'ex-SRE avait noté : « La config de build vit dans l'interface Netlify. Personne ne la relit, personne ne la versionne. »
- **À faire** : Relever dans l'interface Netlify (ou le dernier log de build) la commande de build, le dossier publié, la version de Node utilisée et les contextes de déploiement. Créer `netlify.toml` qui reprend ces réglages, avec les sections `[context.production]` et `[context.deploy-preview]`. Vérifier l'accord entre `.nvmrc` (24.14.1), `engines` de `package.json` (`>=20.9.0`) et la version de Node vue dans le log ; aligner `engines`. Ne mettre aucun secret dans le fichier.
- **Critères d'acceptation** :
  - La Deploy Preview de la PR se construit avec `netlify.toml` et le log Netlify mentionne la lecture du fichier.
  - La version de Node du log Netlify est celle de `.nvmrc`.
  - Le fichier ne contient aucune valeur de variable sensible (relu par un second binôme).
- **Fichiers concernés** : `netlify.toml` (nouveau), `package.json` (`engines`), `.nvmrc` (lecture). Chevauchement avec S3-05 sur `package.json` : merger S3-14 d'abord.
- **Ce que ça exerce** : configuration versionnée vs cachée dans un outil, cohérence des versions entre local, CI et hébergeur. La partie relevé est accessible sans coder.
- **Préparation formateur** : accès en lecture au site Netlify ou au dernier log de build.

## S3-15 · Construire dans GitHub Actions et livrer le résultat à Netlify

- **Type** : feature · **Taille** : L · **Demandé par** : ex-CTO
- **Contexte** : Dernière note de l'ex-CTO : « On construit deux fois : une fois en CI pour vérifier, une fois chez Netlify pour livrer. Ce qu'on livre n'est pas ce qu'on a testé. »
- **À faire** : Sur plusieurs séances. Construire l'application dans un job GitHub Actions après les vérifications, puis la déployer avec `netlify deploy --build` ou une sortie préconstruite (preview sur une PR, production sur `main` seulement après les checks). Couper le build automatique côté Netlify une fois la chaîne en place. Garder les migrations au bon endroit (voir S3-05).
- **Critères d'acceptation** :
  - Sur une PR, l'URL de preview est postée par le workflow, et l'artefact déployé est celui construit par ce workflow.
  - Sur `main`, la production n'est déployée que si typecheck, lint et test sont verts.
  - Le build Netlify automatique est désactivé et le README explique la nouvelle chaîne.
  - Un retour arrière reste possible depuis Netlify (S3-08).
- **Fichiers concernés** : `.github/workflows/livraison.yml` (nouveau), `netlify.toml` (après S3-14), `README.md`.
- **Ce que ça exerce** : pipeline de livraison complet, « ce qu'on livre est ce qu'on a vérifié », secrets de déploiement en CI.
- **Préparation formateur** : secrets GitHub `NETLIFY_AUTH_TOKEN` et `NETLIFY_SITE_ID` ; prévoir de couper le build automatique Netlify uniquement quand le formateur le valide (une seule production).

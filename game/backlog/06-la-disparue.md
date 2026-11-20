# Affaire N° 6 · La Disparue — Environnements

Référence : `origin/main` du dépôt TheSpoon (commit `d2dc6c8`, 27 migrations, avec l'assistant de recherche et la console formateur). Ce carnet fait travailler la frontière entre développement local, Deploy Preview et production sur TheSpoon : une seule base Neon partagée par les previews et la production (README, « Une seule base, la vraie »), `pnpm build` qui lance `prisma migrate deploy` avant `next build`, `prisma.config.ts` et `DATABASE_URL_UNPOOLED`, des scripts qui écrivent directement en base (`seed:dev`, `creer-compte`, `jeu-formation`), des photos sur disque en local et sur Netlify Blobs ailleurs, et un serveur de production en UTC. Les items S6-01, S6-04, S6-12 et S6-15 conviennent à des binômes sans profil développeur ; S6-09 aussi, avec un binôme mixte. Aucun item ne se lance contre la vraie base partagée : tout ce qui demande une base distante utilise le projet Neon de bac à sable préparé par le formateur. Chevauchements à surveiller : S6-03 est le seul à modifier `prisma/schema.prisma`, mais S6-03 et S6-11 ajoutent chacun une migration (vérifier l'ordre des dossiers au merge) ; S6-05 crée un garde-fou que S6-08 et S6-10 réutilisent (faire S6-05 en premier ou se mettre d'accord sur le nom du fichier) ; S6-06, S6-08 et S6-10 ajoutent des scripts à `package.json` ; S6-06 et S6-10 touchent `.env.example` ; S6-02 et S6-13 lisent tous deux le contexte Netlify ; S6-14 est le seul à toucher `.github/workflows/ci.yml` ; S6-15 est le seul à modifier `README.md`.

| ID | Titre | Type | Taille | Demandé par |
|---|---|---|---|---|
| S6-01 | Une preview applique ses migrations à la base de production | enquête | S | ex-DevOps |
| S6-02 | Une base Neon par Deploy Preview | feature | L | ex-SRE |
| S6-03 | Supprimer `Restaurant.horaires` sans rien perdre | chore | M | ex-DBA |
| S6-04 | Renommer `Booking` en `Reservation` : le plan en plusieurs déploiements | enquête | M | ex-architecte |
| S6-05 | `seed:dev` ne doit jamais vider une base distante | bug | S | ex-DBA |
| S6-06 | Les variables d'environnement, d'un environnement à l'autre | chore | M | ex-DevOps |
| S6-07 | La référence d'un avoir change de mois en production | bug | M | comptable d'un restaurant partenaire |
| S6-08 | Photos cassées avec une base venue d'ailleurs | enquête | M | ex-QA |
| S6-09 | Restaurer la base à une heure donnée | enquête | M | ex-SRE |
| S6-10 | Une copie anonymisée de la production pour le dev | feature | L | ex-CPO |
| S6-11 | Le schéma réel ne correspond pas à l'historique des migrations | enquête | M | ex-DBA |
| S6-12 | Seuil de crédit d'office et interrupteurs : une valeur, combien d'environnements ? | enquête | S | ex-CPO |
| S6-13 | Dire à l'écran qu'on est sur une prévisualisation | feature | M | gérant d'un restaurant partenaire |
| S6-14 | Tester les migrations sur une base déjà remplie, en CI | chore | M | ex-DevOps |
| S6-15 | Démarrer en local depuis zéro, en suivant le README à la lettre | enquête | S | ex-Scrum Master |

---

## S6-01 · Une preview applique ses migrations à la base de production

- **Type** : enquête · **Taille** : S · **Demandé par** : ex-DevOps
- **Contexte** : Dernier message de l'ex-DevOps dans le canal des déploiements : « Rappel : ouvrir une PR avec une migration, c'est migrer la prod. Pas au merge. À l'ouverture. »
- **À faire** : Vérifier l'affirmation à partir de `package.json` (script `build`), `prisma.config.ts`, du README (« Une seule base, la vraie » et « Migrations de base de données ») et de l'historique (`git show d053898` : la preview Netlify a échoué sur la base Neon partagée). Le dépôt n'a pas de `netlify.toml` : la commande de build et les variables par contexte sont réglées dans l'interface Netlify. Écrire `docs/environnements/previews-et-migrations.md` : la chronologie d'une PR qui porte une migration (ouverture, build de la preview, merge, build de production), puis la réponse argumentée à trois questions : que devient la migration si la PR est fermée sans merge ? que se passe-t-il quand deux PR ouvertes portent chacune une migration ? qu'est-ce qu'une migration peut faire sans casser la production qui tourne encore avec l'ancien code ?
- **Critères d'acceptation** :
  - La chronologie cite pour chaque étape le fichier ou le réglage qui la décide.
  - Chaque réponse s'appuie sur la documentation Prisma de `migrate deploy` et `migrate status` (lien dans le document), pas sur une supposition.
  - Le document finit par une règle d'une phrase que l'équipe peut afficher dans les PR.
- **Fichiers concernés** : `docs/environnements/previews-et-migrations.md` (nouveau) ; lecture de `package.json`, `prisma.config.ts`, `README.md`, `prisma/migrations/`.
- **Ce que ça exerce** : ce qu'une preview partage avec la production ; une migration se déploie avant le code qui l'utilise.
- **Préparation formateur** : une capture des réglages Netlify du site (commande de build, contextes de déploiement, liste des noms de variables par contexte, sans les valeurs).

## S6-02 · Une base Neon par Deploy Preview

- **Type** : feature · **Taille** : L · **Demandé par** : ex-SRE
- **Contexte** : Rapport d'incident de l'ex-SRE, septembre : « Une migration en preview a échoué sur la base de prod. Rien de cassé cette fois, parce que Prisma joue chaque migration dans une transaction. La prochaine fois, peut-être pas. »
- **À faire** : Première session : écrire `docs/adr/0007-base-par-preview.md` qui compare au moins deux options pour donner à chaque Deploy Preview sa propre branche Neon (intégration Neon de Netlify ; GitHub Action de Neon qui crée une branche à l'ouverture de la PR et pose `DATABASE_URL` et `DATABASE_URL_UNPOOLED` pour le contexte de la branche ; création dans le build). L'ADR doit répondre à la raison donnée par le README pour la base partagée (les formations se bâtissent sur l'écosystème réel) : une branche Neon part d'une copie des données de production, ce qui la préserve. Il doit aussi traiter la suppression des branches à la fermeture de la PR, les photos (Netlify Blobs reste partagé, voir S6-08) et le coût. Sessions suivantes : prototype de l'option retenue sur le site et le projet de bac à sable.
- **Critères d'acceptation** :
  - L'ADR liste pour chaque option : où vit la configuration (dépôt ou interface), qui crée et qui supprime la branche, ce qui se passe pour `prisma migrate deploy`.
  - Sur le bac à sable : une PR qui ajoute une migration crée une branche Neon ; la table de la migration existe sur la branche et pas sur la base principale (requête SQL à l'appui).
  - À la fermeture de la PR, la branche est supprimée (capture de la console Neon).
- **Fichiers concernés** : `docs/adr/0007-base-par-preview.md` (nouveau), puis selon l'option : `.github/workflows/` (nouveau fichier, pas `ci.yml`), `netlify.toml` (nouveau). Chevauchement : S6-13 (contexte Netlify), S6-14 (workflows).
- **Ce que ça exerce** : isoler les environnements ; branches de base de données ; décider avec un ADR avant de toucher à l'infrastructure.
- **Préparation formateur** : un site Netlify et un projet Neon de bac à sable reliés à un fork du dépôt, une clé d'API Neon limitée à ce projet ; jamais le site ni la base réels.

## S6-03 · Supprimer `Restaurant.horaires` sans rien perdre

- **Type** : chore · **Taille** : M · **Demandé par** : ex-DBA
- **Contexte** : Le commentaire de `Restaurant.horaires` dans `prisma/schema.prisma` renvoie au ticket « Supprimer Restaurant.horaires », jamais traité. La migration `20260921160000_horaires_ouverture_structures` a volontairement gardé la colonne.
- **À faire** : Lancer d'abord, en local, la requête de vérification écrite en fin de cette migration ; ajouter à la main deux restaurants avec un texte d'horaires que la reprise ne sait pas lire, pour avoir un cas. Écrire une nouvelle migration qui copie les textes non repris dans une table d'archive (nom français, avec `restaurantId`, `nom`, `horaires`, date d'archivage) avant toute suppression. Ensuite, la suppression elle-même : la base est partagée entre previews et production (voir S6-01), donc un `DROP COLUMN` dans une PR casserait la production qui lit encore ce champ avant même le merge. Proposer et documenter dans la PR une séquence sûre en plusieurs PR (indice : `prisma migrate dev --create-only`), et livrer la première. Ne jamais modifier la migration existante. Garder le libellé `horaires: "Horaires"` de `src/app/admin/restaurants/[id]/page.tsx` : il sert à afficher l'ancien journal d'audit.
- **Critères d'acceptation** :
  - Un nouveau dossier dans `prisma/migrations/` ; `git diff main -- prisma/migrations/20260921160000_horaires_ouverture_structures` est vide.
  - Sur la base locale, après `pnpm db:migrate`, les deux restaurants de test figurent dans la table d'archive avec leur texte.
  - La migration passe aussi sur une base neuve (CI) sans erreur.
  - La séquence complète (PR 1, PR 2…) est décrite dans la PR, avec pour chacune ce que la production lit à ce moment-là.
- **Fichiers concernés** : `prisma/schema.prisma`, `prisma/migrations/<nouvelle>/migration.sql`. Chevauchement : S6-11 ajoute aussi une migration.
- **Ce que ça exerce** : migration destructive rendue sûre ; expand/contract ; archiver avant de supprimer.
- **Préparation formateur** : le résultat de la requête de vérification sur la base partagée (liste des restaurants concernés, ou « aucune ligne »), pour que le binôme sache si l'archive a un vrai contenu.

## S6-04 · Renommer `Booking` en `Reservation` : le plan en plusieurs déploiements

- **Type** : enquête · **Taille** : M · **Demandé par** : ex-architecte
- **Contexte** : Ticket de l'ex-architecte : « Tout le domaine est en français sauf la table centrale. `Booking` doit devenir `Reservation`. Sans couper le service. »
- **À faire** : Ne pas faire le renommage (il toucherait des dizaines de fichiers). Écrire `docs/environnements/renommer-booking.md` : pourquoi un `ALTER TABLE "Booking" RENAME TO "Reservation"` dans une PR casse la production dès le build de la preview ; la piste qui ne touche pas la base (renommer le modèle Prisma en gardant `@@map("Booking")`) et ce qu'elle laisse de côté ; la piste complète en plusieurs déploiements (créer, écrire des deux côtés, basculer la lecture, supprimer) avec, pour chaque étape, l'état de la base, ce que lit la production et ce que lit une preview. Compter les fichiers touchés (`git grep -l "prisma.booking\|Booking" -- src scripts | wc -l`) et repérer les requêtes SQL brutes qui citent `"Booking"` en dur (par exemple `src/lib/reservation.ts`, `src/lib/api-admin/creations.ts`).
- **Critères d'acceptation** :
  - Les deux pistes sont décrites avec leurs étapes, et le document en recommande une.
  - La liste des requêtes SQL brutes à adapter est complète (`git grep -n '"Booking"'` à l'appui).
  - Le document indique ce que deviennent les migrations passées qui citent `"Booking"` (réponse attendue : elles ne changent pas).
- **Fichiers concernés** : `docs/environnements/renommer-booking.md` (nouveau) ; lecture de `prisma/schema.prisma`, `src/lib/`, `prisma/migrations/`.
- **Ce que ça exerce** : migrations compatibles avec l'ancien et le nouveau code (expand/contract) ; distinguer le nom dans le code du nom dans la base.

## S6-05 · `seed:dev` ne doit jamais vider une base distante

- **Type** : bug · **Taille** : S · **Demandé par** : ex-DBA
- **Contexte** : Note de l'ex-DBA : « Le README dit de ne jamais lancer `seed:dev` contre une base déployée. Le script, lui, ne le sait pas. »
- **À faire** : `scripts/seed-dev.ts` commence par `deleteMany` sur le journal d'audit, le staff, les plats, les factures et les restaurants, sans regarder `DATABASE_URL`. Écrire une fonction `baseJetable(url)` dans un fichier partagé `scripts/base-locale.ts` (vrai pour `localhost`, `127.0.0.1`, `::1`, faux pour tout le reste, y compris une URL illisible), et faire échouer `seed:dev` avant toute suppression si la base n'est pas locale, en affichant l'hôte visé (jamais le mot de passe). Pas de variable de contournement.
- **Critères d'acceptation** :
  - Un test Vitest couvre au moins : URL locale, URL `*.neon.tech`, URL avec `?host=` vers un socket, chaîne vide.
  - `DATABASE_URL="postgresql://x:y@ep-test.eu-central-1.aws.neon.tech/neondb" pnpm seed:dev` s'arrête avec un code de sortie non nul et un message en français, sans connexion à la base.
  - `pnpm seed:dev` fonctionne toujours en local et dans le job CI.
- **Fichiers concernés** : `scripts/seed-dev.ts`, `scripts/base-locale.ts` (nouveau), son test. Réutilisé par S6-08 et S6-10.
- **Ce que ça exerce** : un script destructeur doit savoir sur quel environnement il tourne ; garde-fou plutôt que consigne.

## S6-06 · Les variables d'environnement, d'un environnement à l'autre

- **Type** : chore · **Taille** : M · **Demandé par** : ex-DevOps
- **Contexte** : Post-mortem de l'ex-DevOps : « `ADMIN_API_TOKEN` posé en preview, oublié en production. On a cherché deux heures pourquoi l'API répondait 404. » Le journal Git montre la même histoire pour l'assistant de recherche : « l'assistant échouait en production (403 de l'AI Gateway…) ».
- **À faire** : Faire la liste de toutes les variables lues par le code (`git grep -n "process.env" -- src scripts prisma.config.ts next.config.ts`) : celles validées par `src/lib/env.ts`, celles lues ailleurs (`DATABASE_URL_UNPOOLED`, `NETLIFY_BLOBS_CONTEXT`, `NODE_ENV`, `COMPTE_*`, `API_URL`, `JEU_FORMATION_*`), et celles qu'un environnement pose sans qu'on le demande : sur Netlify, l'AI Gateway injecte `ANTHROPIC_API_KEY` et `ANTHROPIC_BASE_URL` dans les fonctions, ce qui explique pourquoi `src/lib/chatbot/agent.ts` fait passer `OPENROUTER_API_KEY` en premier. Même question pour `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (connexion Google des formateurs) : présentes où, absentes où, et ce que voit l'utilisateur quand elles manquent. Écrire `scripts/verifier-env.ts` (`pnpm verifier-env`) qui signale : une variable de `env.ts` absente de `.env.example` ; et, avec `--netlify <contexte>`, une variable attendue absente de `netlify env:list --context <contexte> --json`. Le script n'affiche jamais une valeur. Compléter `.env.example` avec ce qui manque, commenté.
- **Critères d'acceptation** :
  - `pnpm verifier-env` passe sur `main` une fois `.env.example` complété, et échoue si on retire `BETTER_AUTH_URL` de `.env.example` (sortie collée dans la PR).
  - Aucune valeur de variable n'apparaît dans la sortie, même avec `--netlify` (vérifié en relisant le code et la sortie).
  - Le tableau des variables (nom, qui la lit, local / preview / production, obligatoire ou non) est dans la description de la PR.
- **Fichiers concernés** : `scripts/verifier-env.ts` (nouveau), `.env.example`, `package.json` ; lecture de `src/lib/env.ts`, `src/lib/chatbot/agent.ts`, `src/lib/formateurs.ts`. Chevauchement : S6-10 (`.env.example`, `package.json`).
- **Ce que ça exerce** : parité entre environnements ; configuration déclarée en un seul endroit.
- **Préparation formateur** : pour l'option `--netlify`, un accès en lecture aux variables du site de bac à sable (ou lancer la commande soi-même devant le binôme).

## S6-07 · La référence d'un avoir change de mois en production

- **Type** : bug · **Taille** : M · **Demandé par** : comptable d'un restaurant partenaire
- **Contexte** : Courriel de la comptable d'un restaurant partenaire : « Votre avoir émis le 1er octobre porte la référence AV-202609. Notre logiciel le range en septembre, sur une facture déjà clôturée. »
- **À faire** : `referenceAvoir` (`src/lib/facturation.ts`) prend l'année et le mois avec `getFullYear()` et `getMonth()`, qui suivent le fuseau du serveur : Paris sur le poste d'un développeur, UTC sur Netlify. Écrire d'abord un test qui échoue sous `TZ=UTC` : un avoir émis le `2026-09-30T22:30:00Z` (1er octobre à 0 h 30 à Paris) doit donner `AV-202610`. Corriger avec les fonctions de `src/lib/fuseau.ts` (`composantesLocales`). La référence n'est pas stockée, elle est recalculée à l'affichage : les avoirs déjà émis vont donc changer de référence à l'écran. Écrire la requête SQL qui liste les avoirs concernés (émis les derniers jours de mois entre 22 h et minuit UTC), pour prévenir les restaurants.
- **Critères d'acceptation** :
  - `TZ=UTC pnpm test src/lib/facturation.test.ts` échoue avant la correction (commit du test seul) et passe après.
  - `TZ=Europe/Paris` et `TZ=Pacific/Auckland` passent aussi.
  - `git grep -n "getFullYear\|getMonth()" -- src/lib` ne renvoie plus rien.
  - La requête SQL des avoirs concernés est dans la PR, testée en local sur des avoirs créés pour l'occasion.
- **Fichiers concernés** : `src/lib/facturation.ts`, `src/lib/facturation.test.ts`.
- **Ce que ça exerce** : une différence entre dev et production qui ne se voit qu'en production ; rendre un test indépendant de la machine ; mesurer l'effet d'un correctif sur des données déjà en place.

## S6-08 · Photos cassées avec une base venue d'ailleurs

- **Type** : enquête · **Taille** : M · **Demandé par** : ex-QA
- **Contexte** : Ticket de l'ex-QA : « J'ai branché mon poste sur une copie de la base : la moitié des cartes de l'accueil affichent une image cassée. En prod tout va bien. »
- **À faire** : Reproduire en local : poser `photoMisAJourLe` sur un restaurant et un plat qui n'ont pas de fichier dans `.local-blobs/` (`UPDATE … SET "photoMisAJourLe" = now()`), puis ouvrir l'accueil et la fiche. Expliquer le chemin : `photoRestaurant` / `photoPlat` (`src/lib/images.ts`) font confiance à la date, la route `/api/restaurants/[id]/photo` répond 404, `PhotoCouverture` affiche un `<img>` sans repli. Expliquer aussi ce que partagent preview et production côté photos : `creerStorePhotos` (`src/lib/photos.ts`) utilise `getStore`, un store commun à tout le site Netlify. Livrer `scripts/verifier-photos.ts` (`pnpm verifier-photos`) qui liste les restaurants et plats dont la photo annoncée est introuvable dans le store courant, avec une option `--oublier` qui remet `photoMisAJourLe` à `null`, refusée hors base locale (garde-fou de S6-05).
- **Critères d'acceptation** :
  - Le script trouve exactement les deux entités modifiées à la main.
  - Après `--oublier`, l'accueil affiche l'image de repli par type de cuisine (capture dans la PR).
  - `--oublier` contre une URL non locale s'arrête sans rien écrire.
  - L'explication (cinq à dix lignes, avec chemins) est dans la PR, y compris la réponse à : « une photo envoyée depuis une preview remplace-t-elle celle de la production ? ».
- **Fichiers concernés** : `scripts/verifier-photos.ts` (nouveau), `package.json` ; lecture de `src/lib/photos.ts`, `src/lib/images.ts`, `src/components/PhotoCouverture.tsx`, `src/app/api/restaurants/[id]/photo/route.ts`. Chevauchements : S6-05 (garde-fou), S6-06 (`package.json`).
- **Ce que ça exerce** : la donnée ne vit pas qu'en base ; stockage de fichiers par environnement.

## S6-09 · Restaurer la base à une heure donnée

- **Type** : enquête · **Taille** : M · **Demandé par** : ex-SRE
- **Contexte** : Page de wiki de l'ex-SRE, titre « Procédure de restauration », contenu : « À écrire. »
- **À faire** : Sur le projet Neon de bac à sable, un incident a eu lieu à une heure connue à quelques minutes près (des lignes ont disparu). Retrouver l'heure à partir des données (dernière `createdAt` cohérente, trou dans une série), créer une branche Neon à un instant juste avant, comparer les comptes de lignes avec la branche principale, puis choisir : restaurer toute la base (on perd ce qui a été écrit depuis) ou recopier seulement les lignes perdues depuis la branche. Chronométrer. Écrire `docs/environnements/restauration.md` : qui peut le faire, les étapes avec captures, la durée mesurée, la fenêtre de rétention du projet (à lire dans la console), ce qu'on perd dans chaque option, ce qui n'est pas dans la base et ne revient pas (Netlify Blobs).
- **Critères d'acceptation** :
  - Les lignes disparues sont retrouvées : comptes avant incident, après incident, après restauration, dans un tableau.
  - La procédure tient sur une page et une autre paire la suit sans aide (relecture croisée en fin de session).
  - La durée totale et la fenêtre de rétention figurent en tête du document.
- **Fichiers concernés** : `docs/environnements/restauration.md` (nouveau).
- **Ce que ça exerce** : sauvegarde et restauration à un instant donné ; un plan de restauration non testé n'existe pas.
- **Préparation formateur** : un projet Neon de bac à sable rempli par `pnpm jeu-formation injecter pilote` ; un incident destructeur lancé à une heure notée (par exemple la suppression des avis d'un restaurant, avec recalcul de sa note) ; un accès à la console permettant de créer une branche à un instant passé.

## S6-10 · Une copie anonymisée de la production pour le dev

- **Type** : feature · **Taille** : L · **Demandé par** : ex-CPO
- **Contexte** : Message de l'ex-CPO : « Les bugs de la prod ne se reproduisent jamais sur le seed : trois restaurants et deux comptes staff. Il nous faut de vraies données, sans les vraies personnes. »
- **À faire** : Écrire `scripts/copie-anonymisee.ts` (`pnpm copie-anonymisee`) qui copie une base source (`SOURCE_DATABASE_URL`, lecture seule) vers la base locale (`DATABASE_URL`, refusée si elle n'est pas locale : garde-fou de S6-05), puis anonymise : `user` (nom, email), `RestaurantContact`, `Staff` et `Formateur` (nom, email ; les formateurs sont de vraies personnes d'Hymaia), `DemandeContactRestaurateur` (nom, email, message), `Avis.commentaire`, `Dossier.commentaire` et `PropositionAssistant.demande` (texte libre, saisi sans connexion, qui peut contenir n'importe quoi), vide les tables de sessions et de vérification des quatre populations, et remplace les mots de passe des tables de comptes par le hachage de `password123` (`hashPassword` de `better-auth/crypto`, comme `scripts/seed-dev.ts`). Les restaurants, plats, réservations et factures restent tels quels. Première session : la liste des colonnes à traiter, vérifiée contre `prisma/schema.prisma`, et la copie sans anonymisation sur le bac à sable.
- **Critères d'acceptation** :
  - Après copie, `select count(*) from "user" where email not like '%@example.test'` renvoie 0 ; même contrôle sur `RestaurantContact`, `Staff`, `Formateur`, `DemandeContactRestaurateur`.
  - Les tables de sessions des quatre populations sont vides.
  - On se connecte en local sur `/connexion`, `/connexion-restaurant`, `/connexion-admin` et `/connexion-formateur` avec un compte copié et `password123`.
  - Les comptes de lignes de `Restaurant`, `Booking`, `Facture` sont identiques entre source et copie.
  - Le script refuse une `DATABASE_URL` non locale.
- **Fichiers concernés** : `scripts/copie-anonymisee.ts` (nouveau), `package.json`, `.env.example` (`SOURCE_DATABASE_URL` commentée). Chevauchements : S6-05, S6-06.
- **Ce que ça exerce** : données de dev réalistes ; données personnelles entre environnements ; inventaire des champs sensibles d'un schéma.
- **Préparation formateur** : une base source sur le projet Neon de bac à sable, remplie par le jeu de formation, et l'URL d'un rôle en lecture seule sur cette base.

## S6-11 · Le schéma réel ne correspond pas à l'historique des migrations

- **Type** : enquête · **Taille** : M · **Demandé par** : ex-DBA
- **Contexte** : Le README le dit : « `_prisma_migrations` n'est pas une preuve ». Deux migrations de réparation en témoignent (`20260915110000_repare_auth_restaurant_partenaire`, `20260917120000_index_unique_email_contact`). L'ex-DBA a laissé un dernier dump avec la mention : « Il y a encore quelque chose. »
- **À faire** : Restaurer le dump fourni dans une base locale à part (`createdb thespoon_derive`). Constater que `prisma migrate status` dit tout appliqué. Trouver les écarts avec le schéma attendu, avec `prisma migrate diff` (les options ont changé en Prisma 7 : lire `pnpm prisma migrate diff --help`) et les deux requêtes `pg_indexes` / `information_schema.columns` du README. Pour chaque écart : son effet visible dans le produit, et s'il faut le réparer. Écrire une migration de réparation idempotente (`IF NOT EXISTS`, `DO $$ … EXCEPTION`) qui passe sur la base abîmée comme sur une base saine.
- **Critères d'acceptation** :
  - Tous les écarts plantés sont listés dans la PR, avec la commande qui les a révélés.
  - La migration de réparation, appliquée deux fois sur la base abîmée, ne produit pas d'erreur ; appliquée sur une base neuve (`pnpm db:migrate` en local, puis CI), non plus.
  - Après réparation, `prisma migrate diff` entre la base abîmée et le schéma ne signale plus rien.
  - Un écart volontairement non réparé (s'il y en a un) est justifié par écrit.
- **Fichiers concernés** : `prisma/migrations/<nouvelle>/migration.sql`. Chevauchement : S6-03 (autre migration).
- **Ce que ça exerce** : dérive entre historique et réalité ; diagnostic par comparaison du schéma réel ; migration de réparation.
- **Préparation formateur** : un fichier `derive.sql` (dump d'une base où toutes les migrations sont marquées appliquées) avec trois écarts plantés à la main : l'index unique `Avis_restaurantId_userId_key` supprimé, une colonne `Restaurant.telephone` ajoutée par `db push`, et la clé étrangère `LigneFacture_bookingId_fkey` absente. Garder la liste pour la correction.

## S6-12 · Seuil de crédit d'office et interrupteurs : une valeur, combien d'environnements ?

- **Type** : enquête · **Taille** : S · **Demandé par** : ex-CPO
- **Contexte** : Question de l'ex-CPO restée sans réponse : « Si je baisse le seuil à 10 € sur une preview pour tester, est-ce que je l'ai baissé pour les 50 restaurants ? »
- **À faire** : Le seuil vit dans `ConfigContestation` (une seule ligne `singleton`), créé à la première lecture par `getConfigContestation` (`src/lib/contestation.ts`, un `upsert`), modifiable dans `/admin/contestation`, avec une valeur par défaut dans le code (`SEUIL_CREDIT_OFFICE_PAR_DEFAUT_CENTIMES`) et une autre supposée par le jeu de formation (`SEUIL_SUPPOSE_CENTIMES` dans `scripts/jeu-formation/generer.ts`, vérifiée à l'injection). Même mécanique pour les interrupteurs de la console formateur : `Fonctionnalite` (`src/lib/fonctionnalites.ts`, page `/formateur/fonctionnalites`), dont le commentaire dit « Globales : la production et les Deploy Previews partagent la même base ». Répondre à la question de l'ex-CPO, puis à : quelle valeur a une base locale neuve ? une branche Neon (si S6-02 aboutit) ? que se passe-t-il si la valeur par défaut du code change ? Rendre une note d'une page avec une recommandation (garder en base, passer en variable d'environnement, ou autre), et ce qu'elle coûte.
- **Critères d'acceptation** :
  - Chaque réponse cite la ligne de code qui la justifie.
  - La recommandation dit ce qui changerait pour le staff qui règle le seuil aujourd'hui sans déploiement.
  - Le constat « une page qui s'affiche écrit en base » (`upsert` à la lecture) est expliqué en mots simples.
- **Fichiers concernés** : `docs/environnements/reglages-en-base.md` (nouveau) ; lecture de `src/lib/contestation.ts`, `src/app/admin/contestation/`, `src/lib/fonctionnalites.ts`, `src/app/formateur/fonctionnalites/`, `scripts/jeu-formation/`.
- **Ce que ça exerce** : une configuration (ou un interrupteur de fonctionnalité) stockée en base suit la base, pas l'environnement ; effets d'une base partagée.

## S6-13 · Dire à l'écran qu'on est sur une prévisualisation

- **Type** : feature · **Taille** : M · **Demandé par** : gérant d'un restaurant partenaire
- **Contexte** : Courriel d'un gérant partenaire : « L'équipe m'a envoyé un lien pour tester la nouvelle fiche. J'ai changé ma capacité pour voir. Elle a changé pour de vrai. »
- **À faire** : Afficher un bandeau sur toutes les pages (les trois univers et la console formateur) quand l'application tourne ailleurs qu'en production : « Prévisualisation : les données sont celles de la production, ce que vous modifiez ici est réel. » Netlify fournit `CONTEXT` au build (`production`, `deploy-preview`, `branch-deploy`) ; le transmettre au rendu par `next.config.ts` (vérifier dans `node_modules/next/dist/docs/` la manière actuelle d'exposer une valeur de build). En local, afficher « Développement local » ou rien, au choix du binôme, mais le décider par écrit. Le bandeau reste lisible dans les couleurs de chaque univers (`src/lib/univers.ts`, `globals.css`).
- **Critères d'acceptation** :
  - Sans `CONTEXT` ou avec `CONTEXT=production`, aucun bandeau ; `CONTEXT=deploy-preview pnpm build && pnpm start` l'affiche sur `/`, `/espace-restaurant`, `/admin` et `/formateur` (captures).
  - Sur une vraie Deploy Preview de la PR, le bandeau est visible.
  - Le bandeau a le bon rôle ARIA et ne masque pas l'en-tête collant du site.
  - `pnpm typecheck`, `pnpm lint`, `pnpm build` passent.
- **Fichiers concernés** : `next.config.ts`, `src/app/layout.tsx`, nouveau composant dans `src/components/`. Chevauchement : S6-02 (contexte Netlify).
- **Ce que ça exerce** : savoir sur quel environnement on est ; valeur de build par contexte de déploiement.
- **Préparation formateur** : les Deploy Previews activées pour les PR des participants sur le dépôt de la formation (ou une PR de démonstration ouverte par le formateur).

## S6-14 · Tester les migrations sur une base déjà remplie, en CI

- **Type** : chore · **Taille** : M · **Demandé par** : ex-DevOps
- **Contexte** : Commit `d053898` : la migration des horaires passait en CI et a échoué sur la base Neon. Note de l'ex-DevOps : « La CI migre une base vide. Une base vide accepte tout. »
- **À faire** : Dans le job `build` de `.github/workflows/ci.yml`, avant `pnpm run build`, préparer la base comme elle est avant la PR : récupérer la branche cible (`github.base_ref`) dans un dossier à part, y lancer `pnpm install`, `pnpm prisma migrate deploy` et `pnpm seed:dev`, puis revenir au code de la PR. `pnpm run build` applique alors les nouvelles migrations sur une base remplie. Garder le temps du job raisonnable (cache pnpm).
- **Critères d'acceptation** :
  - Sur une PR de démonstration qui ajoute une colonne `NOT NULL` sans valeur par défaut sur `Restaurant`, le job échoue (alors qu'il passerait sur une base vide) ; lien vers l'exécution dans la PR, puis PR de démonstration fermée.
  - Sur une PR sans migration, le job passe ; la durée ajoutée est indiquée.
  - Le seed lancé est celui de la branche cible, pas celui de la PR (le diff du workflow le montre).
- **Fichiers concernés** : `.github/workflows/ci.yml`.
- **Ce que ça exerce** : rapprocher la CI de la production ; une migration se teste sur des données, pas seulement sur un schéma.

## S6-15 · Démarrer en local depuis zéro, en suivant le README à la lettre

- **Type** : enquête · **Taille** : S · **Demandé par** : ex-Scrum Master
- **Contexte** : Fiche d'accueil de l'ex-Scrum Master : « Temps pour lancer TheSpoon sur un nouveau poste : une journée. Objectif : une heure. »
- **À faire** : Un binôme sans profil développeur clone le dépôt dans un nouveau dossier et suit « Démarrer en local » du README mot à mot, sans aide extérieure. Noter chaque blocage (version de Node, PostgreSQL non installé ou pas démarré, base `thespoon_dev` absente, `whoami` dans `DATABASE_URL`, `BETTER_AUTH_SECRET`, port 3100) et le temps passé. Puis corriger la section du README pour qu'une autre paire réussisse plus vite, et le vérifier en lui faisant suivre la nouvelle version.
- **Critères d'acceptation** :
  - Le journal des blocages (étape, message d'erreur exact, solution, minutes perdues) est dans la PR.
  - La deuxième paire atteint la page de connexion restaurateur avec `password123` en suivant le README corrigé ; son temps est noté.
  - Seule la section « Démarrer en local » du README est modifiée.
- **Fichiers concernés** : `README.md` (section « Démarrer en local »).
- **Ce que ça exerce** : l'environnement de développement est un environnement comme les autres ; documentation testée par quelqu'un d'autre.

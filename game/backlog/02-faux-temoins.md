# Affaire N° 2 · Faux Témoins — Testing

Ce backlog fait pratiquer les tests sur TheSpoon : distinguer les tests unitaires (fonctions pures, sans base) des tests d'intégration (vraie base PostgreSQL, comme `src/lib/reservation.concurrence.test.ts`) et du test de bout en bout (navigateur, parcours complet), lancer les vérifications (`pnpm test`, `pnpm vitest run <fichier>`, `TZ=UTC`), et surtout se demander ce qu'un test prouve vraiment : un test qui passe toujours, un test qui ne passe que sur un poste réglé à Paris, une règle sans aucun test. Les items S2-01, S2-02, S2-03 et S2-05 conviennent bien à des non-développeurs (lire, lancer une commande, écrire des cas en mots simples) ; S2-15 aussi pour sa partie audit. Référence : `origin/main` (commit `d2dc6c8`) ; faire `git pull` sur `main` avant de commencer. Chaque binôme travaille sur sa branche `affaire-02/<id>-<binome>` et rend ses conclusions d'enquête dans `docs/affaires/02/<ID>.md`. Les tests d'intégration écrivent dans la base pointée par `DATABASE_URL` : chacun utilise sa base locale, jamais une base partagée (voir S2-13). Chevauchements à surveiller : si S2-12 choisit de renommer les tests d'intégration, il entre en conflit avec S2-07 (`reservation.concurrence.test.ts`) : le faire fusionner en dernier ; S2-12 et S2-13 touchent tous deux `vitest.config.mts` (et S2-12 `package.json`, comme S2-14) ; S2-09 et S2-10 portent sur la même action `marquerReservation` (S2-09 n'ajoute qu'un fichier de test, S2-10 modifie l'action : fusionner S2-09 en premier) ; S2-06 corrige le défaut signalé par S1-03 (affaire 1) ; S2-07 et S2-15 peuvent toutes deux toucher `src/lib/reservation.concurrence.test.ts` (S2-15 le laisse à S2-07).

| ID | Titre | Type | Taille | Demandé par |
|---|---|---|---|---|
| S2-01 | La carte des tests | enquête | S | Ex-QA |
| S2-02 | « Sous n'importe quel fuseau » : vérifier la promesse | enquête | S | Ex-SRE |
| S2-03 | Allergènes : les cas en mots simples | enquête | S | Gérant d'un restaurant partenaire |
| S2-04 | Un montant qui ressemble au bon | chore | S | Ex-CTO |
| S2-05 | Annuler le week-end du changement d'heure | chore | S | Ex-CPO |
| S2-06 | La référence d'avoir qui change de mois | bug | M | Gérante d'un restaurant partenaire |
| S2-07 | Le test de concurrence prouve-t-il quelque chose ? | enquête | M | Ex-DBA |
| S2-08 | Un dîneur ne peut pas toucher la réservation d'un autre | chore | M | Ex-CTO |
| S2-09 | Le signalement honoré / no-show n'a aucun test | chore | M | Ex-QA |
| S2-10 | 38 couverts servis sur une table de 3 | bug | M | Gérant d'un restaurant partenaire |
| S2-11 | Le test qui garde « pas de service après 22 h » | chore | M | Ex-architecte |
| S2-12 | `pnpm test` sans base : séparer unitaires et intégration | chore | M | Ex-DevOps |
| S2-13 | Les tests ne doivent jamais toucher une vraie base | bug | M | Ex-DBA |
| S2-14 | Premier test de bout en bout : réserver une table | feature | L | Ex-CPO |
| S2-15 | Les faux témoins : tests qui passent quoi qu'il arrive | enquête | L | Ex-QA |

## S2-01 · La carte des tests

- **Type** : enquête · **Taille** : S · **Demandé par** : Ex-QA
- **Contexte** : « On avait 31 fichiers de tests. Je n'ai jamais su lesquels avaient besoin de la base, ni ce que chacun protégeait. »
- **À faire** : lister les fichiers `*.test.ts` du dépôt (`src/lib/`, `src/lib/api-admin/`, `src/lib/chatbot/`, `src/app/api/chatbot/`, `scripts/jeu-formation/`). Noter que deux fichiers seulement suivent le nom `*.integration.test.ts` (`console-formateur`, `demande-contact-restaurateur`) alors que bien d'autres écrivent en base, et que les tests de l'assistant remplacent le SDK Anthropic et la clé OpenRouter par des faux (`vi.mock`) : dire ce que ces tests prouvent et ce qu'ils ne prouvent pas sur le vrai fournisseur. Pour chacun : unitaire (aucun import de `prisma`) ou intégration (écrit dans la base, comme `src/lib/avis.test.ts` ou `src/lib/disponibilites.test.ts`), et la règle produit qu'il protège, en une phrase. Lancer `pnpm test` une fois avec la base locale démarrée, une fois avec `DATABASE_URL` pointant vers une base qui n'existe pas, et noter ce qui casse. Repérer les règles du `README.md` qui n'ont aucun test.
- **Critères d'acceptation** :
  - `docs/affaires/02/S2-01.md` contient un tableau : fichier, unitaire / intégration, règle protégée, nombre de tests.
  - Il note le temps d'exécution de `pnpm test` et le nombre de fichiers en échec sans base.
  - Il dit, pour les tests de l'assistant, ce qui est vérifié pour de vrai et ce qui est simulé.
  - Il liste au moins trois règles du `README.md` sans test (pistes : refus d'annulation par un autre dîneur, signalement honoré / no-show, `referenceAvoir`, formatage des montants).
- **Fichiers concernés** : tous les `*.test.ts` (lecture), `vitest.config.mts`, `README.md`.
- **Ce que ça exerce** : types de tests, lancer la suite, lire ce qu'un test promet.

## S2-02 · « Sous n'importe quel fuseau » : vérifier la promesse

- **Type** : enquête · **Taille** : S · **Demandé par** : Ex-SRE
- **Contexte** : Le `README.md` affirme : « Les tests de `src/lib/fuseau.ts` et `src/lib/creneaux.ts` passent sous n'importe quel fuseau machine. » La CI tourne sur Ubuntu en UTC, les postes en Europe/Paris. Personne n'a essayé ailleurs.
- **À faire** : lancer la suite sous plusieurs fuseaux : `TZ=UTC pnpm test`, `TZ=America/Los_Angeles pnpm test`, `TZ=Pacific/Kiritimati pnpm test` (UTC+14), `TZ=Europe/Paris pnpm test`. Noter les tests qui changent de résultat. Chercher aussi dans les tests les dates écrites sans fuseau (`new Date("AAAA-MM-JJTHH:MM:SS")` sans `Z` ni décalage), par exemple dans `src/lib/reservation.concurrence.test.ts`, et dire si elles faussent quelque chose.
- **Critères d'acceptation** :
  - `docs/affaires/02/S2-02.md` contient un tableau fuseau × nombre de tests réussis / échoués.
  - Chaque test qui dépend du fuseau est nommé, avec la cause.
  - Les dates sans fuseau trouvées dans les tests sont listées avec un avis : sans effet, ou à corriger (et par quel item).
  - Une recommandation dit s'il faut faire tourner la CI sous un second fuseau (sujet repris en affaire 3).
- **Fichiers concernés** : `src/lib/fuseau.test.ts`, `src/lib/creneaux.test.ts`, `src/lib/reservation.concurrence.test.ts`, `src/lib/reservation.fuseau.test.ts` (lecture).
- **Ce que ça exerce** : lancer les tests dans des conditions différentes, ce qu'un test vert sur un seul poste ne prouve pas.

## S2-03 · Allergènes : les cas en mots simples

- **Type** : enquête · **Taille** : S · **Demandé par** : Gérant d'un restaurant partenaire
- **Contexte** : « Une cliente allergique aux arachides m'a demandé si votre fiche était fiable. Je n'ai pas su quoi lui répondre. »
- **À faire** : à partir de la section « “Non renseigné” n'est pas “sans allergène” » du `README.md`, écrire les cas à vérifier sous la forme « Étant donné… quand… alors… », côté restaurateur (« Ma carte ») et côté dîneur (fiche publique). Inclure : plat jamais renseigné, « aucun allergène » coché, allergènes cochés, « aucun » coché avec des cases restées cochées, et le cas qui inquiète le `README.md` : un restaurateur qui ne change que le prix d'un plat déjà déclaré. Pour chaque cas, retrouver le test qui le couvre dans `src/lib/allergenes.test.ts` ou `src/lib/api-admin/api-admin.test.ts`, ou écrire « aucun test ». Vérifier à la main dans l'application les cas sans test.
- **Critères d'acceptation** :
  - `docs/affaires/02/S2-03.md` contient au moins 6 cas en mots simples.
  - Chaque cas est relié à un test existant (fichier + nom du test) ou marqué « aucun test » et « vérifié à la main : OK / KO ».
  - Il note que l'action de modification d'un plat (`src/app/espace-restaurant/menu/actions.ts`) n'a aucun test, et propose le test à écrire.
  - Une réponse de 3 lignes pour la cliente allergique.
- **Fichiers concernés** : `src/lib/allergenes.ts`, `src/lib/allergenes.test.ts`, `src/app/espace-restaurant/menu/actions.ts`, `src/components/AllergenesPlat.tsx` (lecture).
- **Ce que ça exerce** : écrire un cas de test sans coder, relier un besoin à un test, repérer un trou de couverture.

## S2-04 · Un montant qui ressemble au bon

- **Type** : chore · **Taille** : S · **Demandé par** : Ex-CTO
- **Contexte** : `formaterMontant` (`src/lib/montants.ts`) s'affiche sur toutes les factures et n'a aucun test.
- **À faire** : créer `src/lib/montants.test.ts`. Tester 0, 250 centimes, 125000 centimes, un montant négatif (un avoir). Écrire d'abord l'attendu avec des espaces ordinaires (« 1 250,00 € »), constater l'échec et lire le message de Vitest : le formatage français utilise des espaces insécables (U+202F entre les milliers, U+00A0 avant « € »). Écrire l'attendu de façon lisible (par exemple avec des constantes nommées pour ces deux espaces) plutôt que de copier-coller le caractère.
- **Critères d'acceptation** :
  - `pnpm vitest run src/lib/montants.test.ts` passe.
  - Le test échoue si on remplace `centimes / 100` par `centimes / 10` (essayé, et noté dans la PR).
  - Les espaces insécables sont nommés dans le test, pas cachés dans une chaîne.
- **Fichiers concernés** : `src/lib/montants.ts` (lecture), `src/lib/montants.test.ts` (nouveau).
- **Ce que ça exerce** : premier test unitaire, lire un message d'échec, vérifier qu'un test peut échouer.

## S2-05 · Annuler le week-end du changement d'heure

- **Type** : chore · **Taille** : S · **Demandé par** : Ex-CPO
- **Contexte** : `limiteAnnulation` (`src/lib/annulation.ts`) dit que « 24 h avant » veut dire vingt-quatre heures réelles, même le week-end du changement d'heure, où la limite tombe une heure à côté de l'heure du service. Aucun test ne le vérifie.
- **À faire** : le binôme écrit d'abord le cas en mots : « Un restaurant a un délai de 24 h. Une table est réservée le dimanche 28 mars 2027 à 20 h, jour du passage à l'heure d'été. Jusqu'à quelle heure le samedi peut-on annuler ? » Calculer la réponse à la main (19 h le samedi, heure de Paris : la nuit a perdu une heure), puis l'écrire en test dans `src/lib/annulation.test.ts`, avec `construireDateCreneau` pour la date du créneau. Ajouter le cas inverse au passage à l'heure d'hiver, le dimanche 31 octobre 2027 à 20 h (limite : 21 h le samedi).
- **Critères d'acceptation** :
  - Deux nouveaux tests dans `src/lib/annulation.test.ts`, chacun avec un commentaire qui donne le calcul en heures de Paris.
  - Ils passent sous `TZ=UTC` et sous `TZ=Europe/Paris`.
  - Aucune date construite avec `new Date("…T20:00:00")` sans fuseau.
- **Fichiers concernés** : `src/lib/annulation.test.ts`, `src/lib/annulation.ts` (lecture), `src/lib/creneaux.ts` (lecture).
- **Ce que ça exerce** : test d'un cas limite de temps, règle d'heure de Paris, cas écrit en mots avant le code.

## S2-06 · La référence d'avoir qui change de mois

- **Type** : bug · **Taille** : M · **Demandé par** : Gérante d'un restaurant partenaire
- **Contexte** : « Mon avoir d'octobre s'appelle AV-202609. Mon comptable croit qu'il corrige la facture de septembre. » (Ticket ouvert par S1-03 en affaire 1.)
- **À faire** : `referenceAvoir` (`src/lib/facturation.ts`) lit l'année et le mois avec `getFullYear()` / `getMonth()`, donc dans le fuseau de la machine, UTC en production. Écrire d'abord le test qui reproduit le défaut : un avoir émis à `2026-09-30T22:30:00Z` (0 h 30 le 1er octobre à Paris) doit donner `AV-202610-…`. Le lancer sous `TZ=Europe/Paris` (il passe : c'est le piège) puis sous `TZ=UTC` (il échoue). Corriger avec `composantesLocales` de `src/lib/fuseau.ts`, et mettre le commentaire à jour.
- **Critères d'acceptation** :
  - Le nouveau test échoue sur `main` avec `TZ=UTC pnpm vitest run src/lib/facturation.test.ts` et passe après la correction, sous `TZ=UTC` comme sous `TZ=Europe/Paris`.
  - `referenceFacture` n'est pas modifiée (elle lit volontairement en UTC, voir `moisFacture`) ; un test le rappelle si le binôme en ajoute un.
  - La PR explique pourquoi le test passait sur le poste du développeur.
- **Fichiers concernés** : `src/lib/facturation.ts`, `src/lib/facturation.test.ts`.
- **Ce que ça exerce** : test de régression écrit avant la correction, test qui dépend du poste, règle d'heure de Paris.

## S2-07 · Le test de concurrence prouve-t-il quelque chose ?

- **Type** : enquête · **Taille** : M · **Demandé par** : Ex-DBA
- **Contexte** : « `reserverCreneau` tient grâce au `SELECT … FOR UPDATE`. Le test lance deux réservations en même temps sur la dernière place. Si on enlève le verrou, est-ce qu'il casse vraiment ? »
- **À faire** : sur une branche jetable, retirer `FOR UPDATE` dans `src/lib/reservation.ts`, puis lancer `pnpm vitest run src/lib/reservation.concurrence.test.ts` vingt fois (boucle shell) et compter les échecs. Remettre le verrou. Renforcer le test pour qu'il casse à coup sûr sans verrou : par exemple capacité 3, dix réservations simultanées, et vérifier qu'il n'y a jamais plus de 3 couverts en base. En profiter pour remplacer `new Date("2026-12-01T19:30:00")` par `construireDateCreneau`.
- **Critères d'acceptation** :
  - `docs/affaires/02/S2-07.md` donne le taux d'échec du test d'origine sans verrou (par exemple « 4 échecs sur 20 »), et celui du test renforcé (attendu : 20 sur 20).
  - Avec le verrou, le test renforcé passe 20 fois sur 20.
  - Le test n'utilise plus de date sans fuseau.
  - `src/lib/reservation.ts` est identique à `main` à la fin (seul le test change).
- **Fichiers concernés** : `src/lib/reservation.concurrence.test.ts`, `src/lib/reservation.ts` (modifié seulement le temps de l'essai).
- **Ce que ça exerce** : test d'intégration avec Postgres, test qui passe par chance, casser le code exprès pour vérifier qu'un test le voit.

## S2-08 · Un dîneur ne peut pas toucher la réservation d'un autre

- **Type** : chore · **Taille** : M · **Demandé par** : Ex-CTO
- **Contexte** : `annulerReservation` et `signalerAbsence` (`src/app/(site)/mes-reservations/actions.ts`) cherchent la réservation avec `userId: session.user.id`. C'est la seule chose qui empêche un dîneur d'annuler la table d'un autre. Aucun test ne le vérifie.
- **À faire** : créer `src/lib/mes-reservations.test.ts`, test d'intégration sur le modèle de `src/lib/avis.test.ts` (mêmes `vi.mock` pour `next/headers`, `next/cache` et `@/lib/auth`). Créer un restaurant, deux dîneurs, une réservation à venir pour le dîneur A. Vérifier que le dîneur B reçoit « Réservation introuvable. » en annulant et en prévenant, et que la réservation est inchangée en base. Vérifier que le dîneur A, lui, peut annuler. Nettoyer en `afterAll`.
- **Critères d'acceptation** :
  - `pnpm vitest run src/lib/mes-reservations.test.ts` passe avec une base locale.
  - Le test échoue si on retire `userId: session.user.id` du `findFirst` de `annulerReservation` (essayé, noté dans la PR).
  - Les dates des réservations passent par `construireDateCreneau` ou un décalage depuis `Date.now()`, pas par une chaîne sans fuseau.
  - Plus aucune ligne de test ne reste en base après le passage (vérifié avec une requête `count`).
- **Fichiers concernés** : `src/lib/mes-reservations.test.ts` (nouveau), `src/app/(site)/mes-reservations/actions.ts` (lecture).
- **Ce que ça exerce** : test d'intégration d'une action serveur, simuler une session, vérifier une règle d'accès.

## S2-09 · Le signalement honoré / no-show n'a aucun test

- **Type** : chore · **Taille** : M · **Demandé par** : Ex-QA
- **Contexte** : `marquerReservation` (`src/app/espace-restaurant/reservations/actions.ts`) débloque la facturation. Elle refuse un créneau futur, une réservation déjà traitée, celle d'un autre restaurant, et compte sur `updateMany` pour qu'un double clic ne signale pas deux fois. Rien de tout ça n'est testé.
- **À faire** : créer `src/lib/signalement.test.ts` (intégration, session restaurateur simulée en remplaçant `authRestaurant` dans le `vi.mock` de `@/lib/auth`). Couvrir : créneau passé signalé honoré avec `couvertsServis` ; créneau futur refusé ; réservation d'un autre restaurant introuvable ; « honoré » sans couverts servis refusé avec le message dédié ; deux signalements simultanés (`Promise.all`) dont un seul gagne.
- **Critères d'acceptation** :
  - `pnpm vitest run src/lib/signalement.test.ts` passe avec une base locale.
  - Le test des deux signalements simultanés échoue si on remplace `updateMany` avec `statut: "CONFIRMEE"` par un `update` simple (essayé, noté dans la PR).
  - `signaleeLe` est vérifié non nul après un signalement réussi.
- **Fichiers concernés** : `src/lib/signalement.test.ts` (nouveau), `src/app/espace-restaurant/reservations/actions.ts` (lecture seule).
- **Ce que ça exerce** : test d'intégration, concurrence, tester les chemins d'échec et pas seulement le chemin heureux.

## S2-10 · 38 couverts servis sur une table de 3

- **Type** : bug · **Taille** : M · **Demandé par** : Gérant d'un restaurant partenaire
- **Contexte** : « Ma facture d'octobre compte 38 couverts pour une table de 3. Mon serveur a tapé 38 au lieu de 3, et votre site l'a accepté. Je paie 2,50 € par couvert. »
- **À faire** : `schemaSignalement` n'a qu'un minimum (`min(1)`) pour `couvertsServis`. Décider d'abord de la borne avec le demandeur, par écrit dans la PR (proposition : pas plus que la capacité du restaurant, ou `capaciteEffective` si elle est vide ; une table peut s'agrandir sur place, donc pas « pas plus que réservé »). Écrire le test qui échoue avant de corriger, dans `src/lib/signalement-bornes.test.ts`, puis corriger l'action avec un message clair pour le restaurateur.
- **Critères d'acceptation** :
  - La borne choisie et sa raison sont écrites dans la PR.
  - Le nouveau test échoue sur `main` et passe après la correction ; il couvre la borne exacte (acceptée) et la borne + 1 (refusée).
  - Le message d'erreur affiché au restaurateur dit le maximum autorisé.
  - `pnpm typecheck`, `pnpm lint` et `pnpm test` passent.
- **Fichiers concernés** : `src/app/espace-restaurant/reservations/actions.ts`, `src/lib/reservation.ts` (`capaciteEffective`, lecture), `src/lib/signalement-bornes.test.ts` (nouveau).
- **Ce que ça exerce** : test écrit avant la correction, test de borne, décision produit avant le code.

## S2-11 · Le test qui garde « pas de service après 22 h »

- **Type** : chore · **Taille** : M · **Demandé par** : Ex-architecte
- **Contexte** : `genererFacturesMois` (`src/lib/facturation.ts`) découpe le mois en UTC. Le commentaire prévient : ça ne marche que tant qu'aucun créneau ne tombe après 22 h à Paris. Le jour où quelqu'un ajoute « 23:00 » à `CRENEAUX_SOIR`, rien ne cassera, et des réservations du 1er du mois partiront sur la facture du mois d'avant.
- **À faire** : écrire `src/lib/facturation.bornes.test.ts`, un test unitaire qui vérifie, pour chaque créneau de `CRENEAUX_HORAIRES`, en hiver et en été, que l'instant construit par `construireDateCreneau` tombe le même jour en UTC qu'à Paris. Le message d'échec doit dire quoi faire (« découper le mois en heure de Paris dans `genererFacturesMois` »). Vérifier que le test casse en ajoutant temporairement « 23:00 » ou « 00:30 ».
- **Critères d'acceptation** :
  - Le test passe sur `main`.
  - Il échoue avec un message explicite quand un créneau de 23 h 30 est ajouté à `CRENEAUX_SOIR` (essayé, noté dans la PR, puis retiré).
  - Il couvre au moins une date d'hiver (UTC+1) et une d'été (UTC+2).
- **Fichiers concernés** : `src/lib/facturation.bornes.test.ts` (nouveau), `src/lib/facturation.ts`, `src/lib/creneaux.ts` (lecture).
- **Ce que ça exerce** : un test qui protège une hypothèse écrite seulement en commentaire.

## S2-12 · `pnpm test` sans base : séparer unitaires et intégration

- **Type** : chore · **Taille** : M · **Demandé par** : Ex-DevOps
- **Contexte** : « Pour modifier un libellé, il fallait démarrer Postgres, sinon `pnpm test` tombait. Résultat : plus personne ne lançait les tests. »
- **À faire** : configurer deux groupes de tests dans `vitest.config.mts` (fonction `projects` de Vitest : `unit` et `integration`), en se basant sur la carte de S2-01 si elle est prête. Choisir entre deux façons de reconnaître un test d'intégration : étendre le nom `*.integration.test.ts` déjà utilisé par deux fichiers (et renommer les autres, avec `git mv`), ou une liste explicite dans la configuration ; justifier le choix dans la PR. Ajouter `test:unit` et `test:integration` dans `package.json`, sans changer le sens de `pnpm test` (tout lancer, comme la CI). Lire la documentation de la version installée (`node_modules/vitest`) plutôt que de supposer l'API.
- **Critères d'acceptation** :
  - `DATABASE_URL=postgresql://nobody@localhost:1/none pnpm test:unit` passe.
  - `pnpm test:integration` ne lance que les fichiers qui utilisent la base, y compris ceux qui ne portent pas encore le suffixe `.integration`.
  - `pnpm test` lance toujours tout, avec le même nombre de tests qu'avant (comparé dans la PR).
  - Le `README.md` dit en deux lignes quelle commande lancer et quand.
- **Fichiers concernés** : `vitest.config.mts`, `package.json`, `README.md` (section « Démarrer en local »).
- **Ce que ça exerce** : organiser les types de tests, rendre les vérifications rapides à lancer.

## S2-13 · Les tests ne doivent jamais toucher une vraie base

- **Type** : bug · **Taille** : M · **Demandé par** : Ex-DBA
- **Contexte** : « Les tests d'intégration créent et suppriment des restaurants dans la base de `DATABASE_URL`. Les Deploy Previews et la prod partagent la même base Neon. Il suffit d'un `.env` copié du mauvais endroit. »
- **À faire** : ajouter un garde-fou qui fait échouer tout de suite les tests d'intégration si `DATABASE_URL` ne désigne pas une base locale ou de CI (hôte `localhost` ou `127.0.0.1`), avec un message clair. Le placer dans un fichier de préparation de Vitest (`setupFiles`), pas dans chaque test. Prévoir une sortie explicite pour un cas légitime (variable `TESTS_BASE_AUTORISEE=1`, documentée).
- **Critères d'acceptation** :
  - Avec `DATABASE_URL="postgresql://u:p@ep-exemple.eu-central-1.aws.neon.tech/neondb"`, `pnpm test` s'arrête avant toute écriture, avec un message qui nomme l'hôte refusé (sans afficher le mot de passe).
  - Avec la base locale, et dans la CI (`localhost:5432`), rien ne change.
  - Un test unitaire couvre la fonction qui décide si l'hôte est autorisé.
- **Fichiers concernés** : `vitest.config.mts`, nouveau fichier de préparation (par exemple `src/lib/tests/garde-base.ts`) et son test, `README.md`.
- **Ce que ça exerce** : isolement des tests, ce qu'un test d'intégration peut casser hors de lui-même.

## S2-14 · Premier test de bout en bout : réserver une table

- **Type** : feature · **Taille** : L · **Demandé par** : Ex-CPO
- **Contexte** : « Tous nos tests vérifient des morceaux. Aucun ne vérifie qu'un dîneur peut, dans un vrai navigateur, se connecter, réserver et retrouver sa table. C'est pourtant la seule chose que les 50 restaurants nous demandent. »
- **À faire** : installer Playwright (`@playwright/test`), écrire `e2e/reserver.spec.ts` sur la base de `pnpm seed:dev` (mot de passe `password123`) : un dîneur se connecte sur `/connexion`, ouvre une fiche restaurant, choisit convives, jour et créneau, confirme, retrouve la réservation sur `/mes-reservations` ; le contact du restaurant la voit sur `/espace-restaurant/reservations`. Script `test:e2e` dans `package.json`. Ne pas l'ajouter à la CI (affaire 3).
- **Critères d'acceptation** :
  - `pnpm seed:dev && pnpm test:e2e` passe deux fois de suite sur un poste (le test ne dépend pas d'un état laissé par le passage précédent).
  - Les sélecteurs passent par les rôles et les libellés visibles (`getByRole`, `getByLabel`), pas par des classes CSS.
  - Le jour choisi est calculé (premier jour réservable ouvert), pas écrit en dur.
  - Le `README.md` explique comment le lancer, et `pnpm test` ne lance pas les fichiers `e2e/`.
- **Fichiers concernés** : `e2e/reserver.spec.ts`, `playwright.config.ts` (nouveaux), `package.json`, `vitest.config.mts` (exclure `e2e/`), `README.md`, `src/components/BookingCard.tsx` (lecture, éventuellement libellés accessibles).
- **Ce que ça exerce** : test de bout en bout, ce qu'il prouve que les autres ne prouvent pas, et son coût (lenteur, données).

## S2-15 · Les faux témoins : tests qui passent quoi qu'il arrive

- **Type** : enquête · **Taille** : L · **Demandé par** : Ex-QA
- **Contexte** : « On avait plus de 200 tests verts. Ça ne nous a pas empêchés d'envoyer des réservations avec deux heures d'avance en prod pendant six jours. »
- **À faire** : pour trois modules purs bien testés (`src/lib/annulation.ts`, `src/lib/horaires.ts`, `src/lib/allergenes.ts`), introduire à la main une série de petites erreurs, une à la fois (`<` en `<=`, `??` en `||`, une condition inversée, un `return` en avance), lancer le fichier de test correspondant, et noter laquelle passe inaperçue. Pour chaque erreur non détectée, écrire le test manquant. Lire aussi les tests à la recherche de motifs qui passent toujours : `expect` dans une boucle sur une liste qui peut être vide, `await` manquant devant un `expect(...).rejects`, test sans aucun `expect`.
- **Critères d'acceptation** :
  - `docs/affaires/02/S2-15.md` contient un tableau : module, erreur introduite, détectée oui / non, test ajouté.
  - Au moins 10 erreurs essayées par module, et un taux de détection avant / après par module.
  - Chaque nouveau test échoue sur l'erreur qu'il vise et passe sur `main`.
  - Les motifs « passe toujours » trouvés dans les tests existants sont listés avec fichier et ligne, ou « aucun trouvé » est écrit explicitement.
  - Le code de `src/lib/` est identique à `main` à la fin (seuls des tests sont ajoutés).
- **Fichiers concernés** : `src/lib/annulation.test.ts`, `src/lib/horaires.test.ts`, `src/lib/allergenes.test.ts` (ajouts) ; `src/lib/annulation.ts`, `src/lib/horaires.ts`, `src/lib/allergenes.ts` (modifiés seulement le temps des essais). Chevauchement avec S2-05 sur `src/lib/annulation.test.ts` : ajouter les tests en fin de fichier, dans un `describe` à part.
- **Ce que ça exerce** : ce qu'un test prouve, test de mutation fait à la main, tests qui passent toujours.

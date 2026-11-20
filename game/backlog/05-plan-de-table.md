# Affaire N° 5 · Plan de table — Architecture

Référence : `origin/main` du dépôt TheSpoon (commit `d2dc6c8`, avec l'assistant de recherche et la console formateur). Ce carnet fait lire TheSpoon comme une architecture : où vivent les trois univers publics (dîneur, restaurateur, staff) et la console formateur interne, ce qui sépare `src/app` de `src/lib`, quelles règles sont vraiment écrites une seule fois, où se trouvent les limites d'un monolithe modulaire, et comment garder la trace d'une décision (ADR). Les items S5-01, S5-02, S5-03, S5-04, S5-06 et S5-13 conviennent à des binômes sans profil développeur : il s'agit de lire, de comparer et d'écrire en français. Les ADR vont dans `docs/adr/`, jamais dans `docs/specs/` (dossier réservé au runner SDLC, voir `AGENTS.md`). Les numéros d'ADR sont attribués d'avance pour éviter les collisions : 0001 (S5-03), 0002 (S5-04), 0003 (S5-05), 0004 (S5-15), 0005 (S5-13), 0006 (S5-14). Seul S5-03 écrit l'index `docs/adr/README.md`, et seul S5-02 modifie `README.md`. Chevauchements à surveiller : S5-14 et S5-15 touchent tous deux `prisma/schema.prisma` (faire S5-15 d'abord, ou S5-14 dans une session suivante) ; S5-10 déplace `AvisForm.tsx` que S5-14 lit ; S5-08 (plan de déménagement) et S5-11 citent tous deux `src/lib/dossier-pieces-jointes.ts` ; S5-07 et S5-12 touchent des fichiers voisins (`src/lib/api-admin/creations.ts` et `scripts/jeu-formation/`) sans se recouvrir.

| ID | Titre | Type | Taille | Demandé par |
|---|---|---|---|---|
| S5-01 | Le plan de l'application, sur une page | chore | M | ex-CTO |
| S5-02 | Le README ne décrit plus le produit | bug | S | ex-Scrum Master |
| S5-03 | ADR 0001 : une instance better-auth par population, pas une table avec un rôle | chore | S | ex-architecte |
| S5-04 | ADR 0002 : l'heure, c'est l'heure de Paris | chore | S | ex-QA |
| S5-05 | ADR 0003 : les photos sur Netlify Blobs, avec repli sur disque | chore | S | ex-DevOps |
| S5-06 | « Règle écrite une seule fois » : vérifier la promesse | enquête | M | ex-QA |
| S5-07 | Deux écritures du contrôle de capacité | bug | M | ex-architecte |
| S5-08 | La tranche « facturation et litiges » : plan de déménagement | enquête | L | ex-Head of Growth (Caro Pizzo) |
| S5-09 | Interdire les imports d'un univers à l'autre | chore | M | ex-architecte |
| S5-10 | `src/components` : ranger ce qui n'appartient qu'au dîneur | chore | M | ex-CTO |
| S5-11 | Le module « photos » range aussi des justificatifs de litige | chore | S | ex-DevOps |
| S5-12 | Découper `scripts/jeu-formation/generer.ts` sans changer le plan produit | chore | M | ex-QA |
| S5-13 | Liste d'attente : où la mettre avant de la coder | enquête | M | gérante d'un restaurant partenaire |
| S5-14 | Modération des avis : une première tranche verticale | feature | L | gérant d'un restaurant partenaire |
| S5-15 | `schema.prisma` en plusieurs fichiers | chore | M | ex-DBA |

---

## S5-01 · Le plan de l'application, sur une page

- **Type** : chore · **Taille** : M · **Demandé par** : ex-CTO
- **Contexte** : Note de passation de l'ex-CTO : « Le schéma d'archi, je l'avais au tableau blanc. Il a été effacé avec le reste. »
- **À faire** : Produire `docs/architecture/plan.md` avec deux schémas Mermaid. Niveau 1 (contexte) : dîneurs, contacts restaurant, staff, formateurs Hymaia, l'application Next.js sur Netlify, la base PostgreSQL (Neon en production), Netlify Blobs, les fournisseurs de modèle de l'assistant de recherche (OpenRouter puis Anthropic, `src/lib/chatbot/agent.ts`), Google pour la connexion des formateurs, les scripts (`seed:dev`, `creer-compte`, `jeu-formation`) et l'API d'administration. Niveau 2 (conteneurs et modules) : les univers dans `src/app` (`(site)/`, `espace-restaurant/`, `admin/`, `formateur/`), les quatre instances `auth`, `authRestaurant`, `authAdmin`, `authFormateur` de `src/lib/auth.ts` avec leurs routes `/api/auth`, `/api/auth-restaurant`, `/api/auth-admin`, `/api/auth-formateur`, les modules métier de `src/lib`, `src/lib/chatbot/` et sa route `/api/chatbot`, `src/lib/api-admin/` et les routes publiques de photos. Sous chaque schéma, dix lignes au plus en français simple : qui parle à quoi, et pourquoi.
- **Critères d'acceptation** :
  - Les deux schémas s'affichent dans l'aperçu Markdown de GitHub (Mermaid valide).
  - Chaque boîte du niveau 2 cite au moins un chemin réel du dépôt.
  - Une personne qui n'a pas lu le code peut répondre, avec le seul document, à : « Où est vérifié qu'un restaurateur ne voit que son restaurant ? » (réponse attendue : `session.user.restaurantId` dans les pages et actions de `src/app/espace-restaurant/`).
- **Fichiers concernés** : `docs/architecture/plan.md` (nouveau) ; lecture de `src/app/`, `src/lib/auth.ts`, `src/lib/prisma.ts`, `src/lib/photos.ts`, `package.json`.
- **Ce que ça exerce** : lire une architecture existante, modèle C4 (niveaux 1 et 2), faire expliquer le code par Claude puis vérifier ce qu'il affirme.

## S5-02 · Le README ne décrit plus le produit

- **Type** : bug · **Taille** : S · **Demandé par** : ex-Scrum Master
- **Contexte** : Message laissé dans le canal de l'équipe : « Le README dit que la facturation n'existe pas. J'ai pourtant validé la démo des factures en septembre. »
- **À faire** : Comparer `README.md` au code et corriger les écarts. Au moins ceux-ci sont connus :
  - « Ce qui n'existe pas encore » cite la facturation et les litiges, alors que `src/app/admin/factures/`, `src/app/admin/litiges/` et `src/app/espace-restaurant/factures/` existent ;
  - la Console staff est décrite « sans section factures » ;
  - le chemin `src/app/restaurants/[id]/actions.ts` n'existe pas (c'est `src/app/(site)/restaurants/[id]/actions.ts`), idem pour `src/app/mes-reservations/` ;
  - la réservation est dite « sans vérifier les conflits de capacité », alors que `reserverCreneau` (`src/lib/reservation.ts`) les vérifie ;
  - « Le contrôle d'accès est fait une fois dans le layout » est faux pour `/admin`, où `src/lib/garde-staff.ts` impose un appel dans chaque page.
  Chercher les autres écarts avec Claude, mais garder seulement ceux qu'on a vérifiés dans le code.
- **Critères d'acceptation** :
  - Les cinq écarts ci-dessus sont corrigés dans `README.md`.
  - La description de la PR liste chaque écart avec le fichier qui le prouve.
  - Aucun chemin cité dans `README.md` ne pointe vers un fichier absent (vérification avec `git ls-files`, commande collée dans la PR).
- **Fichiers concernés** : `README.md` uniquement.
- **Ce que ça exerce** : la documentation comme partie de l'architecture ; vérifier une affirmation au lieu de la recopier.

## S5-03 · ADR 0001 : une instance better-auth par population, pas une table avec un rôle

- **Type** : chore · **Taille** : S · **Demandé par** : ex-architecte
- **Contexte** : Ticket ouvert par l'ex-architecte : « Personne ne se souvient pourquoi on a trois logins. La prochaine personne va vouloir les fusionner. » Depuis, un quatrième est arrivé pour les formateurs.
- **À faire** : Créer `docs/adr/README.md` (index et modèle : Titre, Statut, Contexte, Décision, Options écartées, Conséquences) et `docs/adr/0001-une-instance-auth-par-population.md`. La décision est déjà prise et documentée en commentaires dans `src/lib/auth.ts` (tables `User` / `RestaurantContact` / `Staff` / `Formateur`, cookies par instance, `disableSignUp`, `trustedOrigins`, connexion Google réservée à `authFormateur`) et dans le README (« Charte & structure des écrans »). L'option écartée est « une seule table `User` avec un champ rôle ». Dans les conséquences, citer au moins `onboardingVuLe` répété dans trois modèles, `src/app/onboarding-actions.ts` qui doit essayer plusieurs sessions, les gardes séparées (`src/lib/garde-staff.ts`, `src/lib/garde-formateur.ts`), l'arrivée de la quatrième instance comme test de la décision (qu'a-t-elle coûté ?), et la route `src/app/api/dossiers/[dossierId]/pieces-jointes/[pieceId]/route.ts` qui en essaie deux.
- **Critères d'acceptation** :
  - L'index liste les numéros 0001 à 0006 avec leur titre (les autres seront écrits par S5-04, S5-05, S5-15, S5-13, S5-14) ; statut « Accepté » pour 0001.
  - L'ADR fait moins d'une page et chaque conséquence cite un fichier.
  - Une personne non développeuse du binôme sait expliquer à voix haute ce qu'on perdrait en fusionnant les trois tables.
- **Fichiers concernés** : `docs/adr/README.md`, `docs/adr/0001-trois-instances-auth.md` (nouveaux).
- **Ce que ça exerce** : écrire un ADR rétroactif ; distinguer une décision de son implémentation.

## S5-04 · ADR 0002 : l'heure, c'est l'heure de Paris

- **Type** : chore · **Taille** : S · **Demandé par** : ex-QA
- **Contexte** : Dans le carnet de l'ex-QA : « Bug d'heure en prod, invisible en local. Troisième fois. On a fini par écrire une règle. »
- **À faire** : Écrire `docs/adr/0002-heure-de-paris.md` à partir de la section « L'heure, c'est l'heure de Paris » du README et de `src/lib/fuseau.ts`. Option écartée à documenter : fixer `process.env.TZ`. Conséquences : les deux règles (`instantLocal` / `construireDateCreneau`, `formaterDate` / `formaterJourLong` / `formaterHeure`), et les exceptions assumées, par exemple `formaterMoisFacture` dans `src/lib/facturation.ts` qui lit en UTC un mois stocké à minuit UTC. Ajouter une section « Comment vérifier » : la commande qui lance les tests de `src/lib/fuseau.test.ts` et `src/lib/creneaux.test.ts` sous un autre fuseau machine (`TZ=UTC pnpm test src/lib/fuseau.test.ts` puis `TZ=Pacific/Auckland …`).
- **Critères d'acceptation** :
  - Les deux commandes de la section « Comment vérifier » ont été lancées et passent ; leur sortie est résumée dans la PR.
  - L'ADR cite au moins une exception volontaire à la règle avec son fichier.
  - Statut « Accepté ».
- **Fichiers concernés** : `docs/adr/0002-heure-de-paris.md` (nouveau).
- **Ce que ça exerce** : ADR avec options écartées ; rendre une décision vérifiable.

## S5-05 · ADR 0003 : les photos sur Netlify Blobs, avec repli sur disque

- **Type** : chore · **Taille** : S · **Demandé par** : ex-DevOps
- **Contexte** : Note de l'ex-DevOps : « Pourquoi pas S3 ? On me l'a demandé dix fois. La réponse est dans le code, quelque part. »
- **À faire** : Écrire `docs/adr/0003-photos-netlify-blobs.md` à partir de `src/lib/photos.ts` (`creerStorePhotos`, `creerStoreLocal`, `NETLIFY_BLOBS_CONTEXT`), de `src/lib/images.ts` et de `src/components/PhotoCouverture.tsx`. Décrire : un store par type d'entité, l'interface `StorePhotos` qui cache la différence entre dev et production, le refus du SVG, le `<img>` simple imposé par le cache-bust `?v=` sous Next.js 16. Options écartées : un stockage S3, `netlify dev` obligatoire en local. Conséquence à écrire noir sur blanc : en local, une base qui porte `photoMisAJourLe` sans fichier dans `.local-blobs/` affiche une image cassée.
- **Critères d'acceptation** :
  - L'ADR décrit le comportement en local et sur Netlify, chacun avec la ligne de code qui le décide.
  - La conséquence « image cassée en local » est vérifiée sur sa machine (une requête SQL qui pose `photoMisAJourLe` sur un restaurant sans photo, puis la page d'accueil) et décrite dans la PR.
- **Fichiers concernés** : `docs/adr/0003-photos-netlify-blobs.md` (nouveau).
- **Ce que ça exerce** : ADR sur un choix d'infrastructure ; abstraction d'un service externe derrière une interface.

## S5-06 · « Règle écrite une seule fois » : vérifier la promesse

- **Type** : enquête · **Taille** : M · **Demandé par** : ex-QA
- **Contexte** : Le README l'affirme trois fois : la règle des disponibilités, celle de l'annulation et celle des allergènes ne sont écrites qu'une fois. L'ex-QA avait noté en marge : « À vérifier. »
- **À faire** : Pour chacun des modules `src/lib/disponibilites.ts`, `src/lib/annulation.ts`, `src/lib/allergenes.ts`, `src/lib/creneaux.ts` et `src/lib/reservation.ts`, chercher dans `src/` et `scripts/` les endroits qui refont la règle au lieu d'appeler le module. Pistes déjà repérées, à confirmer ou infirmer :
  - `src/app/espace-restaurant/menu/page.tsx` compte les plats non renseignés avec `allergenesDeclaresLe === null` plutôt qu'avec `lireDeclaration` ;
  - `src/components/PlatForm.tsx` recalcule l'état « aucun allergène » ;
  - « cinq jours » écrit en dur dans `src/lib/univers.ts` et `src/app/(site)/page.tsx` à côté de `NB_JOURS_RESERVABLES` ;
  - le contrôle de capacité écrit deux fois (voir S5-07).
  Rendre un tableau dans `docs/architecture/regles-metier.md` : règle, module de référence, copies trouvées, risque si elles divergent, verdict (acceptable ou à corriger). Pas de modification de code.
- **Critères d'acceptation** :
  - Au moins cinq lignes dans le tableau, chacune avec chemin et numéro de ligne.
  - Chaque piste ci-dessus a un verdict argumenté, y compris « faux positif » si c'en est un.
  - Les items « à corriger » sont rédigés comme des tickets d'une phrase en fin de document.
- **Fichiers concernés** : `docs/architecture/regles-metier.md` (nouveau) ; lecture de `src/lib/`, `src/app/`, `src/components/`, `scripts/`.
- **Ce que ça exerce** : cohésion, duplication de règles métier, faire chercher Claude puis trier ses trouvailles.

## S5-07 · Deux écritures du contrôle de capacité

- **Type** : bug · **Taille** : M · **Demandé par** : ex-architecte
- **Contexte** : Commentaire laissé dans une revue de code de l'ex-architecte : « Si on change la capacité par défaut, combien d'endroits faut-il toucher ? Réponse honnête : deux, et un seul est testé contre la concurrence. »
- **À faire** : `reserverCreneau` (`src/lib/reservation.ts`) verrouille la ligne `Restaurant` (`SELECT … FOR UPDATE`) et compte les couverts `CONFIRMEE`. `creerReservations` (`src/lib/api-admin/creations.ts`, vers la ligne 630) refait le même verrou et compte les couverts `statut != ANNULEE`. Écrire dans `src/lib/reservation.ts` une seule fonction qui, dans une transaction donnée, verrouille le restaurant, lit sa capacité effective et rend l'occupation d'un créneau, puis la faire utiliser par les deux appelants. Décider (et écrire en commentaire) quelle définition de l'occupation est la bonne, puisque les deux diffèrent sur les créneaux passés.
- **Critères d'acceptation** :
  - `git grep -n "SELECT capacite" -- src` ne renvoie plus qu'une ligne hors tests (le `FOR UPDATE` de `src/app/espace-restaurant/disponibilites/actions.ts` verrouille autre chose et reste).
  - `pnpm test` passe, y compris `src/lib/reservation.concurrence.test.ts` et `src/lib/api-admin/reservations.test.ts`.
  - Un nouveau test couvre la définition retenue (par exemple : une réservation honorée sur un créneau passé compte, ou ne compte pas, selon la décision).
  - `pnpm typecheck` et `pnpm lint` passent.
- **Fichiers concernés** : `src/lib/reservation.ts`, `src/lib/api-admin/creations.ts`, tests associés.
- **Ce que ça exerce** : une règle, un seul propriétaire ; refactoriser sous la protection des tests existants.

## S5-08 · La tranche « facturation et litiges » : plan de déménagement

- **Type** : enquête · **Taille** : L · **Demandé par** : ex-Head of Growth (Caro Pizzo)
- **Contexte** : Message public de l'ex-Head of Growth, passé chez Caro Pizzo : « Bon courage pour retrouver la facturation dans ce code. Même nous, on ne savait pas où elle était. »
- **À faire** : La facturation et les litiges sont éclatés entre `src/lib/facturation.ts`, `src/lib/contestation.ts`, `src/lib/contestation-labels.ts`, `src/lib/evenements-dossier.ts`, `src/lib/dossier-pieces-jointes.ts`, `src/lib/montants.ts`, une dizaine de composants (`FactureDocument`, `DeciderDossierForm`, `DemanderComplementForm`, `DeposerContestationForm`, `GenererFacturesForm`, `JournalDossier`, `PrendreEnChargeBouton`, `SeuilContestationForm`) et quatre dossiers de routes (`src/app/admin/factures/`, `src/app/admin/litiges/`, `src/app/admin/contestation/`, `src/app/espace-restaurant/factures/`). Première session : écrire `docs/architecture/tranche-facturation-litiges.md` avec la liste complète des fichiers de la tranche, ce que chaque autre partie du code en importe (son interface publique réelle), une proposition d'emplacement cible (par exemple `src/modules/facturation/` avec un `index.ts` qui expose seulement ce qui est utilisé ailleurs), et l'ordre des déplacements en petites PR. Sessions suivantes : exécuter le plan, une PR par étape, seul sur ces fichiers.
- **Critères d'acceptation** :
  - Le document liste tous les fichiers de la tranche ; `git grep` des imports cités le confirme.
  - L'interface publique proposée tient en une liste de fonctions et de types, chacun avec au moins un appelant hors tranche.
  - Le plan découpe le déménagement en étapes dont chacune laisse `pnpm typecheck`, `pnpm lint` et `pnpm test` verts.
  - Aucune modification de code dans la PR de la première session.
- **Fichiers concernés** : `docs/architecture/tranche-facturation-litiges.md` (nouveau) ; en sessions suivantes, les fichiers listés ci-dessus.
- **Ce que ça exerce** : vertical slice, frontière d'un module dans un monolithe modulaire, interface publique, migration en petites étapes.

## S5-09 · Interdire les imports d'un univers à l'autre

- **Type** : chore · **Taille** : M · **Demandé par** : ex-architecte
- **Contexte** : Règle notée par l'ex-architecte sur un post-it retrouvé dans le dépôt de notes : « L'espace restaurant n'importe jamais rien de l'admin. Personne ne le vérifie. »
- **À faire** : Ajouter à `eslint.config.mjs` des règles `no-restricted-imports` :
  - `src/app/espace-restaurant/**` n'importe ni `@/app/admin/**` ni `@/app/(site)/**` ;
  - `src/app/admin/**` n'importe ni `@/app/espace-restaurant/**` ni `@/app/(site)/**` ;
  - `src/app/(site)/**` n'importe ni `@/app/admin/**` ni `@/app/espace-restaurant/**` ;
  - `src/app/formateur/**` n'importe rien des trois autres univers, et aucun d'eux n'importe `@/app/formateur/**` ;
  - `src/lib/**` n'importe rien de `@/app/**`, sauf les fichiers `*.test.ts` (ceux de `src/lib/api-admin/` et `src/lib/avis.test.ts` importent des routes et des actions).
  Chaque règle porte un message en français qui dit quoi faire à la place. Ne pas encore toucher à `src/components/` (voir S5-10), mais noter dans la PR ce qu'une règle sur ce dossier casserait aujourd'hui.
- **Critères d'acceptation** :
  - `pnpm lint` passe sur `main` avec les nouvelles règles.
  - Un import interdit ajouté exprès (par exemple de `@/app/admin/litiges/actions` dans une page de `src/app/espace-restaurant/`) fait échouer `pnpm lint` avec le message prévu ; la sortie est collée dans la PR, l'import retiré avant le merge.
- **Fichiers concernés** : `eslint.config.mjs`.
- **Ce que ça exerce** : sens des dépendances, rendre une frontière vérifiable par la machine plutôt que par la mémoire.

## S5-10 · `src/components` : ranger ce qui n'appartient qu'au dîneur

- **Type** : chore · **Taille** : M · **Demandé par** : ex-CTO
- **Contexte** : Note de passation de l'ex-CTO : « `components/`, c'est le tiroir à tout. Dedans, des formulaires des trois univers et les vraies briques partagées, mélangés. »
- **À faire** : Classer les 49 fichiers de `src/components/` en cinq colonnes (partagé, dîneur, restaurateur, staff, formateur) d'après qui les importe ; tableau dans `docs/architecture/composants.md`. Puis déplacer uniquement les composants propres au dîneur (`AnnulerReservationBouton`, `AvisForm`, `BookingCard`, `PrevenirAbsenceBouton`, `ContactRestaurateurForm`, `ChatbotAccueil`, `ChatbotRecherche`, à confirmer par le classement) au plus près de leur route, dans des dossiers privés Next.js (`_composants/`) de `src/app/(site)/`. Vérifier dans `node_modules/next/dist/docs/` la convention des dossiers privés pour Next.js 16.
- **Critères d'acceptation** :
  - Le tableau couvre les 49 fichiers.
  - Après déplacement, `git grep -n "@/components/BookingCard"` ne renvoie rien ; les pages concernées importent le composant depuis son nouveau dossier.
  - `pnpm typecheck`, `pnpm lint`, `pnpm build` passent ; la fiche restaurant et « Mes réservations » s'affichent comme avant (capture avant/après dans la PR).
- **Fichiers concernés** : `src/components/` (sept fichiers déplacés), `src/app/(site)/page.tsx`, `src/app/(site)/restaurants/[id]/page.tsx`, `src/app/(site)/mes-reservations/page.tsx`, `src/app/(site)/devenir-partenaire/page.tsx`, `docs/architecture/composants.md` (nouveau). Chevauchement : S5-14 modifie la fiche restaurant.
- **Ce que ça exerce** : colocation, regrouper par fonctionnalité plutôt que par type technique.

## S5-11 · Le module « photos » range aussi des justificatifs de litige

- **Type** : chore · **Taille** : S · **Demandé par** : ex-DevOps
- **Contexte** : L'ex-DevOps, dans un fil sur la conformité : « Les PDF de litiges sont dans un store qui s'appelle photos. Le jour où quelqu'un rend les photos publiques en bloc… »
- **À faire** : `src/lib/dossier-pieces-jointes.ts` utilise `creerStorePhotos("dossiers-pieces-jointes")` pour des PDF privés. Renommer la fabrique générique (par exemple `creerStoreFichiers`, avec une interface `StoreFichiers`) pour que son nom dise ce qu'elle fait, sans changer les noms de buckets (`plats-photos`, `restaurants-photos`, `dossiers-pieces-jointes`) : les changer rendrait les fichiers déjà stockés introuvables. Garder `validerImage` et `lirePhoto` dans un module propre aux photos.
- **Critères d'acceptation** :
  - `git grep -n "creerStorePhotos"` ne renvoie plus rien.
  - Les trois noms de buckets sont inchangés (le diff le montre).
  - `pnpm typecheck` et `pnpm test` passent ; en local, une photo de plat envoyée avant la modification s'affiche encore après.
- **Fichiers concernés** : `src/lib/photos.ts`, `src/lib/plats-photos.ts`, `src/lib/restaurants-photos.ts`, `src/lib/dossier-pieces-jointes.ts`.
- **Ce que ça exerce** : nommer selon la responsabilité ; distinguer un renommage de code d'un changement de donnée stockée.

## S5-12 · Découper `scripts/jeu-formation/generer.ts` sans changer le plan produit

- **Type** : chore · **Taille** : M · **Demandé par** : ex-QA
- **Contexte** : Dans le carnet de l'ex-QA : « `generer.ts`, 37 Ko. Pour régler le taux de no-show, il faut faire défiler 300 lignes. »
- **À faire** : Avant tout, écrire un test qui fige la sortie : `genererJeu({ maintenant: <date fixe>, graine: 20260924 })` sérialisé en JSON, comparé à une empreinte (hash) enregistrée. Puis découper `generer.ts` par sujet (réglages en tête, restaurants et horaires, dîneurs, réservations, avis, factures et litiges) dans des fichiers voisins, en gardant `genererJeu`, `aleaSeme`, `SEUIL_SUPPOSE_CENTIMES` et les types exportés depuis `generer.ts` pour que `index.ts` et `generer.test.ts` ne changent pas.
- **Critères d'acceptation** :
  - Le test d'empreinte est commité avant le découpage (commit séparé) et passe après.
  - Aucun fichier issu du découpage ne dépasse 12 Ko.
  - `scripts/jeu-formation/index.ts` et `scripts/jeu-formation/generer.test.ts` sont inchangés ; `pnpm test` passe.
  - Les réglages (demande, saisons, taux d'annulation et de no-show, litiges) restent regroupés dans un seul fichier.
- **Fichiers concernés** : `scripts/jeu-formation/generer.ts` et nouveaux fichiers dans `scripts/jeu-formation/`.
- **Ce que ça exerce** : découper un gros fichier ; test de caractérisation avant refactorisation.

## S5-13 · Liste d'attente : où la mettre avant de la coder

- **Type** : enquête · **Taille** : M · **Demandé par** : gérante d'un restaurant partenaire
- **Contexte** : Courriel d'une gérante partenaire : « Le vendredi soir c'est complet dès mercredi, et les gens rappellent pour savoir si une table se libère. Vous ne pourriez pas les noter quelque part ? »
- **À faire** : La liste d'attente n'existe pas. Écrire `docs/adr/0005-liste-d-attente.md` au statut « Proposé », sans code. Il doit répondre à : quels univers sont touchés (le dîneur s'inscrit sur la fiche quand `reserverCreneau` lève `CreneauCompletError` ; le restaurateur voit la liste ; le staff ?) ; quel modèle Prisma (nom français, champs, contrainte d'unicité) ; où vit la règle (un module `src/lib/liste-attente.ts` appelé par l'écran et le serveur, comme `annulation.ts`) ; ce qui se passe à une annulation (`annulerReservation` dans `src/app/(site)/mes-reservations/actions.ts`) alors que le produit n'envoie aucun courriel aujourd'hui ; ce que l'API d'administration et le jeu de formation devront suivre. Lister deux options et en recommander une.
- **Critères d'acceptation** :
  - L'ADR cite au moins cinq fichiers existants qu'il faudrait modifier, et dit pourquoi pour chacun.
  - Il nomme explicitement ce qui manque au produit pour prévenir un dîneur (pas d'envoi de courriel) et en tire une conséquence sur le périmètre.
  - Un binôme non développeur peut le présenter en trois minutes à la gérante.
- **Fichiers concernés** : `docs/adr/0005-liste-d-attente.md` (nouveau).
- **Ce que ça exerce** : décider où vit une fonctionnalité avant de l'écrire ; découper par tranche verticale ; ADR au statut « Proposé ».

## S5-14 · Modération des avis : une première tranche verticale

- **Type** : feature · **Taille** : L · **Demandé par** : gérant d'un restaurant partenaire
- **Contexte** : Courriel d'un gérant partenaire : « Un avis sur notre page nomme un serveur et l'insulte. Qui peut l'enlever ? » Le README le dit : pas de modération pour l'instant, ticket « Modération des avis » ouvert.
- **À faire** : Écrire d'abord `docs/adr/0006-moderation-des-avis.md` (où vit la règle, ce que « masqué » change à la note), puis livrer la plus petite tranche complète : un membre du staff masque un avis avec un motif ; l'avis masqué disparaît de la fiche publique ; `Restaurant.noteCuilleres` et `nombreAvis` sont recalculés sans lui (`recalculerNoteRestaurant` dans `src/lib/avis.ts`) ; le geste est daté et signé. Nouvelle migration Prisma (champs du type `masqueLe`, `masqueParId`, `motifMasquage` sur `Avis`) ; ne jamais modifier une migration existante. Écran dans `src/app/admin/` (nouvelle route `avis/`), contrôle par `exigerSessionStaff`. Hors périmètre : signalement par le restaurateur, notification du dîneur.
- **Critères d'acceptation** :
  - Un nouveau dossier dans `prisma/migrations/`, aucun dossier existant modifié (`git diff --stat main -- prisma/migrations`).
  - Un test Vitest montre qu'un avis masqué ne compte plus dans la note ni dans `nombreAvis`.
  - Un dîneur qui a déjà un avis masqué ne peut pas en déposer un second (l'unicité `@@unique([restaurantId, userId])` est conservée) ; le comportement à l'écran est décrit dans l'ADR.
  - La page admin redirige vers `/connexion-admin` sans session staff.
  - `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` passent.
- **Fichiers concernés** : `prisma/schema.prisma`, nouvelle migration, `src/lib/avis.ts`, `src/app/admin/avis/` (nouveau), `src/app/(site)/restaurants/[id]/page.tsx`, le menu `MENU` de `src/app/admin/layout.tsx`, `docs/adr/0006-moderation-des-avis.md`. Chevauchements : S5-15 (schéma), S5-10 (fiche restaurant).
- **Ce que ça exerce** : tranche verticale de bout en bout (schéma, règle, écran, test) ; ADR suivi de son implémentation.

## S5-15 · `schema.prisma` en plusieurs fichiers

- **Type** : chore · **Taille** : M · **Demandé par** : ex-DBA
- **Contexte** : Note de l'ex-DBA : « 45 Ko, 1 070 lignes, quatre jeux de tables d'auth au milieu de la facturation. On ne trouve plus `Dossier` sans chercher. »
- **À faire** : Découper `prisma/schema.prisma` en un dossier `prisma/schema/` (un fichier pour le générateur et la source de données, puis un par domaine : restaurants et horaires, demandes de référencement, réservations, facturation et litiges, avis et assistant de recherche, console formateur, auth dîneur, auth restaurant, auth staff, auth formateur), en mettant à jour `schema` dans `prisma.config.ts`. Attention au chemin relatif `output = "../src/generated/prisma"` du générateur, qui dépend de l'emplacement du fichier. Garder les commentaires `///` intacts. Écrire `docs/adr/0004-schema-par-domaine.md` qui rappelle aussi la règle « le schéma suit les écrans » du README et ses conséquences (le champ `Restaurant.horaires` gardé en sursis, par exemple).
- **Critères d'acceptation** :
  - `pnpm prisma validate` passe.
  - `pnpm db:migrate` sur une base locale à jour ne crée aucune nouvelle migration (le schéma n'a pas changé, seulement sa disposition).
  - Le client généré reste dans `src/generated/prisma` ; `pnpm typecheck` et `pnpm build` passent.
  - Le nombre total de lignes `model` et `enum` est identique avant et après (commande et résultat dans la PR).
- **Fichiers concernés** : `prisma/schema.prisma` (supprimé), `prisma/schema/*.prisma` (nouveaux), `prisma.config.ts`, `docs/adr/0004-schema-par-domaine.md`. Chevauchement : S5-14.
- **Ce que ça exerce** : modularité du modèle de données ; changement de structure sans changement de comportement, prouvé par l'outil.

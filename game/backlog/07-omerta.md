# Affaire N° 7 · L'Omertà — Observabilité

Ce backlog fait pratiquer l'observabilité sur TheSpoon : faire parler une application qui se tait. Aujourd'hui, la plupart des erreurs des actions serveur sont avalées par un `catch {}` sans trace, il n'existe ni page `error.tsx`, ni point de santé, ni mesure du coût de l'assistant de recherche, et les seuls logs sont une quinzaine de `console.error` en texte libre. Les items vont de l'enquête (lire des logs, mesurer une page lente, chiffrer un coût) à la petite correction qui laisse une trace exploitable. Accessibles sans coder : S7-08 (lecture de logs et diagnostic), S7-11 (audit des données personnelles), S7-15 (coût de l'infrastructure), et la partie « réponse au dîneur » de S7-01. Chevauchements à surveiller : S7-06 et S7-07 touchent tous deux `src/lib/chatbot/agent.ts` (faire S7-07 après S7-06) ; S7-07 et S7-09 peuvent chacun ajouter une migration Prisma (modèles différents, mais `prisma/schema.prisma` commun : rebaser avant de fusionner) ; S7-05 définit le format de log que les autres items pourront adopter après coup, sans les bloquer.

Référence : la branche `main` du dépôt distant (`origin/main`, commit `d2dc6c8`). La branche `main` locale du clone de démo a 37 commits de retard et n'a pas encore l'assistant de recherche : faire `git pull` avant la session.

| ID | Titre | Type | Taille | Demandé par |
|---|---|---|---|---|
| S7-01 | « Pourquoi je n'ai eu aucune table ? » | enquête | M | un dîneur (email au support) |
| S7-02 | L'annulation qui échoue sans laisser de trace | bug | S | un dîneur (email au support) |
| S7-03 | Le pointage honoré / no-show qui échoue sans trace | bug | S | la gérante d'un restaurant partenaire |
| S7-04 | Des pages d'erreur avec un code à donner au support | feature | M | l'ex-CPO |
| S7-05 | Un journal structuré et un identifiant de requête | chore | L | l'ex-SRE |
| S7-06 | Le coût de chaque recherche de l'assistant | feature | M | l'ex-CEO |
| S7-07 | Un budget quotidien pour l'assistant, avec alerte | feature | L | l'ex-CEO |
| S7-08 | « L'assistant ne répond plus » : lire les logs | enquête | S | l'ex-Head of Growth (désormais chez Caro Pizzo) |
| S7-09 | Le tableau de bord staff est lent | enquête | M | l'ex-DBA |
| S7-10 | Un point de santé pour la surveillance | feature | S | l'ex-DevOps |
| S7-11 | Données personnelles dans les logs et les demandes à l'assistant | enquête | M | un dîneur (demande d'accès RGPD) |
| S7-12 | Photo absente ou stockage en panne ? | bug | M | le gérant d'un restaurant partenaire |
| S7-13 | Un restaurant en échec bloque la facturation des suivants | bug | M | le gérant d'un restaurant partenaire |
| S7-14 | Repérer un pic de no-show | feature | M | l'ex-CPO (note laissée dans le backlog) |
| S7-15 | Combien coûte TheSpoon, lumière allumée ? | enquête | S | l'ex-CEO |

---

## S7-01 · « Pourquoi je n'ai eu aucune table ? »

- **Type** : enquête · **Taille** : M · **Demandé par** : un dîneur (email au support)
- **Contexte** : « J'ai essayé de réserver pour 4 samedi soir chez Trattoria Bellini, on m'a dit "Ce créneau n'est plus disponible". Mon ami a réservé juste après. Vous pouvez m'expliquer ? »
- **À faire** :
  - Lire `creerReservation` dans `src/app/(site)/restaurants/[id]/actions.ts` et lister tous les chemins qui refusent une réservation : sélection invalide, hors des 5 jours (`estDansLaFenetreReservable`), restaurant introuvable, créneau fermé (`creneauEstOuvert`), créneau complet (`CreneauCompletError`), erreur inattendue. Aucun ne laisse de trace aujourd'hui, et le dernier avale l'erreur.
  - Ajouter, pour chaque refus, une ligne de log avec un code de motif stable (`hors_fenetre`, `ferme`, `complet`, `selection_invalide`, `restaurant_introuvable`, `erreur_inattendue`), l'id du restaurant, le jour et le créneau demandés. Pas d'email ni de nom du dîneur : son id suffit.
  - Pour `erreur_inattendue`, logguer l'erreur elle-même (`console.error`), pas seulement le motif.
  - Rejouer le cas en local et rédiger, en trois phrases, la réponse au dîneur (les deux hypothèses plausibles : créneau complet entre-temps, ou réservation au-delà des 5 jours).
- **Critères d'acceptation** :
  - En local, chaque refus provoqué à la main (créneau fermé via « Mes disponibilités », créneau rempli, jour J+6 forcé dans le formulaire) produit une ligne de log avec le bon code de motif.
  - Une erreur inattendue (base coupée) produit une ligne `erreur_inattendue` avec la pile d'appel.
  - Aucune ligne ne contient d'email, de nom ou de mot de passe.
  - Le message affiché au dîneur ne change pas.
  - `pnpm typecheck`, `pnpm lint` et `pnpm test` passent.
- **Fichiers concernés** : `src/app/(site)/restaurants/[id]/actions.ts`, lecture de `src/lib/disponibilites.ts`, `src/lib/creneaux.ts`, `src/lib/reservation.ts`.
- **Ce que ça exerce** : reconstituer un parcours à partir du code, journaliser une décision métier avec un motif exploitable, distinguer refus attendu et erreur.
- **Préparation formateur** : facultatif. Sur la base locale de démo (`pnpm seed:dev`), ajouter une fermeture exceptionnelle le samedi soir suivant pour Trattoria Bellini, pour que le refus « fermé » soit reproductible sans manipulation.

## S7-02 · L'annulation qui échoue sans laisser de trace

- **Type** : bug · **Taille** : S · **Demandé par** : un dîneur (email au support)
- **Contexte** : « J'ai cliqué trois fois sur Annuler, trois fois "Impossible d'annuler la réservation, réessaie". Le restaurant m'a compté no-show. »
- **À faire** : dans `src/app/(site)/mes-reservations/actions.ts`, les deux `catch {}` de `annulerReservation` et `signalerAbsence` renvoient un message générique sans rien écrire. Logguer l'erreur avec l'action concernée et l'id de la réservation, sans données personnelles. Écrire un test qui simule l'échec de l'écriture Prisma et vérifie que l'erreur est journalisée.
- **Critères d'acceptation** :
  - Un échec de `prisma.booking.update` produit une ligne `console.error` qui contient le nom de l'action (`annulerReservation` ou `signalerAbsence`) et l'id de la réservation.
  - Le message affiché au dîneur reste le même.
  - Un test Vitest couvre le cas (mock de Prisma ou de la fonction d'écriture) et passe.
- **Fichiers concernés** : `src/app/(site)/mes-reservations/actions.ts`, nouveau test à côté.
- **Ce que ça exerce** : repérer une erreur avalée, journaliser sans fuite de données personnelles, tester un chemin d'erreur.

## S7-03 · Le pointage honoré / no-show qui échoue sans trace

- **Type** : bug · **Taille** : S · **Demandé par** : la gérante d'un restaurant partenaire
- **Contexte** : « Le soir, je pointe mes tables. Parfois ça répond "Impossible d'enregistrer le signalement", je recommence, et à la fin du mois la facture ne compte pas ces couverts. »
- **À faire** : dans `marquerReservation` (`src/app/espace-restaurant/reservations/actions.ts`), le `catch {}` avale l'erreur. Logguer l'erreur avec l'id de la réservation et le statut demandé. Distinguer dans les logs le cas « déjà traitée » (`count === 0`, attendu) de l'échec technique. Tester les deux chemins.
- **Critères d'acceptation** :
  - Un échec technique produit une ligne `console.error` avec l'id de la réservation et le statut demandé (`HONOREE` ou `NO_SHOW`).
  - Le cas « déjà traitée » produit au plus une ligne de niveau information, pas une erreur.
  - Les messages affichés au restaurateur ne changent pas.
  - Un test couvre chacun des deux chemins.
- **Fichiers concernés** : `src/app/espace-restaurant/reservations/actions.ts`, nouveau test.
- **Ce que ça exerce** : niveaux de log (information et erreur), lien entre une erreur silencieuse et un effet métier visible un mois plus tard (la facture).

## S7-04 · Des pages d'erreur avec un code à donner au support

- **Type** : feature · **Taille** : M · **Demandé par** : l'ex-CPO
- **Contexte** : Note dans le backlog : « Quand ça plante, l'utilisateur voit la page d'erreur brute de Next.js et nous écrit "ça marche pas". On ne retrouve jamais l'erreur dans les logs. »
- **À faire** :
  - Aucun `error.tsx` n'existe dans `src/app`. En ajouter un par univers : `src/app/(site)/error.tsx`, `src/app/espace-restaurant/error.tsx`, `src/app/admin/error.tsx`, plus `src/app/global-error.tsx`, avec la charte de chaque univers (`src/lib/univers.ts`, `src/lib/ui.ts`).
  - Afficher le `digest` de l'erreur fourni par Next.js comme « code à communiquer au support », et un bouton « Réessayer ».
  - Vérifier, en provoquant une erreur côté serveur, que le même `digest` apparaît dans la sortie du serveur (`pnpm build && pnpm start`), et noter dans le README comment retrouver une erreur à partir de ce code dans les logs Netlify.
  - Lire la documentation de Next.js 16 dans `node_modules/next/dist/docs/` avant d'écrire (voir `AGENTS.md`).
- **Critères d'acceptation** :
  - Une erreur levée volontairement dans une page de chaque univers affiche la page d'erreur de cet univers avec un code.
  - Le code affiché se retrouve dans la sortie de `pnpm start` à côté de l'erreur.
  - Aucun détail technique (message, pile) n'est affiché à l'utilisateur en production.
  - Le README a un paragraphe « Retrouver une erreur signalée ».
- **Fichiers concernés** : `src/app/(site)/error.tsx`, `src/app/espace-restaurant/error.tsx`, `src/app/admin/error.tsx`, `src/app/global-error.tsx` (tous nouveaux), `README.md`.
- **Ce que ça exerce** : relier ce que voit l'utilisateur à ce que voit l'équipe, identifiant de corrélation, ne pas exposer d'informations internes.

## S7-05 · Un journal structuré et un identifiant de requête

- **Type** : chore · **Taille** : L · **Demandé par** : l'ex-SRE
- **Contexte** : Message laissé dans le canal d'astreinte : « Les logs sont des phrases. Impossible de filtrer toutes les erreurs de l'API admin d'un après-midi, ou de suivre une requête d'un bout à l'autre. »
- **À faire** :
  - Créer `src/lib/journal.ts` : une fonction qui écrit une ligne JSON par événement (`niveau`, `evenement`, `message`, `requeteId`, champs libres, horodatage ISO), et qui refuse les clés connues comme sensibles (`email`, `motDePasse`, `token`, `authorization`).
  - Identifiant de requête : reprendre l'en-tête `x-nf-request-id` posé par Netlify s'il existe, sinon en générer un (`crypto.randomUUID()`).
  - Première séance : l'adopter dans `routeAdmin` (`src/lib/api-admin/reponses.ts`), avec une ligne par appel (route, méthode, statut, durée) et une ligne d'erreur pour les 500. Renvoyer l'identifiant dans un en-tête de réponse.
  - Séances suivantes : écrire dans le README la convention (noms d'événements, niveaux), puis migrer les autres `console.error` de `src/` un fichier à la fois, chacun dans sa PR.
- **Critères d'acceptation** :
  - Des tests de `src/lib/journal.ts` vérifient le format JSON et le refus des clés sensibles.
  - Un appel à `/api/admin/restaurants` avec un mauvais jeton produit une seule ligne JSON avec statut 401 et durée, et la réponse porte l'en-tête d'identifiant.
  - Une erreur 500 de l'API admin produit une ligne `niveau: "erreur"` avec le même identifiant que la réponse.
  - Les tests existants de `src/lib/api-admin/` passent toujours.
- **Fichiers concernés** : `src/lib/journal.ts` (nouveau) et son test, `src/lib/api-admin/reponses.ts`, `README.md`.
- **Ce que ça exerce** : logs structurés, corrélation par identifiant de requête, conventions de nommage, migration progressive.

## S7-06 · Le coût de chaque recherche de l'assistant

- **Type** : feature · **Taille** : M · **Demandé par** : l'ex-CEO
- **Contexte** : « La facture OpenRouter de septembre a doublé et personne ne sait dire combien coûte une recherche. »
- **À faire** :
  - Dans `lancerAgent` (`src/lib/chatbot/agent.ts`), additionner `reponse.usage` (tokens en entrée, en sortie, lus en cache) sur tous les tours de la boucle.
  - Poser les prix par million de tokens du modèle utilisé par chaque fournisseur en constantes, avec en commentaire la page de tarifs d'où ils viennent et la date de lecture.
  - En fin de recherche, quelle que soit l'issue (top 10 servi, question au dîneur, trop long, erreur), écrire une ligne de log : fournisseur, modèle, nombre de tours, tokens, coût estimé en euros, durée, issue. Rien du texte de la demande.
  - Extraire le calcul du coût dans une fonction pure et la tester.
- **Critères d'acceptation** :
  - Une recherche en local (avec une clé) produit exactement une ligne de coût, avec un nombre de tours égal au nombre d'appels au modèle.
  - Le calcul du coût est couvert par un test (au moins : un tour, plusieurs tours, tokens en cache).
  - Le cas « repli sur Anthropic après refus d'OpenRouter » (`refusDAuthentification`) indique le fournisseur réellement utilisé.
  - `src/lib/chatbot/agent.test.ts` passe toujours.
- **Fichiers concernés** : `src/lib/chatbot/agent.ts`, `src/lib/chatbot/agent.test.ts`, éventuellement `src/lib/chatbot/cout.ts` (nouveau).
- **Ce que ça exerce** : mesurer un coût à la source, journaliser une métrique, tester un calcul.

## S7-07 · Un budget quotidien pour l'assistant, avec alerte

- **Type** : feature · **Taille** : L · **Demandé par** : l'ex-CEO
- **Contexte** : « Je veux savoir le jour même si l'assistant a coûté plus de 20 € dans la journée, pas à la fin du mois. »
- **À faire** :
  - Dépend de S7-06. Enregistrer chaque recherche (date, fournisseur, tokens, coût, issue) dans une nouvelle table, par une **nouvelle** migration Prisma. Ne pas réutiliser `PropositionAssistant`, qui n'est créée que lorsqu'un top 10 est servi.
  - Variable `ASSISTANT_BUDGET_JOUR_EUROS` (dans `src/lib/env.ts` et `.env.example`). Le « jour » est le jour de Paris (`aujourdHuiIso`, `debutDeJournee` de `src/lib/fuseau.ts`), pas le jour UTC.
  - Quand une recherche fait passer le total du jour au-dessus du budget, écrire une ligne de log de niveau alerte, une seule fois par jour.
  - Afficher le coût du jour et des 7 derniers jours sur `/formateur/fonctionnalites`, à côté de l'interrupteur de l'assistant. Ne pas couper l'assistant automatiquement : la coupure reste un geste du formateur, tracé dans `JournalFormateur`.
- **Critères d'acceptation** :
  - La migration est un nouveau dossier dans `prisma/migrations/` ; aucune migration existante n'est modifiée.
  - Un test vérifie le total d'une journée de Paris autour de minuit (une recherche à 23 h 30 et une à 0 h 30 heure de Paris tombent sur deux jours différents).
  - Un test vérifie que l'alerte ne part qu'une fois par jour.
  - `/formateur/fonctionnalites` affiche le coût et le nombre de recherches du jour et des 7 derniers jours, et le budget configuré ; sans budget configuré, il le dit au lieu d'afficher un seuil inventé.
- **Fichiers concernés** : `prisma/schema.prisma`, nouvelle migration, `src/lib/chatbot/agent.ts`, `src/lib/env.ts`, `.env.example`, `src/app/formateur/fonctionnalites/page.tsx`, nouveau module `src/lib/chatbot/budget.ts` et son test.
- **Ce que ça exerce** : transformer une métrique en alerte, seuil et fréquence d'alerte, coût d'un service tiers, fuseau horaire d'une agrégation.

## S7-08 · « L'assistant ne répond plus » : lire les logs

- **Type** : enquête · **Taille** : S · **Demandé par** : l'ex-Head of Growth (désormais chez Caro Pizzo)
- **Contexte** : Il a publié sur LinkedIn une capture de l'accueil TheSpoon avec « L'assistant est très demandé en ce moment, réessaie dans une minute », légendée « Toujours debout ? ».
- **À faire** :
  - Lire les logs de la fonction serveur sur l'environnement fourni par le formateur (Netlify, onglet des logs des fonctions, ou sortie de `pnpm dev` en local).
  - Retrouver la cause : clé OpenRouter écartée (ligne « OPENROUTER_API_KEY ignorée »), refus d'authentification avec repli, quota (429), surcharge (529), ou coupure à 25 s (`BUDGET_MS`).
  - Relire les commits `e12b4a8` et `00dffd7` de l'historique, qui décrivent deux pannes passées du même assistant.
  - Écrire le diagnostic en cinq lignes au plus : symptôme, ligne de log qui le prouve, cause, correction, comment vérifier.
  - Petite correction : dans `src/app/api/chatbot/route.ts`, la ligne « Chatbot en échec » ne dit pas le statut HTTP du fournisseur. L'ajouter (`erreur.status`, nom de la classe d'erreur), sans le corps de la réponse.
- **Critères d'acceptation** :
  - Le diagnostic cite la ligne de log exacte et la variable d'environnement en cause.
  - Après correction de la configuration, une recherche aboutit sur l'environnement fourni.
  - La ligne « Chatbot en échec » contient le statut ; `src/app/api/chatbot/route.test.ts` passe.
- **Fichiers concernés** : `src/app/api/chatbot/route.ts`, `src/app/api/chatbot/route.test.ts`, lecture de `src/lib/chatbot/agent.ts`.
- **Ce que ça exerce** : partir d'un symptôme, trouver la ligne de log qui prouve la cause, lire l'historique des incidents. Accessible sans coder pour la partie diagnostic.
- **Préparation formateur** : sur un environnement de test (un Deploy Preview ou un `.env` local distribué aux binômes), poser `OPENROUTER_API_KEY` entre guillemets ou sans son préfixe `sk-or-`, et une `ANTHROPIC_API_KEY` révoquée ; lancer quelques recherches avant la séance pour que les logs contiennent les lignes à trouver. Donner l'accès en lecture aux logs Netlify du site, ou la sortie de `pnpm dev`.

## S7-09 · Le tableau de bord staff est lent

- **Type** : enquête · **Taille** : M · **Demandé par** : l'ex-DBA
- **Contexte** : « `/admin/tableau-de-bord` sur 90 jours met plusieurs secondes à s'afficher depuis que le jeu de formation est en base. Avant d'ajouter un index, mesurez. »
- **À faire** :
  - Mesurer le temps d'affichage de la page sur 7, 30 et 90 jours (`?periode=`), avec la base remplie.
  - Activer le journal des requêtes Prisma (option `log` dans `src/lib/prisma.ts`, derrière une variable comme `PRISMA_LOG=query`, désactivée par défaut) et relever les requêtes de la page et leur durée.
  - Regarder le plan d'exécution (`EXPLAIN ANALYZE`) des deux `prisma.booking.findMany` et du `groupBy` de `src/app/admin/tableau-de-bord/page.tsx` : le modèle `Booking` n'a d'index ni sur `date` ni sur `createdAt`.
  - Conclure : index manquant, trop de lignes ramenées en mémoire, ou les deux. Si un index se justifie par la mesure, l'ajouter par une nouvelle migration.
- **Critères d'acceptation** :
  - Un tableau « avant / après » des temps mesurés (mêmes conditions, trois mesures chacune) dans la description de la PR.
  - Le journal des requêtes Prisma s'active par variable d'environnement et ne s'active pas en production par défaut ; la variable est documentée dans `.env.example`.
  - Si un index est ajouté : nouvelle migration, aucune ancienne modifiée, et le plan d'exécution montre son utilisation.
  - Les chiffres affichés par le tableau de bord ne changent pas (`src/lib/indicateurs.test.ts` passe).
- **Fichiers concernés** : `src/lib/prisma.ts`, `.env.example`, `src/app/admin/tableau-de-bord/page.tsx` (lecture), `prisma/schema.prisma` et nouvelle migration si besoin.
- **Ce que ça exerce** : mesurer avant d'optimiser, journal de requêtes, plan d'exécution, index.
- **Préparation formateur** : une base locale ou de test remplie par `pnpm jeu-formation` (plan + injection pilote et tout), à partager aux binômes sous forme de dump ou de chaîne de connexion en lecture seule. Ne pas faire tourner les mesures sur la base Neon partagée avec la production.

## S7-10 · Un point de santé pour la surveillance

- **Type** : feature · **Taille** : S · **Demandé par** : l'ex-DevOps
- **Contexte** : Ticket ouvert : « On apprend les pannes par les restaurants. Il faut une URL qu'un service de surveillance peut appeler toutes les minutes. »
- **À faire** : créer `GET /api/sante` qui répond 200 avec `{ statut: "ok", base: "ok", version }` si un `SELECT 1` passe en moins de 2 s, et 503 sinon. `version` vient de la variable `COMMIT_REF` posée par Netlify au build (« inconnue » en local). Pas de secret, pas de détail d'erreur dans la réponse, `Cache-Control: no-store`. Écrire le test, puis documenter dans le README comment brancher un service de surveillance gratuit sur cette URL.
- **Critères d'acceptation** :
  - `curl -i http://localhost:3100/api/sante` répond 200 et le JSON attendu.
  - Base arrêtée, la route répond 503 en moins de 3 s, sans pile d'erreur dans le corps ; l'erreur est journalisée côté serveur.
  - Un test couvre les deux cas.
  - Le README dit quelle URL surveiller et à quelle fréquence.
- **Fichiers concernés** : `src/app/api/sante/route.ts` (nouveau) et son test, `README.md`.
- **Ce que ça exerce** : point de santé, surveillance de disponibilité, délai maximal, ne rien exposer.

## S7-11 · Données personnelles dans les logs et les demandes à l'assistant

- **Type** : enquête · **Taille** : M · **Demandé par** : un dîneur (demande d'accès RGPD)
- **Contexte** : « En application de l'article 15 du RGPD, je vous demande la liste des données me concernant que vous conservez, y compris dans vos journaux techniques. »
- **À faire** :
  - Lister chaque `console.error` / `console.log` de `src/` (une quinzaine, `git grep -n "console\."`) et, pour chacun, ce qu'il peut écrire : l'erreur brute de Prisma peut contenir les valeurs de la requête, `src/lib/api-admin/reponses.ts` journalise une erreur qui peut venir d'un corps contenant un mot de passe, etc.
  - Regarder `PropositionAssistant.demande` (`prisma/schema.prisma`) : le texte libre tapé par le dîneur, conservé sans limite de durée et affiché sur le tableau de bord staff (« derniers cœurs brisés avec leur demande »). Un dîneur peut y écrire une allergie, donc une donnée de santé.
  - Rédiger une note de décision : ce qui part dans les logs, ce qui est conservé en base, combien de temps, ce qu'il faut changer (masquage, durée de conservation, purge). Proposer la réponse au dîneur.
- **Critères d'acceptation** :
  - La note `docs/notes/audit-donnees-personnelles.md` contient un tableau « fichier, ligne, ce qui peut sortir, risque, action proposée » qui couvre tous les `console.*` de `src/`.
  - Elle traite explicitement `PropositionAssistant.demande` et son affichage sur `/admin/tableau-de-bord`.
  - Elle propose une durée de conservation et la manière de l'appliquer (sans l'implémenter).
  - Le brouillon de réponse au dîneur tient en dix lignes.
- **Fichiers concernés** : `docs/notes/audit-donnees-personnelles.md` (nouveau) ; lecture de `src/lib/api-admin/reponses.ts`, `src/lib/chatbot/agent.ts`, `src/app/admin/tableau-de-bord/page.tsx`, `prisma/schema.prisma`.
- **Ce que ça exerce** : ce qu'un log ne doit pas contenir, durée de conservation, données de santé. Accessible sans coder : lecture et rédaction, Claude Code pour lister et expliquer.

## S7-12 · Photo absente ou stockage en panne ?

- **Type** : bug · **Taille** : M · **Demandé par** : le gérant d'un restaurant partenaire
- **Contexte** : « Ce matin, toutes les photos de mes plats avaient disparu de ma fiche, puis elles sont revenues vers midi. J'ai cru que j'avais tout perdu. »
- **À faire** :
  - Dans `src/app/api/plats/[platId]/photo/route.ts` et `src/app/api/restaurants/[id]/photo/route.ts`, une panne de Netlify Blobs est journalisée puis transformée en 404, le même code que « ce plat n'a pas de photo ». Distinguer les deux : 404 sans photo, 503 avec `Cache-Control: no-store` quand le stockage ne répond pas.
  - Ajouter le nom du store (`plats-photos` ou `restaurants-photos`) dans les lignes de log de `src/lib/photos.ts` et des deux routes, pour pouvoir compter les pannes par store.
  - Vérifier que `PhotoCouverture` affiche toujours la photo de repli dans les deux cas.
  - Tester les deux routes avec un store simulé qui lève une erreur.
- **Critères d'acceptation** :
  - Un store qui lève une erreur donne 503 et une ligne de log avec le nom du store ; un store qui ne trouve rien donne 404 sans ligne d'erreur.
  - Une photo trouvée garde son en-tête `Cache-Control: public, max-age=31536000, immutable` et `X-Content-Type-Options: nosniff`.
  - Tests ajoutés pour les deux routes.
- **Fichiers concernés** : `src/app/api/plats/[platId]/photo/route.ts`, `src/app/api/restaurants/[id]/photo/route.ts`, `src/lib/photos.ts`, tests associés.
- **Ce que ça exerce** : un code de statut qui dit la vérité, distinguer « absent » de « en panne », cache et erreurs.

## S7-13 · Un restaurant en échec bloque la facturation des suivants

- **Type** : bug · **Taille** : M · **Demandé par** : le gérant d'un restaurant partenaire
- **Contexte** : « Tous les restaurants de la rue ont reçu leur facture d'octobre, pas nous. »
- **À faire** :
  - Dans `genererFacturesMois` (`src/lib/facturation.ts`), la boucle sur les restaurants s'arrête à la première erreur autre qu'un doublon (`P2002`) : les restaurants traités avant ont leur facture, ceux d'après non, et l'écran du staff (`genererFacturesDuMois`, `src/app/admin/factures/actions.ts`) ne dit rien d'utile.
  - Continuer après l'échec d'un restaurant, journaliser chaque échec (id du restaurant, mois, erreur), et renvoyer la liste des restaurants en échec dans le résultat.
  - Afficher dans `GenererFacturesForm` : « 48 factures créées, 2 en échec : … (relancer la génération pour les reprendre) ». Relancer reste sans risque, la génération étant idempotente à la ligne.
- **Critères d'acceptation** :
  - Un test simule l'échec d'un restaurant au milieu de trois : les deux autres ont leur facture, le résultat liste celui en échec.
  - Une ligne de log par restaurant en échec, avec son id et le mois.
  - L'écran du staff affiche le nombre et les noms des restaurants en échec.
  - `src/lib/facturation.test.ts` passe toujours ; la règle d'idempotence n'est pas modifiée.
- **Fichiers concernés** : `src/lib/facturation.ts`, `src/lib/facturation.test.ts`, `src/app/admin/factures/actions.ts`, `src/components/GenererFacturesForm.tsx`.
- **Ce que ça exerce** : échec partiel d'un traitement par lot, rendre une erreur visible à la bonne personne, alerte métier.

## S7-14 · Repérer un pic de no-show

- **Type** : feature · **Taille** : M · **Demandé par** : l'ex-CPO (note laissée dans le backlog)
- **Contexte** : « Un restaurant qui passe de 5 % à 25 % de no-show en une semaine, c'est soit un problème de dîneurs, soit un restaurant qui pointe mal. On l'apprend toujours par la contestation de facture. »
- **À faire** :
  - Ajouter dans `src/lib/indicateurs.ts` une fonction pure qui, à partir des réservations pointées des 7 derniers jours et des 7 précédents par restaurant, rend les restaurants dont le taux de no-show dépasse un seuil (par exemple 20 % et au moins 10 services pointés). Même règle que le reste du module : rien à compter n'est pas zéro.
  - Écrire `scripts/signaux-metier.ts` (lancé par `pnpm signaux`) qui lit la base et affiche ces restaurants, avec leurs deux taux. Les bornes de période passent par `bornesPeriode` (jours de Paris).
  - Ne pas toucher à `/admin/tableau-de-bord` dans cet item (voir S7-09).
- **Critères d'acceptation** :
  - Tests de la fonction : sous le seuil, au-dessus, trop peu de services pointés (rend « pas assez de données », pas 0 %).
  - `pnpm signaux` sur la base de démo affiche une liste (éventuellement vide, avec une phrase qui le dit).
  - Le script n'écrit rien en base.
- **Fichiers concernés** : `src/lib/indicateurs.ts`, `src/lib/indicateurs.test.ts`, `scripts/signaux-metier.ts` (nouveau), `package.json` (script).
- **Ce que ça exerce** : signal métier contre signal technique, seuil et volume minimal, observer le produit et pas seulement le serveur.

## S7-15 · Combien coûte TheSpoon, lumière allumée ?

- **Type** : enquête · **Taille** : S · **Demandé par** : l'ex-CEO
- **Contexte** : « Avant de signer quoi que ce soit avec les 50, je veux savoir combien coûte le site par mois quand personne n'y touche, et quand tout le monde y touche. »
- **À faire** : relever, dans les consoles Netlify (fonctions, bande passante, Blobs, minutes de build) et Neon (temps de calcul, stockage), la consommation des 30 derniers jours, et la facture de l'assistant (OpenRouter ou Anthropic). En déduire un coût mensuel au repos et une estimation pour 50 restaurants actifs, en indiquant les hypothèses. Repérer ce qui coûte sans servir : builds de Deploy Previews, base Neon qui ne se met jamais en veille, etc.
- **Critères d'acceptation** :
  - Une note `docs/notes/cout-mensuel.md` avec un tableau « poste, consommation relevée, prix unitaire, coût mensuel, source » et la date du relevé.
  - Au moins une piste d'économie chiffrée.
  - Les hypothèses de l'estimation « 50 restaurants actifs » sont écrites.
- **Fichiers concernés** : `docs/notes/cout-mensuel.md` (nouveau).
- **Ce que ça exerce** : le coût comme signal d'observabilité, lire les consoles des fournisseurs. Accessible sans coder.
- **Préparation formateur** : donner un accès en lecture aux tableaux de consommation Netlify et Neon du site `the-spoon-bootcamp` (ou des captures datées), et le montant de la dernière facture de l'assistant.

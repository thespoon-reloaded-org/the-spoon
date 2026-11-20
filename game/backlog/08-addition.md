# Affaire N° 8 · L'Addition — Mise en pratique transversale

Dernière session, jour de l'échéance du contrat avec les 50 restaurants. Chaque item est un changement complet, du ticket à la vérification en production : issue, branche, tests, migration si besoin, relecture selon `REVIEW.md`, CI verte, Deploy Preview, fusion, déploiement, vérification en production avec les logs. Les demandes viennent des restaurants, des dîneurs et du contrat. Accessibles sans coder : S8-01 (go / no-go du contrat), S8-02 (post-mortem), S8-15 (README) ; S8-06 et S8-12 sont de petits changements guidés. Chevauchements à surveiller : `src/app/(site)/mes-reservations/page.tsx` est touché par S8-03, S8-12 et S8-14 ; `src/lib/reservation.ts` et `src/lib/disponibilites.ts` par S8-03 et S8-04 ; `prisma/schema.prisma` par S8-03, S8-05, S8-10, S8-13 et S8-14 (S8-10 et S8-14 ajoutent tous deux des champs à `Booking`) ; `README.md` par S8-04 et S8-15. Fusionner dans l'ordre d'arrivée et, après un rebase qui touche le schéma, régénérer sa migration plutôt que de corriger celle d'un autre.

Référence : la branche `main` du dépôt distant (`origin/main`, commit `d2dc6c8`).

**Attention, base partagée.** Les Deploy Previews et la production utilisent la même base Neon, et `pnpm build` lance `prisma migrate deploy` : **la migration d'une PR s'applique à la base de production dès que son Deploy Preview se construit, avant toute fusion**. Une migration doit donc rester compatible avec le code de production en cours (ajouter une colonne facultative ou une table : oui ; supprimer ou renommer une colonne que la production lit encore : non). Et tout ce qu'on crée en testant un Deploy Preview est une vraie donnée, qui reste.

### Parcours complet (commun à tous les items, sauf S8-01 et S8-02)

1. Issue GitHub qui reprend l'item, avec ses critères d'acceptation.
2. Branche dédiée, nommée d'après l'issue.
3. Tests écrits avec le changement (Vitest), qui échouent avant et passent après pour un bug.
4. Migration si le schéma change : nouveau dossier dans `prisma/migrations/`, jamais une migration existante modifiée, compatible avec le code de production en cours.
5. PR qui lie l'issue, relue par un autre binôme selon `REVIEW.md`.
6. CI verte : `typecheck`, `lint`, `build` (migrations sur base vierge), `test` (`.github/workflows/ci.yml`).
7. Vérification sur le Deploy Preview, en sachant qu'il écrit dans la base réelle.
8. Fusion, déploiement en production, vérification en production et lecture des logs de la fonction serveur sur Netlify.
9. Commentaire de clôture dans l'issue : ce qui a été vérifié en production, avec la preuve (capture, ligne de log, requête).

Chaque item précise ce que ces étapes demandent de particulier.

| ID | Titre | Type | Taille | Demandé par |
|---|---|---|---|---|
| S8-01 | Go / no-go du contrat des 50 | enquête | M | le contrat (art. 12) et l'ex-CEO |
| S8-02 | Post-mortem : la panne de l'assistant du 1er octobre | enquête | M | l'ex-SRE |
| S8-03 | Liste d'attente sur un créneau complet | feature | L | la gérante d'un restaurant partenaire |
| S8-04 | Deux tables de 6 à 19 h et 19 h 30 dans une salle de 10 | bug | M | le gérant d'un restaurant partenaire |
| S8-05 | Modérer un avis | feature | M | un restaurateur partenaire |
| S8-06 | « Absence prévenue » visible dans le litige | feature | S | l'instructeur des litiges (staff) |
| S8-07 | Export comptable des factures du mois | feature | M | l'expert-comptable d'un restaurant partenaire |
| S8-08 | L'avoir d'octobre porte une référence de septembre | bug | S | l'expert-comptable d'un restaurant partenaire |
| S8-09 | Chercher un restaurant sans un allergène | feature | M | une dîneuse (email au support) |
| S8-10 | Rappel de réservation la veille | feature | L | le gérant d'un restaurant partenaire |
| S8-11 | Fermer une période de congés en une fois | feature | M | la gérante d'un restaurant partenaire |
| S8-12 | Ajouter sa réservation à son agenda | feature | S | un dîneur (email au support) |
| S8-13 | Supprimer `Restaurant.horaires` sans casser la production | chore | M | l'ex-architecte (TODO dans le schéma) |
| S8-14 | Le restaurant annule une réservation | feature | M | le gérant d'un restaurant partenaire |
| S8-15 | Le README dit que la facturation n'existe pas | chore | S | l'ex-CPO |

---

## S8-01 · Go / no-go du contrat des 50

- **Type** : enquête · **Taille** : M · **Demandé par** : le contrat (art. 12) et l'ex-CEO
- **Contexte** : Article 12 du contrat : « Au 22 janvier, le service de réservation est accessible aux dîneurs et aux restaurants partenaires, la facturation du mois écoulé est émise, et les incidents sont suivis. » L'ex-CEO : « Je veux une liste, chaque ligne avec sa preuve, pas un "ça a l'air bon". »
- **À faire** : construire la liste de contrôle et la remplir en production, une ligne par point, avec OK / KO / non vérifiable et la preuve :
  - `main` est vert en CI et la production sert le dernier commit de `main` (comparer le commit déployé sur Netlify avec `git log origin/main -1`).
  - Les migrations du dépôt sont toutes appliquées et le schéma réel correspond (requêtes `pg_indexes` et `information_schema.columns` du README, section « Migrations »).
  - Les 50 restaurants existent, chacun avec au moins un contact qui peut se connecter sur `/connexion-restaurant` (requête de comptage, un essai de connexion sur trois restaurants tirés au hasard).
  - Un dîneur peut réserver, annuler, déposer un avis (parcours fait à la main en production avec un compte de test, puis annulé).
  - Les factures de décembre sont générées (`/admin/factures`, ou `GET /api/admin/factures?mois=2026-12`).
  - L'assistant répond, ou est coupé volontairement par un formateur (`/formateur/fonctionnalites`).
  - Le point de santé et la surveillance de disponibilité, s'ils ont été livrés à l'affaire 7, répondent.
  - Les secrets ne sont plus dans l'historique (affaire 4), les sauvegardes Neon sont actives et la durée de restauration possible est connue.
  - Conclure par go ou no-go, avec la liste des réserves.
- **Critères d'acceptation** :
  - `docs/notes/go-no-go-2027-01-22.md` contient toutes les lignes ci-dessus, chacune avec un statut et une preuve vérifiable (commande, requête, capture datée).
  - Aucune ligne « OK » sans preuve.
  - La décision finale et ses réserves tiennent en cinq lignes.
  - Les données de test créées en production sont listées et annulées.
- **Fichiers concernés** : `docs/notes/go-no-go-2027-01-22.md` (nouveau).
- **Ce que ça exerce** : vérifier en production, preuve plutôt qu'impression, relier toutes les affaires précédentes. Accessible sans coder ; Claude Code aide à écrire les requêtes et les commandes.
- **Préparation formateur** : donner à ce binôme un accès en lecture à Netlify (déploiements, logs) et une chaîne de connexion Neon en lecture seule, et un compte dîneur de test en production.

## S8-02 · Post-mortem : la panne de l'assistant du 1er octobre

- **Type** : enquête · **Taille** : M · **Demandé par** : l'ex-SRE
- **Contexte** : « On a corrigé deux fois l'assistant le même soir et on n'a jamais écrit ce qui s'était passé. La prochaine fois, ça recommencera. »
- **À faire** :
  - Reconstituer la chronologie à partir de l'historique : commits `e12b4a8` (403 de l'AI Gateway et coupure à 30 s) et `00dffd7` (clé OpenRouter invalide, repli sur Anthropic), PR #57, et le code actuel de `src/lib/chatbot/agent.ts` (`fournisseurs`, `BUDGET_MS`, `refusDAuthentification`).
  - Écrire un post-mortem sans recherche de coupable : impact (qui a vu quoi, combien de temps), chronologie, causes (dont « une correction a introduit la panne suivante »), ce qui a permis de détecter, ce qui a manqué (aucun log de coût, aucune alerte, aucun point de santé), actions avec un responsable et une date.
  - Relier chaque action manquante à un item de l'affaire 7 (S7-06, S7-08, S7-10) ou à une issue nouvelle.
- **Critères d'acceptation** :
  - `docs/notes/post-mortem-2026-10-01-assistant.md` avec les sections : résumé, impact, chronologie horodatée (heure de Paris), causes, détection, ce qui a bien marché, actions.
  - Chaque fait de la chronologie cite sa source (commit, PR, ligne de code).
  - Au moins trois actions, chacune liée à une issue ou à un item du backlog.
  - Aucun nom de personne dans les causes.
- **Fichiers concernés** : `docs/notes/post-mortem-2026-10-01-assistant.md` (nouveau) ; lecture de `src/lib/chatbot/agent.ts`, `src/app/api/chatbot/route.ts`, `git log`.
- **Ce que ça exerce** : post-mortem, lecture de l'historique Git, transformer un incident en actions. Accessible sans coder.
- **Préparation formateur** : si un incident réel a eu lieu pendant les sessions 1 à 7, le proposer à la place, avec ses logs.

## S8-03 · Liste d'attente sur un créneau complet

- **Type** : feature · **Taille** : L · **Demandé par** : la gérante d'un restaurant partenaire
- **Contexte** : « Le samedi soir je suis complet à 17 h, et à 19 h j'ai trois annulations que personne ne reprend. Chez Caro Pizzo, ils ont une liste d'attente. »
- **À faire** :
  - Nouvelle table d'inscription en liste d'attente (dîneur, restaurant, créneau, couverts, date d'inscription, date de proposition), par une nouvelle migration.
  - Sur la carte de réservation (`src/components/BookingCard.tsx`), un créneau complet propose « Être prévenu si une table se libère ». L'inscription passe par une action serveur qui revérifie que le créneau est bien complet, ouvert (`creneauEstOuvert`) et dans la fenêtre des 5 jours.
  - Quand une annulation libère de la place (`annulerReservation`, `src/app/(site)/mes-reservations/actions.ts`), marquer le premier inscrit dont le nombre de couverts tient, dans l'ordre d'inscription. Il voit « Une table s'est libérée » dans `/mes-reservations` et réserve normalement : rien n'est réservé à sa place, la place reste à qui confirme le premier.
  - Pas d'email dans cet item (voir S8-10).
- **Critères d'acceptation** :
  - Tests : inscription refusée sur un créneau qui n'est pas complet ; à l'annulation, seul le premier inscrit dont les couverts tiennent est marqué ; un inscrit pour 6 est sauté si 2 places se libèrent.
  - La réservation qui suit passe par `creerReservation` et `reserverCreneau` : la capacité reste garantie (`src/lib/reservation.concurrence.test.ts` passe).
  - Les jours et heures affichés passent par `formaterJourLong` / `formaterHeure`.
  - Parcours complet : la migration n'ajoute qu'une table (compatible avec la production en cours) ; vérification en production avec deux comptes de test sur un restaurant de test, puis annulation des deux.
- **Fichiers concernés** : `prisma/schema.prisma`, nouvelle migration, `src/components/BookingCard.tsx`, `src/app/(site)/restaurants/[id]/actions.ts`, `src/app/(site)/mes-reservations/actions.ts`, `src/app/(site)/mes-reservations/page.tsx`, nouveau module `src/lib/liste-attente.ts` et son test.
- **Ce que ça exerce** : livrer sur plusieurs séances, découper en PR livrables séparément, concurrence, migration compatible.

## S8-04 · Deux tables de 6 à 19 h et 19 h 30 dans une salle de 10

- **Type** : bug · **Taille** : M · **Demandé par** : le gérant d'un restaurant partenaire
- **Contexte** : « Capacité déclarée : 10. J'ai eu 6 couverts à 19 h et 6 à 19 h 30. Les premiers étaient encore au plat quand les seconds sont arrivés. »
- **À faire** :
  - Aujourd'hui, `reserverCreneau` (`src/lib/reservation.ts`) compte la capacité créneau par créneau, sur la date exacte : deux créneaux qui se chevauchent ne se voient pas. Le README affirme aussi, à tort, que la réservation se fait « sans vérifier les conflits de capacité ».
  - Introduire une durée de table (par exemple 1 h 30, en constante documentée) et compter, pour un créneau, les couverts confirmés dont le repas chevauche ce créneau. Appliquer la même règle à l'occupation affichée (`lireCarteReservation`, `src/lib/disponibilites.ts`), pour que l'écran ne propose pas ce que le serveur refuse.
  - Garder le verrou `SELECT ... FOR UPDATE` sur la ligne `Restaurant`.
  - Corriger la phrase du README.
- **Critères d'acceptation** :
  - Test : capacité 10, 6 couverts à 19 h, une demande de 6 à 19 h 30 est refusée, une demande de 6 à 21 h est acceptée.
  - Test de concurrence existant (`src/lib/reservation.concurrence.test.ts`) toujours vert, et étendu au cas de deux créneaux voisins.
  - Les créneaux sont construits par `construireDateCreneau`, jamais par `new Date("...")` ; les tests passent sous n'importe quel fuseau machine (`TZ=UTC pnpm test` et `TZ=Pacific/Auckland pnpm test`).
  - Parcours complet : pas de migration ; vérification en production en lisant la carte de réservation d'un restaurant de test avant et après une réservation.
- **Fichiers concernés** : `src/lib/reservation.ts`, `src/lib/disponibilites.ts`, `src/lib/reservation.concurrence.test.ts`, `src/lib/disponibilites.test.ts`, `README.md`.
- **Ce que ça exerce** : règle métier écrite une fois pour l'écran et le serveur, concurrence, fuseau horaire, documentation qui ment.

## S8-05 · Modérer un avis

- **Type** : feature · **Taille** : M · **Demandé par** : un restaurateur partenaire
- **Contexte** : « Un avis à une cuillère dit que mon serveur est "un voleur", avec son prénom. Je veux qu'il disparaisse, et je ne suis pas le seul. » Le README l'annonce : pas de modération pour l'instant (ticket « Modération des avis »).
- **À faire** :
  - Champs `masqueLe`, `masqueParId` (staff) et `motifMasquage` sur `Avis`, par une nouvelle migration (colonnes facultatives).
  - Page staff `/admin/avis` : derniers avis, recherche par restaurant, bouton « Masquer » avec motif obligatoire, et « Rétablir ».
  - Un avis masqué disparaît de la fiche publique et ne compte plus dans la note : `recalculerNoteRestaurant` (`src/lib/avis.ts`) l'exclut, et la note est recalculée au masquage et au rétablissement.
  - Le dîneur ne peut pas republier le même avis pour contourner le masquage (un seul avis par dîneur et par restaurant, déjà garanti par la contrainte unique).
  - Entrée « Avis » dans la barre latérale du staff.
- **Critères d'acceptation** :
  - Tests : la note exclut les avis masqués ; masquer puis rétablir rend la note d'origine ; `nombreAvis` suit.
  - Masquer sans motif est refusé côté serveur.
  - Seule une session staff (`authAdmin`) peut masquer.
  - Parcours complet : colonnes facultatives seulement ; vérification en production sur un avis de test.
- **Fichiers concernés** : `prisma/schema.prisma`, nouvelle migration, `src/lib/avis.ts`, `src/lib/avis.test.ts`, `src/app/admin/avis/page.tsx` et `actions.ts` (nouveaux), `src/app/admin/layout.tsx` ou `src/components/BarreLaterale.tsx`, `src/app/(site)/restaurants/[id]/page.tsx`.
- **Ce que ça exerce** : feature de bout en bout sur trois univers (dîneur, staff, données), règle de calcul testée, autorisation.

## S8-06 · « Absence prévenue » visible dans le litige

- **Type** : feature · **Taille** : S · **Demandé par** : l'instructeur des litiges (staff)
- **Contexte** : « Le restaurant conteste un no-show. Le dîneur avait prévenu la veille qu'il ne viendrait pas, mais je ne le vois nulle part dans le dossier. » Le schéma le dit : `absencePrevenueLe` n'est « pas encore repris par les écrans de litige ».
- **À faire** : sur `/admin/litiges/[dossierId]` (`src/app/admin/litiges/[dossierId]/page.tsx`), sous chaque ligne contestée, afficher « Le dîneur avait prévenu de son absence le … à … » quand `booking.absencePrevenueLe` est renseigné, formaté par `formaterJourEtHeure`. Même ajout sur la page de dépôt de contestation côté restaurant (`src/app/espace-restaurant/factures/[id]/contester/page.tsx`). Mettre à jour le commentaire du schéma (commentaire seulement, pas de migration).
- **Critères d'acceptation** :
  - Une ligne dont la réservation a `absencePrevenueLe` affiche la mention dans les deux écrans ; une ligne sans ne l'affiche pas.
  - La date est affichée à l'heure de Paris.
  - Parcours complet : pas de migration ; vérification en production sur un dossier existant du jeu de formation, ou constat qu'aucun dossier n'en a (dit dans l'issue).
- **Fichiers concernés** : `src/app/admin/litiges/[dossierId]/page.tsx`, `src/app/espace-restaurant/factures/[id]/contester/page.tsx`, `prisma/schema.prisma` (commentaire).
- **Ce que ça exerce** : petit changement livré proprement de bout en bout. Accessible à un non-développeur accompagné.

## S8-07 · Export comptable des factures du mois

- **Type** : feature · **Taille** : M · **Demandé par** : l'expert-comptable d'un restaurant partenaire
- **Contexte** : « Chaque mois je recopie vos factures à la main. Un CSV par mois, avec les avoirs, et je vous laisse tranquilles. »
- **À faire** :
  - Route staff `GET /admin/factures/export?mois=AAAA-MM` qui renvoie un CSV (séparateur `;`, UTF-8 avec BOM pour Excel) : référence de facture (`referenceFacture`), restaurant, mois, montant total, total des avoirs, net à payer (`netAPayerCentimes`), date d'émission.
  - Montants en euros avec virgule décimale (`src/lib/montants.ts`) ; dates d'émission à l'heure de Paris ; mois de facture lu en UTC (`formaterMoisFacture`, voir le commentaire dans `src/lib/facturation.ts`).
  - Bouton « Exporter » sur `/admin/factures`.
- **Critères d'acceptation** :
  - Sans session staff : redirection ou 401, jamais de CSV.
  - Mois invalide (`2026-13`) : 400.
  - Test de la fonction qui produit le CSV : une facture avec avoir, une sans, un nom de restaurant contenant `;` et des guillemets.
  - Le total de la colonne « net » du CSV de décembre 2026 égale la somme affichée sur `/admin/factures`.
  - Parcours complet : pas de migration ; en production, télécharger l'export de décembre et l'ouvrir dans un tableur.
- **Fichiers concernés** : `src/app/admin/factures/export/route.ts` (nouveau), `src/lib/export-factures.ts` (nouveau) et son test, `src/app/admin/factures/page.tsx`.
- **Ce que ça exerce** : feature de bout en bout, format d'échange, fuseau et montants, contrôle d'accès sur une route.

## S8-08 · L'avoir d'octobre porte une référence de septembre

- **Type** : bug · **Taille** : S · **Demandé par** : l'expert-comptable d'un restaurant partenaire
- **Contexte** : « Votre avoir est daté du 1er octobre mais sa référence commence par AV-202609. Mon logiciel le range en septembre. »
- **À faire** : `referenceAvoir` (`src/lib/facturation.ts`) lit le mois avec `getFullYear()` / `getMonth()`, c'est-à-dire dans le fuseau du serveur. Le commentaire dit « mois local », mais en production le serveur tourne en UTC : un avoir émis le 1er octobre à 0 h 30 à Paris devient AV-202609. Lire le mois à Paris via `src/lib/fuseau.ts` (`composantesLocales` ou `jourIsoLocal`) et corriger le commentaire. Écrire d'abord le test qui échoue sous `TZ=UTC`.
- **Critères d'acceptation** :
  - Test : un avoir émis le 2026-09-30T22:30:00Z a la référence `AV-202610-…`, sous `TZ=UTC` comme sous `TZ=Europe/Paris`.
  - `TZ=UTC pnpm test` passe.
  - Le reste du fichier n'utilise plus de `getMonth()` / `getFullYear()` sur un instant (les lectures `getUTC…` du mois de facture restent, elles sont voulues).
  - Parcours complet : pas de migration ; en production, vérifier la référence d'un avoir émis en début de mois dans le jeu de formation.
- **Fichiers concernés** : `src/lib/facturation.ts`, `src/lib/facturation.test.ts`.
- **Ce que ça exerce** : règle « l'heure, c'est l'heure de Paris », un bug invisible en local, test qui fixe le fuseau.

## S8-09 · Chercher un restaurant sans un allergène

- **Type** : feature · **Taille** : M · **Demandé par** : une dîneuse (email au support)
- **Contexte** : « Ma fille est allergique aux arachides. Je dois ouvrir chaque fiche pour voir les plats. Vous ne pouvez pas filtrer ? »
- **À faire** :
  - Sur l'accueil (`src/app/(site)/page.tsx`), un filtre « Sans … » parmi les 14 allergènes (`Allergene`, `src/lib/allergenes.ts`), conservé avec `ville` et `cuisine` dans `lienRecherche`.
  - Un restaurant apparaît s'il a au moins un plat **déclaré** (`allergenesDeclaresLe` renseigné) sans cet allergène. Un plat non renseigné ne compte jamais comme « sans » : c'est la règle du README.
  - Sur chaque carte de restaurant filtrée, afficher combien de plats sont déclarés sans l'allergène et combien sont non renseignés, avec le rappel « confirmez avec le restaurant ».
  - Ne pas toucher à l'assistant de recherche, qui a déjà son propre filtre.
- **Critères d'acceptation** :
  - Test : un restaurant dont tous les plats sont non renseignés n'apparaît pas ; un restaurant avec un plat déclaré sans arachides apparaît ; un plat déclaré « aucun allergène » (liste vide datée) compte comme « sans ».
  - Une valeur d'allergène inconnue dans l'URL est ignorée, pas une erreur 500.
  - Parcours complet : pas de migration ; en production, filtrer « Sans arachides » à Paris et vérifier deux fiches à la main.
- **Fichiers concernés** : `src/app/(site)/page.tsx`, `src/lib/allergenes.ts`, `src/lib/allergenes.test.ts`.
- **Ce que ça exerce** : « non renseigné » n'est pas « sans allergène », filtre de recherche, risque pour l'utilisateur.

## S8-10 · Rappel de réservation la veille

- **Type** : feature · **Taille** : L · **Demandé par** : le gérant d'un restaurant partenaire
- **Contexte** : « La moitié de mes no-show, c'est des gens qui ont oublié. Un rappel la veille, comme chez le dentiste. »
- **À faire** :
  - TheSpoon n'envoie aucun email aujourd'hui. Première séance : choisir un fournisseur d'envoi, poser sa clé en variable d'environnement (`src/lib/env.ts`, `.env.example`, facultative : sans clé, aucun envoi et une ligne de log), et écrire un module d'envoi avec un mode « journal seulement » pour le local.
  - Champ `rappelEnvoyeLe` sur `Booking` (nouvelle migration, colonne facultative).
  - Une fonction planifiée Netlify qui tourne chaque jour vers 10 h à Paris (attention : la planification s'écrit en UTC, et l'heure UTC change avec l'heure d'été), qui envoie un rappel pour chaque réservation `CONFIRMEE` du lendemain (jour de Paris) sans rappel, avec le lien vers `/mes-reservations` pour annuler ou prévenir de son absence.
  - Idempotence : relancée deux fois, la fonction n'envoie pas deux rappels.
  - Une ligne de log par exécution : réservations trouvées, rappels envoyés, échecs.
- **Critères d'acceptation** :
  - Tests : « demain » calculé en jour de Paris (une réservation demain 12 h vue à 23 h 30 la veille, à Paris) ; pas de rappel pour une réservation annulée ou déjà rappelée ; un échec d'envoi n'empêche pas les suivants.
  - En local, le mode journal affiche les rappels sans rien envoyer.
  - Parcours complet : colonne facultative ; en production, une réservation de test pour le lendemain reçoit un seul rappel ; la ligne de log de l'exécution est retrouvée sur Netlify.
- **Fichiers concernés** : `prisma/schema.prisma`, nouvelle migration, `src/lib/env.ts`, `.env.example`, `src/lib/rappels.ts` (nouveau) et son test, `netlify/functions/rappels-reservation.ts` (nouveau), `README.md`.
- **Ce que ça exerce** : service tiers, secret, tâche planifiée, idempotence, fuseau, observabilité d'un traitement sans écran.
- **Préparation formateur** : créer un compte chez le fournisseur d'envoi retenu (domaine d'envoi de test) et fournir la clé au binôme hors du dépôt.

## S8-11 · Fermer une période de congés en une fois

- **Type** : feature · **Taille** : M · **Demandé par** : la gérante d'un restaurant partenaire
- **Contexte** : « On ferme du 8 au 23 février. Votre calendrier me fait fermer jour par jour, et j'ai oublié le 14. Il y a eu deux réservations, que j'ai dû appeler. »
- **À faire** :
  - Sur `/espace-restaurant/disponibilites`, un formulaire « Fermer du … au … » qui crée une fermeture pour chaque créneau de chaque jour de la période, par la même règle que `basculerExceptionJournee` (`src/app/espace-restaurant/disponibilites/actions.ts`), en une transaction.
  - Les jours sont des jours de Paris (`ajouterJours`, `jourIsoValide`) ; une période de plus de 60 jours ou dont la fin précède le début est refusée.
  - Avant de confirmer, afficher les réservations confirmées déjà prises sur la période : elles ne sont pas annulées automatiquement (voir S8-14), le restaurateur doit les voir.
- **Critères d'acceptation** :
  - Tests : une période de 3 jours ferme tous les créneaux de ces 3 jours, ni plus ni moins ; une période qui traverse le passage à l'heure d'été (fin mars) donne les bons jours ; une période inversée est refusée.
  - La fiche publique ne propose plus aucun créneau sur la période (`lireCarteReservation`).
  - Parcours complet : pas de migration ; en production, sur un restaurant de test, fermer une période puis la rouvrir.
- **Fichiers concernés** : `src/app/espace-restaurant/disponibilites/actions.ts`, `src/app/espace-restaurant/disponibilites/page.tsx`, `src/app/espace-restaurant/disponibilites/erreurs.ts`, test associé.
- **Ce que ça exerce** : feature restaurateur de bout en bout, dates et fuseau, transaction.

## S8-12 · Ajouter sa réservation à son agenda

- **Type** : feature · **Taille** : S · **Demandé par** : un dîneur (email au support)
- **Contexte** : « Un bouton "ajouter à mon agenda" serait pratique, j'ai réservé et oublié. »
- **À faire** : route `GET /mes-reservations/[id]/agenda` qui renvoie un fichier `.ics` pour une réservation du dîneur connecté : nom et adresse du restaurant, début au créneau, fin 1 h 30 plus tard, heure exprimée avec le fuseau `Europe/Paris` (ou en UTC avec `Z`), jamais en heure flottante. Lien « Ajouter à mon agenda » sur chaque réservation à venir de `/mes-reservations`.
- **Critères d'acceptation** :
  - La réservation d'un autre dîneur répond 404 ; sans session, redirection vers `/connexion`.
  - Test : une réservation à 19 h 30 à Paris le 28 mars 2027 (changement d'heure) donne le bon instant dans le fichier.
  - Le fichier s'importe dans un agenda (Google ou Apple) à la bonne heure.
  - Parcours complet : pas de migration ; en production, importer le fichier d'une réservation de test.
- **Fichiers concernés** : `src/app/(site)/mes-reservations/[id]/agenda/route.ts` (nouveau), `src/lib/agenda.ts` (nouveau) et son test, `src/app/(site)/mes-reservations/page.tsx`.
- **Ce que ça exerce** : petite feature de bout en bout, autorisation sur une ressource, fuseau dans un format d'échange.

## S8-13 · Supprimer `Restaurant.horaires` sans casser la production

- **Type** : chore · **Taille** : M · **Demandé par** : l'ex-architecte (TODO dans le schéma)
- **Contexte** : Commentaire dans `prisma/schema.prisma` : « Il survit en base le temps de vérifier qu'aucune fiche de production ne portait un format que la migration de reprise n'a pas su relire. Voir le ticket "Supprimer Restaurant.horaires". »
- **À faire** :
  - Vérifier d'abord, par une requête en lecture sur la production, quelles fiches ont un `horaires` non vide et si leurs `PlageOuverture` existent. Écrire le résultat dans l'issue.
  - Piège : un Deploy Preview applique sa migration à la base de production avant la fusion, et le client Prisma de la production, qui connaît encore `horaires`, le lit dans toute requête sans `select`. Un `DROP COLUMN` dans la même PR que le retrait du champ casserait donc la production en cours. Proposer, faire valider par le formateur, puis livrer le découpage en deux temps : d'abord le code qui n'en dépend plus, déployé ; ensuite la migration qui supprime la colonne.
  - Si des fiches non reprises existent, s'arrêter et produire la liste : la suppression attendra.
- **Critères d'acceptation** :
  - Le résultat de la requête de vérification est dans l'issue, daté.
  - Aucune PR ne supprime la colonne tant que la production sert un client Prisma qui la connaît.
  - La migration de suppression est un nouveau dossier ; aucune migration existante n'est modifiée.
  - Après la seconde livraison : `select column_name from information_schema.columns where table_name = 'Restaurant'` ne liste plus `horaires`, et les fiches, la recherche et l'API admin répondent en production (logs sans erreur « column does not exist »).
- **Fichiers concernés** : `prisma/schema.prisma`, nouvelle migration, `scripts/seed-dev.ts` et `src/lib/api-admin/` si l'un d'eux écrit encore le champ (à vérifier).
- **Ce que ça exerce** : migration en deux temps sur une base partagée, vérifier avant de supprimer, décision documentée.
- **Préparation formateur** : chaîne de connexion Neon en lecture seule pour la vérification ; être disponible pour valider le découpage avant la première PR.

## S8-14 · Le restaurant annule une réservation

- **Type** : feature · **Taille** : M · **Demandé par** : le gérant d'un restaurant partenaire
- **Contexte** : « Dégât des eaux jeudi, on ferme le soir même. Je n'ai aucun moyen d'annuler les tables sur TheSpoon, j'ai dû appeler chaque client, et deux sont venus quand même. »
- **À faire** :
  - Dans « Réservations reçues » (`src/app/espace-restaurant/reservations/`), un bouton « Annuler » sur une réservation à venir, avec un motif obligatoire.
  - Champs `annuleeParRestaurantLe` et `motifAnnulationRestaurant` sur `Booking` (nouvelle migration, colonnes facultatives) ; le statut passe à `ANNULEE`.
  - Côté dîneur, `/mes-reservations` affiche « Annulée par le restaurant » et le motif, différemment d'une annulation par le dîneur.
  - Une réservation annulée par le restaurant n'est jamais facturée (déjà vrai : seules les `HONOREE` le sont) et n'entre pas dans le taux d'annulation des dîneurs du tableau de bord staff (`src/lib/indicateurs.ts`, fonction `activite`) : vérifier et tester.
  - Le restaurateur ne peut annuler que les réservations de son établissement (session `authRestaurant`).
- **Critères d'acceptation** :
  - Tests : annuler une réservation d'un autre restaurant est refusé ; une réservation passée ne s'annule pas ; le motif vide est refusé.
  - Le dîneur voit le motif dans `/mes-reservations`.
  - Parcours complet : colonnes facultatives ; en production, sur un restaurant et un dîneur de test, annuler côté restaurant et vérifier l'écran du dîneur.
- **Fichiers concernés** : `prisma/schema.prisma`, nouvelle migration, `src/app/espace-restaurant/reservations/actions.ts`, `src/app/espace-restaurant/reservations/page.tsx`, `src/app/(site)/mes-reservations/page.tsx`, `src/lib/indicateurs.ts`, tests associés.
- **Ce que ça exerce** : feature sur deux univers, autorisation, effet sur les indicateurs et la facturation.

## S8-15 · Le README dit que la facturation n'existe pas

- **Type** : chore · **Taille** : S · **Demandé par** : l'ex-CPO
- **Contexte** : « Les restaurants lisent notre README public. Il dit que la facturation et les litiges n'existent pas, alors qu'ils reçoivent des factures. »
- **À faire** : relire les sections « Ce qui existe » et « Ce qui n'existe pas encore » de `README.md` en les confrontant au code : facturation (`/admin/factures`, `/espace-restaurant/factures`), litiges (`/admin/litiges`, contestation), « Pas de section factures » dans la description de la Console staff, et la phrase sur les conflits de capacité (laisser cette dernière à S8-04 si le binôme est actif ; sinon la corriger ici). Corriger le texte, sans réécrire ce qui est juste.
- **Critères d'acceptation** :
  - Chaque affirmation modifiée renvoie à un fichier ou une route qui existe.
  - « Ce qui n'existe pas encore » ne liste que des choses introuvables dans le code (vérifié par recherche).
  - La PR ne touche que `README.md` ; la CI passe ; le README de la production (GitHub) est à jour après fusion.
- **Fichiers concernés** : `README.md`.
- **Ce que ça exerce** : parcours complet sur un changement sans code (issue, PR, relecture, CI, fusion), documentation comme contrat. Accessible sans coder.

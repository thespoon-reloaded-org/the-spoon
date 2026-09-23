# TheSpoon

Plateforme de réservation de restaurants — concurrent de LaFourchette, note
en cuillères. Voir la page Notion « 🥄 TheSpoon » (backlog + vision) pour le
contexte produit, et `../thespoon-env/CANON.md` pour la mécanique métier
détaillée (facturation, commission, litiges) dont ce produit s'inspire.

**Approche : produit et écrans d'abord, schéma ensuite.** Le modèle de
données n'est pas conçu à l'avance en un bloc — chaque table arrive avec
l'écran qui en a besoin. `prisma/schema.prisma` contient aujourd'hui
`Restaurant`/`PlatCuillere` (recherche + fiche établissement),
`PlageOuverture`/`ExceptionHoraire` (horaires & disponibilités), `Booking`
(réservation), `Avis` (dépôt d'avis), `Staff` (organigramme interne) et,
pour chacune des trois populations qui se connectent (dîneur, contact
restaurant, staff), un jeu de tables d'auth dédié généré par better-auth
(`User`/`Session`/`Account`/`Verification` ; `RestaurantContact` +
`RestaurantContactSession`/`RestaurantContactAccount`/
`RestaurantContactVerification` ; `Staff` +
`StaffSession`/`StaffAccount`/`StaffVerification`) — même mécanique, tables
et cookies séparés par population.

L'identité visuelle est celle de TheSpoon, pas celle d'Hymaïa (TheSpoon est sa
propre marque, pas une interface interne) — voir « Charte & structure des
écrans » plus bas.

## Un onboarding par univers

Trois populations, trois produits : le dîneur ne gagne rien à lire comment on
instruit un litige. Chaque univers a donc son propre parcours, en quatre
étapes, déclaré comme du contenu dans `src/lib/onboarding.ts` — ajouter une
étape ne demande pas de toucher à la mécanique, qui vit une seule fois dans
`src/components/Onboarding.tsx`.

Il **se rejoue** : un bouton « Comment ça marche » dans le header du site et
dans la barre latérale des deux espaces connectés. Ce n'est pas un tunnel
d'accueil qu'on subit une fois, c'est un écran qui reste à portée. Il s'ouvre
tout seul à la première arrivée, puis plus jamais sans qu'on le demande —
`onboardingVuLe` porte cette trace, une colonne par population (`User`,
`RestaurantContact`, `Staff`), comme les trois instances better-auth.
`marquerOnboardingVu` résout la session de l'univers concerné et n'accepte
jamais d'identifiant venu du client.

## L'heure, c'est l'heure de Paris

Le produit est français, ses serveurs ne le sont pas : en production (Netlify)
le code tourne en UTC. Toute heure murale — « le créneau de 19h du
22 septembre » — doit donc **nommer son fuseau**, sinon la même ligne de code
donne deux instants différents selon la machine. `src/lib/fuseau.ts` porte
cette décision : conversion heure murale ↔ instant, calendrier (quel jour on
est, quel jour suit), et formateurs d'affichage.

Deux règles, et elles ne coûtent rien à tenir :

- construire une date depuis un jour et une heure passe par `instantLocal` /
  `construireDateCreneau`, jamais par `new Date("2026-09-22T19:00:00")` ;
- afficher une date passe par `formaterDate` / `formaterJourLong` /
  `formaterHeure`, jamais par `toLocaleDateString` sans `timeZone`.

Ne pas compter sur le fuseau du process (`process.env.TZ`) : ça a été essayé,
ça rendait le défaut invisible en dev sans rien corriger en production. Les
tests de `src/lib/fuseau.ts` et `src/lib/creneaux.ts` passent sous n'importe
quel fuseau machine — c'est ce qui rend la garantie vérifiable.

## Charte & structure des écrans

**Trois univers, trois couleurs.** Trois populations se connectent, sur trois
instances better-auth séparées, vers trois produits qui n'ont rien à voir. Elles
ne partagent donc pas la même peau (`src/lib/univers.ts`, tokens dans
`globals.css`) :

| Univers | Couleur | Où |
|---|---|---|
| Dîneur | framboise `--color-accent` | site public + `/connexion` |
| Restaurateur | vert profond `--color-pro` + jaune | `/espace-restaurant` + `/connexion-restaurant` |
| Staff | encre bleutée `--color-staff` + violet | `/admin` + `/connexion-admin` |

`/connexion` et `/connexion-restaurant` affichent le sélecteur « Vous êtes… » :
les deux portes sont visibles d'emblée, chacune avec sa couleur et sa photo.
Le staff n'y figure pas (accès interne, lien discret en pied de page).

**Groupes de routes.** Les trois univers n'ont pas le même cadre, d'où le
découpage de `src/app/` (les parenthèses n'apparaissent pas dans les URLs) :

- `(site)/` — recherche, fiche établissement, mes réservations : header collant
  + pied de page (`SiteHeader`, `SiteFooter`).
- `(connexion)/` — les trois écrans de connexion, en pleine page.
- `espace-restaurant/` et `admin/` — menu latéral (`BarreLaterale`), fixe à
  partir de `lg`, tiroir en dessous. Le contrôle d'accès est fait une fois dans
  le layout, pas page par page.

**Briques partagées.** `src/lib/ui.ts` (champs, boutons, cartes, pastilles
d'état, états vides), `src/components/Icones.tsx` (jeu de pictos maison, pas de
dépendance), `EnteteEspace` (titre de page des espaces connectés),
`MessageFormulaire` (retour de soumission, avec le bon rôle ARIA).

**Photos.** `public/images/` contient des photos libres (voir `SOURCES.md`) qui
servent de repli quand un restaurant ou un plat n'a pas encore la sienne —
choisies par type de cuisine dans `src/lib/images.ts`. `PhotoCouverture` est le
seul endroit qui sait les afficher, parce que les deux provenances ne se
traitent pas pareil : les fichiers statiques passent par `next/image`, les
photos téléversées non. Depuis Next.js 16, une image locale portant une chaîne
de requête doit être déclarée dans `images.localPatterns` avec un `search`
**exact** — impossible pour un cache-bust `?v=<horodatage>`, d'où le `<img>`
simple sur ce chemin.

## Démarrer en local

```bash
nvm use
pnpm install
cp .env.example .env   # puis éditer DATABASE_URL, BETTER_AUTH_SECRET et BETTER_AUTH_URL
pnpm db:migrate         # applique les migrations à la base locale
pnpm seed:dev
pnpm dev                # http://localhost:3100
```

`BETTER_AUTH_SECRET` se génère avec `openssl rand -hex 32`.

`pnpm seed:dev` crée les restaurants, les contacts et le staff de dev, tous
avec le mot de passe `password123` — connexion dîneur sur `/connexion`,
restaurateur sur `/connexion-restaurant`, staff sur `/connexion-admin`.

## Se donner un accès sur un environnement déployé

`seed:dev` **commence par vider** restaurants, contacts et staff : il est fait
pour une base de dev jetable et ne doit jamais être lancé contre une base
déployée. Or un déploiement n'a jamais de comptes — `pnpm build` n'y applique
que les migrations — et l'inscription libre est coupée pour les restaurateurs
et le staff (`disableSignUp`, cf. `src/lib/auth.ts`).

`pnpm creer-compte` couvre ce cas : il ne supprime rien, ne touche qu'aux
lignes d'authentification et se relance sans risque.

```bash
COMPTE_EMAIL=prenom.nom@example.com \
COMPTE_MOT_DE_PASSE='…' \
COMPTE_NOM='Prénom Nom' \
DATABASE_URL="$(netlify env:get DATABASE_URL --context production)" \
pnpm creer-compte
```

Par défaut il crée les trois comptes ; `COMPTE_UNIVERS=restaurant,staff` en
restreint la liste, `COMPTE_RESTAURANT='Chez Antoine'` choisit l'établissement
du contact restaurateur.

## API d'administration

`/api/admin/*` sert à créer de la donnée en masse — un jeu de formation, un
scénario de démo — depuis un script, `curl` ou un agent, sans passer par les
écrans. Réservée à l'administratrice du produit : un seul jeton, pas de compte.

**Désactivée par défaut.** Sans `ADMIN_API_TOKEN`, toutes les routes
répondent 404. Pour l'ouvrir sur un environnement :

- `ADMIN_API_TOKEN` — `openssl rand -hex 32`, 32 caractères minimum ;
- `ADMIN_API_STAFF_EMAIL` — un membre du staff déjà en base (`pnpm
  creer-compte`) : les créations de restaurants et de contacts sont tracées
  à son nom dans le journal d'audit, comme depuis la Console.

**Une seule base, la vraie.** Les Deploy Previews et la production partagent
la même base Neon (voir « Migrations de base de données »), et c'est voulu :
les formations se bâtissent sur l'écosystème réel, pas sur une copie. Ce qui
rend ces données acceptables en production, c'est qu'elles sont
**réalistes** — la première règle ci-dessous — pas qu'elles soient isolées.
Pas d'anomalie volontaire ni de piège pédagogique par cette API.

```bash
curl -H "Authorization: Bearer $ADMIN_API_TOKEN" http://localhost:3100/api/admin
```

| Route | Effet |
|---|---|
| `GET /api/admin` | Sommaire des routes |
| `GET /api/admin/restaurants` | Restaurants et contacts, avec leurs ids |
| `POST /api/admin/restaurants` | Restaurants, avec `plats` (`allergenes` absent = non renseigné, `[]` = aucun), `horaires` (`{ jourSemaine: 0-6, debut: "12:00", fin: "14:30" }`) et `contacts` |
| `POST /api/admin/restaurants/{id}/contacts` | Contacts d'un restaurant existant |
| `POST /api/admin/dineurs` | Comptes dîneur (`nom`, `email`, `motDePasse?`) |
| `POST /api/admin/reservations` | Réservations : `restaurantId`, `dineurEmail` ou `dineurId`, `jour`, `creneau`, `couverts`, `statut?`, `couvertsServis?`, `signaleeLe?`, `creeeLe?` |
| `GET /api/admin/factures?mois=AAAA-MM` | Factures du mois et leurs lignes |
| `POST /api/admin/factures` | Génère les factures de `{ mois }` — idempotent |
| `POST /api/admin/dossiers` | Dépose une contestation : `factureId`, `contactId`, `lignes: [{ ligneFactureId, motif }]` |

Trois règles :

- **L'API ne fabrique que des états que le produit aurait pu atteindre.**
  Créneaux de la grille (`12:00`…`22:00`, heure de Paris), capacité du
  restaurant, honoré/no-show seulement sur un créneau passé, facturation et
  dépôt de contestation par les mêmes fonctions que les écrans (seuil de
  crédit d'office, délai de 30 jours, pas de double contestation).
- **Tout-ou-rien.** Les `POST` acceptent un objet ou une liste ; une liste
  avec une erreur n'écrit rien, et la réponse (400, 409 ou 422) désigne
  l'élément fautif.
- **Mots de passe.** Sans `motDePasse`, un mot de passe temporaire est généré
  et rendu **une seule fois** dans la réponse (`motDePasseGenere`).

Code : `src/lib/api-admin/` (garde, schémas, écritures) et
`src/app/api/admin/`.

## Migrations de base de données

Tout changement de `prisma/schema.prisma` passe par une migration versionnée
et commitée dans `prisma/migrations/`, jamais par `db push` directement sur
une base partagée — trois incidents de prod ont déjà été causés par un schéma
poussé à la main et jamais retrouvé côté base de déploiement.

- En local, après avoir modifié `prisma/schema.prisma` :
  `pnpm db:migrate` (= `prisma migrate dev`) génère le fichier SQL de
  migration, l'applique à votre base locale, et régénère le client Prisma.
  Commitez le dossier créé dans `prisma/migrations/`.
- En déploiement, `pnpm build` lance `prisma migrate deploy` avant `next
  build` : les migrations en attente s'appliquent automatiquement, et le
  build échoue si une migration ne passe pas — au lieu de laisser la prod
  tourner avec un schéma différent de celui attendu par le code. Sur Netlify,
  ça tourne contre la vraie base Neon partagée (pas une base vierge comme en
  CI) : `prisma.config.ts` utilise `DATABASE_URL_UNPOOLED` (connexion directe,
  hors pooler) pour ces commandes, requis par le verrou consultatif de Prisma
  Migrate — sans ça, `prisma migrate deploy` échoue en prod avec un timeout
  P1002, même si le code est correct et que la CI est verte.
- `prisma db push` reste légitime pour bricoler vite en local (un schéma
  jetable, une expérimentation), mais ne doit jamais être utilisé contre la
  base de production.

**`_prisma_migrations` n'est pas une preuve.** La base de prod porte la trace
de toutes les migrations comme appliquées alors que `20260914000000_init` ne
s'y était jamais déroulée en entier : deux migrations de réparation ont été
nécessaires (`20260915110000_repare_auth_restaurant_partenaire` pour les
colonnes et les tables d'auth restaurateur,
`20260917120000_index_unique_email_contact` pour l'index unique resté manquant
sur `RestaurantContact.email`). Devant un symptôme qui n'arrive qu'en prod —
colonne inconnue, `42P10` sur un `upsert` — comparer le schéma réel plutôt que
l'historique :

```sql
select tablename, indexname from pg_indexes where schemaname = 'public' order by 1, 2;
select table_name, column_name from information_schema.columns where table_schema = 'public' order by 1, 2;
```

Une migration de réparation s'écrit idempotente (`IF NOT EXISTS`, `DO $$ …
EXCEPTION`) : elle doit passer aussi bien sur la base abîmée que sur les bases
saines (local, CI) où elle ne fait rien.

## Ce qui existe

- Recherche de restaurants (`/`) et fiche établissement (`/restaurants/[id]`),
  branchées sur une vraie base PostgreSQL via Prisma.
- Auth dîneur (`/connexion`) : inscription, connexion, session, déconnexion —
  via better-auth.
- Auth restaurant partenaire (`/connexion-restaurant`) : connexion, session,
  déconnexion pour le contact d'un restaurant (gérant/chef de salle) — via
  une deuxième instance better-auth (`authRestaurant` dans `src/lib/auth.ts`),
  entièrement séparée de celle des dîneurs (table, cookie et route API
  dédiés : `/api/auth-restaurant`). Pas d'inscription : les comptes sont
  créés côté TheSpoon (`pnpm seed:dev` en crée trois, voir plus bas — mot de
  passe `password123`).
- Réservation : un dîneur connecté choisit convives/jour/créneau (midi ou
  soir, `CRENEAUX_MIDI`/`CRENEAUX_SOIR` dans `src/lib/creneaux.ts`) sur la
  fiche établissement et confirme (`src/components/BookingCard.tsx` +
  `src/app/restaurants/[id]/actions.ts`). Le créneau doit tomber dans les 5
  prochains jours et ne pas être fermé côté restaurant (voir "Mes
  disponibilités" ci-dessous), sans vérifier les conflits de capacité.
- Espace restaurant (`/espace-restaurant`) : espace du contact connecté, scopé
  à son seul établissement (`src/app/espace-restaurant/`), organisé autour d'un
  menu latéral. Tableau de bord (`/espace-restaurant/tableau-de-bord`, l'écran
  d'accueil) : couverts du jour, réservations à venir, créneaux passés restant à
  pointer, note en cuillères — uniquement une lecture des données que les autres
  écrans détaillent, rien de nouveau n'y est calculé.
  Réservations reçues (à venir / passées) : pour un créneau confirmé déjà
  passé, le restaurant le marque honoré ou no-show
  (`marquerReservation` dans `src/app/espace-restaurant/reservations/actions.ts`)
  — `Booking.signaleeLe` capture l'horodatage du signalement. C'est ce geste
  qui débloquera la facturation (voir "Schéma réservation & facturation").
  Ma fiche établissement : le restaurant tient à jour nom/ville/cuisine/
  adresse/description/capacité/photo, jusqu'ici alimentés
  uniquement par le seed (`mettreAJourFiche` dans
  `src/app/espace-restaurant/fiche/actions.ts`). La photo (facultative) suit
  le même mécanisme que celles des plats — voir la story "Ma carte"
  ci-dessous et `src/lib/photos.ts`. Mes disponibilités : deux
  plannings distincts, tous deux vérifiés par `creerReservation` et tous deux
  lus par la fiche publique (`src/app/espace-restaurant/disponibilites/`) —
  les horaires d'ouverture habituels (`PlageOuverture`, un service continu
  sur un jour de semaine ; c'est ce qui s'affiche sur la fiche du dîneur et
  ce qui décide des créneaux qu'on lui propose) et les exceptions ponctuelles
  sur une date précise, via un calendrier mensuel (`ExceptionHoraire` :
  ouverture *ou* fermeture — chaque créneau du jour sélectionné est
  pré-rempli depuis les horaires habituels, et modifiable juste pour cette
  date, dans un sens ou l'autre). La règle qui combine les deux est écrite
  une seule fois, dans `src/lib/disponibilites.ts` : l'écran qui propose un
  créneau et le serveur qui l'accepte ne peuvent pas diverger. Un restaurant
  qui n'a rien déclaré garde tous ses créneaux proposés
  (`horairesDeclares`, `src/lib/horaires.ts`).
  Politique d'annulation : le restaurant définit
  `Restaurant.delaiAnnulationHeures` sur la fiche établissement. Le dîneur la
  voit avant de réserver (pied de la carte de réservation) et elle est
  appliquée dans "Mes réservations" — même règle des deux côtés, écrite une
  fois dans `src/lib/annulation.ts` : l'écran ne propose jamais un bouton que
  le serveur refuserait. Passé le délai, le dîneur ne peut plus annuler mais
  peut **prévenir qu'il ne viendra pas** (`Booking.absencePrevenueLe`) : la
  réservation reste CONFIRMEE, le restaurant garde la main sur honoré/no-show,
  mais il peut libérer la table, et l'information reste affichée après le
  service — c'est là qu'elle éclaire le choix honoré/no-show. Les écrans de
  litige ne la reprennent pas encore, et le motif `annulation_tardive` reste
  une story à part.
- Gestion de ma réservation (`/mes-reservations`) : un dîneur connecté voit
  ses réservations passées/à venir et peut annuler celles à venir
  (`src/app/mes-reservations/`). Une réservation annulée reste visible avec
  son statut, elle n'est pas supprimée.
- Dépôt d'avis (cuillères) : un dîneur connecté ayant une réservation
  confirmée déjà passée dans un restaurant peut y déposer un avis (note de 1
  à 5 cuillères + commentaire facultatif) ou modifier celui qu'il a déjà
  laissé — un seul avis par (dîneur, restaurant)
  (`src/components/AvisForm.tsx` + `deposerAvis` dans
  `src/app/restaurants/[id]/actions.ts`). `Restaurant.noteCuilleres`/
  `nombreAvis` sont recalculés à chaque dépôt. Pas de modération pour
  l'instant (voir le ticket Notion "Modération des avis") ni de lien avec un
  éventuel déréférencement — décisions volontairement laissées ouvertes sur
  l'epic "Avis & notation".
- Auth staff TheSpoon (`/connexion-admin`) : connexion, session, déconnexion
  pour un membre du staff (table `Staff`) — via une troisième instance
  better-auth (`authAdmin` dans `src/lib/auth.ts`), entièrement séparée des
  deux précédentes (table, cookie et route API dédiés :
  `/api/auth-admin`). Pas d'inscription : les comptes sont créés côté
  TheSpoon (`pnpm seed:dev` en crée deux, voir plus bas — mot de passe
  `password123`). Pas de permissions par rôle pour l'instant : tout le staff
  connecté a le même accès (voir le ticket Notion "Auth staff TheSpoon &
  permissions" pour la suite).
- Console staff / BO admin (`/admin`, qui renvoie sur `/admin/restaurants`) :
  liste des restaurants partenaires
  avec recherche (nom/ville), fiche détail (infos, contacts, réservations
  récentes), création et modification d'un restaurant
  (`src/app/admin/`). Toute création ou modification est tracée dans un
  journal d'audit (`JournalAuditRestaurant` : qui, quand, quels champs ont
  changé et leurs valeurs avant/après), affiché sur la fiche détail. Pas de
  section factures : l'epic Facturation & commission n'existe pas encore,
  l'afficher aurait été fictif.
- Ma carte (`/espace-restaurant/menu`) : le contact restaurant connecté gère
  la carte de son établissement — ajoute, modifie, supprime un plat (nom,
  description/ingrédients, catégorie entrée/plat/dessert, prix, allergènes,
  photo facultative), visible immédiatement sur la fiche publique et sur
  l'accueil (`src/app/espace-restaurant/menu/`). Les photos (plats et fiche
  établissement) sont stockées sur Netlify Blobs (`src/lib/photos.ts`, un
  store par type d'entité — `plats-photos.ts`/`restaurants-photos.ts` —
  servis par `/api/plats/[platId]/photo` et `/api/restaurants/[id]/photo`) —
  sans configuration sur Netlify. En local (`pnpm dev`), pas de Netlify Blobs
  disponible : on écrit sur disque dans `.local-blobs/` (ignoré par git),
  même interface, transparent pour le reste du code.

## « Non renseigné » n'est pas « sans allergène »

Les quatorze allergènes à déclaration obligatoire (annexe II du règlement UE
n° 1169/2011) se cochent sur chaque plat dans « Ma carte », et s'affichent sur
la fiche publique sous le plat. La liste est un enum (`Allergene`), pas du
texte libre : elle est réglementaire et fermée, et un dîneur ne peut pas
filtrer sur des orthographes libres.

Le champ qui compte n'est pas la liste, c'est `PlatCuillere.allergenesDeclaresLe`.
Une liste vide, seule, est ambiguë — elle décrit aussi bien un plat sans
allergène qu'un plat que personne n'a renseigné, et les confondre revient à
rassurer un dîneur allergique sur la foi d'un champ jamais rempli. D'où trois
états, et non deux (`lireDeclaration`, `src/lib/allergenes.ts`) :

| En base | À l'écran |
|---|---|
| liste vide, pas de date | « Allergènes non renseignés — demandez au restaurant » |
| liste vide, **datée** | « Aucun des 14 allergènes majeurs » |
| liste remplie, datée | une pastille par allergène |

Conséquence directe sur le formulaire : on ne se déclare « sans allergène »
qu'en cochant explicitement « Aucun de ces allergènes dans ce plat ». Sans
cette case, un restaurateur qui corrige un prix daterait sans le savoir une
déclaration vide sur un plat jamais renseigné. La règle est écrite une fois,
dans `declarationDepuisFormulaire` — l'écran empêche de cocher à la fois
« aucun » et un allergène, le serveur retranche quand même.

Le plat non renseigné le dit, il ne se tait pas : ne rien afficher se lirait
comme « rien à signaler », ce qui est exactement l'information qu'on n'a pas.
Côté restaurateur, « Ma carte » compte les plats concernés en tête de liste.
Le carrousel de l'accueil, lui, n'affiche pas les allergènes : c'est une
vignette de 270 px qui mène à la fiche, pas une fiche produit.

## Ce qui n'existe pas encore

Le reste du backlog Notion : facturation, litiges, modération des avis,
ticketing, base documentaire.

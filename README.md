# TheSpoon

Plateforme de réservation de restaurants — concurrent de LaFourchette, note
en cuillères. Voir la page Notion « 🥄 TheSpoon » (backlog + vision) pour le
contexte produit, et `../thespoon-env/CANON.md` pour la mécanique métier
détaillée (facturation, commission, litiges) dont ce produit s'inspire.

**Approche : produit et écrans d'abord, schéma ensuite.** Le modèle de
données n'est pas conçu à l'avance en un bloc — chaque table arrive avec
l'écran qui en a besoin. `prisma/schema.prisma` contient aujourd'hui
`Restaurant`/`PlatCuillere` (recherche + fiche établissement),
`HoraireFermeture`/`ExceptionHoraire` (disponibilités), `Booking`
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

## Migrations de base de données

Tout changement de `prisma/schema.prisma` passe par une migration versionnée
et commitée dans `prisma/migrations/`, jamais par `db push` directement sur
une base partagée — deux incidents de prod ont déjà été causés par un schéma
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
  adresse/horaires/description/capacité/photo, jusqu'ici alimentés
  uniquement par le seed (`mettreAJourFiche` dans
  `src/app/espace-restaurant/fiche/actions.ts`). La photo (facultative) suit
  le même mécanisme que celles des plats — voir la story "Ma carte"
  ci-dessous et `src/lib/photos.ts`. Mes disponibilités : deux
  plannings distincts, tous deux vérifiés par `creerReservation`
  (`src/app/espace-restaurant/disponibilites/`) — l'horaire d'ouverture
  classique, récurrent et non daté (`HoraireFermeture`, un jour de semaine ou
  un créneau fermé toutes les semaines) et les exceptions ponctuelles sur une
  date précise, via un calendrier mensuel (`ExceptionHoraire` : ouverture
  *ou* fermeture — chaque créneau du jour sélectionné est pré-rempli depuis
  le récurrent, et modifiable juste pour cette date, dans un sens ou l'autre).
  Politique d'annulation : le restaurant définit
  `Restaurant.delaiAnnulationHeures` sur la fiche établissement — le délai
  minimal d'annulation côté dîneur et le motif de contestation
  `annulation_tardive` ne l'exploitent pas encore, ce sont des stories
  séparées du backlog.
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
  description/ingrédients, catégorie entrée/plat/dessert, prix, photo
  facultative), visible immédiatement sur la fiche publique et sur l'accueil
  (`src/app/espace-restaurant/menu/`). Les photos (plats et fiche
  établissement) sont stockées sur Netlify Blobs (`src/lib/photos.ts`, un
  store par type d'entité — `plats-photos.ts`/`restaurants-photos.ts` —
  servis par `/api/plats/[platId]/photo` et `/api/restaurants/[id]/photo`) —
  sans configuration sur Netlify. En local (`pnpm dev`), pas de Netlify Blobs
  disponible : on écrit sur disque dans `.local-blobs/` (ignoré par git),
  même interface, transparent pour le reste du code.

## Ce qui n'existe pas encore

Le reste du backlog Notion : facturation, litiges, modération des avis,
ticketing, base documentaire.

# TheSpoon

Plateforme de réservation de restaurants — concurrent de LaFourchette, note
en cuillères. Voir la page Notion « 🥄 TheSpoon » (backlog + vision) pour le
contexte produit, et `../thespoon-env/CANON.md` pour la mécanique métier
détaillée (facturation, commission, litiges) dont ce produit s'inspire.

**Approche : produit et écrans d'abord, schéma ensuite.** Le modèle de
données n'est pas conçu à l'avance en un bloc — chaque table arrive avec
l'écran qui en a besoin. Exception assumée : `Staff` est un socle posé en
avance (story "Modèle de données" dédiée), sans écran ni connexion pour
l'instant — juste l'identité, en préparation de l'auth staff.
`prisma/schema.prisma` contient aujourd'hui `Restaurant`/`PlatCuillere`
(recherche + fiche établissement), `Booking` (réservation), `Avis` (dépôt
d'avis), `Staff` (socle staff, sans auth), les tables d'auth dîneur
(`User`/`Session`/`Account`/`Verification`, générées par better-auth) et les
tables d'auth restaurant partenaire (`RestaurantContact` +
`RestaurantContactSession`/`RestaurantContactAccount`/
`RestaurantContactVerification`, même mécanique better-auth, tables
séparées).

Identité visuelle non décidée : les couleurs dans `globals.css` sont un
placeholder neutre, à ne pas confondre avec la charte Hymaïa (TheSpoon est sa
propre marque, pas une interface interne Hymaïa).

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
  tourner avec un schéma différent de celui attendu par le code.
- `prisma db push` reste légitime pour bricoler vite en local (un schéma
  jetable, une expérimentation), mais ne doit jamais être utilisé contre la
  base de production.

## Ce qui existe

- Recherche de restaurants (`/`) et fiche établissement (`/restaurants/[id]`),
  branchées sur une vraie base PostgreSQL via Prisma.
- Auth dîneur (`/connexion`) : inscription, connexion, session, déconnexion —
  via better-auth. Staff TheSpoon reste à faire.
- Auth restaurant partenaire (`/connexion-restaurant`) : connexion, session,
  déconnexion pour le contact d'un restaurant (gérant/chef de salle) — via
  une deuxième instance better-auth (`authRestaurant` dans `src/lib/auth.ts`),
  entièrement séparée de celle des dîneurs (table, cookie et route API
  dédiés : `/api/auth-restaurant`). Pas d'inscription : les comptes sont
  créés côté TheSpoon (`pnpm seed:dev` en crée trois, voir plus bas — mot de
  passe `password123`). Un contact connecté ne voit que les données de son
  propre établissement : `/restaurants/[id]/reservations` vérifie que `id`
  correspond à son restaurant et le renvoie vers le sien sinon.
- Réservation : un dîneur connecté choisit convives/jour/créneau sur la fiche
  établissement et confirme (`src/components/BookingCard.tsx` +
  `src/app/restaurants/[id]/actions.ts`). Pas de moteur de disponibilité — un
  créneau est valide s'il tombe dans les 5 prochains jours, sans vérifier les
  conflits. `/restaurants/[id]/reservations` liste les réservations d'un
  restaurant, réservé à son contact connecté — c'est une vue de secours en
  attendant la vraie espace restaurant (tableau de bord complet), pas un
  vrai back-office partenaire.
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
- Socle staff : table `Staff` (organigramme interne), pas encore de
  connexion ni d'écran — prépare "Auth staff TheSpoon & permissions".
  `pnpm seed:dev` en crée quelques-uns.

## Ce qui n'existe pas encore

Le reste du backlog Notion : auth staff, espace restaurant (BO complet),
BO admin, facturation, litiges, modération des avis, ticketing, base
documentaire.

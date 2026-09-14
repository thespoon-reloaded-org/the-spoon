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
pnpm db:push            # à relancer après chaque changement de prisma/schema.prisma
pnpm seed:dev
pnpm dev                # http://localhost:3100
```

`BETTER_AUTH_SECRET` se génère avec `openssl rand -hex 32`.

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
  passe `password123`).
- Réservation : un dîneur connecté choisit convives/jour/créneau (midi ou
  soir, `CRENEAUX_MIDI`/`CRENEAUX_SOIR` dans `src/lib/creneaux.ts`) sur la
  fiche établissement et confirme (`src/components/BookingCard.tsx` +
  `src/app/restaurants/[id]/actions.ts`). Le créneau doit tomber dans les 5
  prochains jours et ne pas être fermé côté restaurant (voir "Mes
  disponibilités" ci-dessous), sans vérifier les conflits de capacité.
- Espace restaurant (`/espace-restaurant`) : tableau de bord du contact
  connecté, scopé à son seul établissement (`src/app/espace-restaurant/`).
  Réservations reçues (à venir / passées) : pour un créneau confirmé déjà
  passé, le restaurant le marque honoré ou no-show
  (`marquerReservation` dans `src/app/espace-restaurant/reservations/actions.ts`)
  — `Booking.signaleeLe` capture l'horodatage du signalement. C'est ce geste
  qui débloquera la facturation (voir "Schéma réservation & facturation").
  Ma fiche établissement : le restaurant tient à jour nom/ville/cuisine/
  adresse/horaires/description/capacité, jusqu'ici alimentés uniquement par
  le seed (`mettreAJourFiche` dans
  `src/app/espace-restaurant/fiche/actions.ts`). Mes disponibilités : deux
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
- Socle staff : table `Staff` (organigramme interne), pas encore de
  connexion ni d'écran — prépare "Auth staff TheSpoon & permissions".
  `pnpm seed:dev` en crée quelques-uns.

## Ce qui n'existe pas encore

Le reste du backlog Notion : auth staff, espace restaurant (BO complet),
BO admin, facturation, litiges, modération des avis, ticketing, base
documentaire.

# TheSpoon

Plateforme de réservation de restaurants — concurrent de LaFourchette, note
en cuillères. Voir la page Notion « 🥄 TheSpoon » (backlog + vision) pour le
contexte produit, et `../thespoon-env/CANON.md` pour la mécanique métier
détaillée (facturation, commission, litiges) dont ce produit s'inspire.

**Approche : produit et écrans d'abord, schéma ensuite.** Le modèle de
données n'est pas conçu à l'avance en un bloc — chaque table arrive avec
l'écran qui en a besoin. `prisma/schema.prisma` ne contient aujourd'hui que
`Restaurant`/`PlatCuillere` (recherche + fiche établissement), `Booking`
(réservation) et les tables d'auth dîneur (`User`/`Session`/`Account`/
`Verification`, générées par better-auth).

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
  via better-auth. Restaurant partenaire et staff TheSpoon restent à faire.
- Réservation : un dîneur connecté choisit convives/jour/créneau sur la fiche
  établissement et confirme (`src/components/BookingCard.tsx` +
  `src/app/restaurants/[id]/actions.ts`). Pas de moteur de disponibilité — un
  créneau est valide s'il tombe dans les 5 prochains jours, sans vérifier les
  conflits. `/restaurants/[id]/reservations` liste les réservations d'un
  restaurant : c'est une vue de secours non protégée en attendant la vraie
  espace restaurant, pas un vrai back-office partenaire.
- Gestion de ma réservation (`/mes-reservations`) : un dîneur connecté voit
  ses réservations passées/à venir et peut annuler celles à venir
  (`src/app/mes-reservations/`). Une réservation annulée reste visible avec
  son statut, elle n'est pas supprimée.

## Ce qui n'existe pas encore

Le reste du backlog Notion : auth restaurant partenaire / staff, espace
restaurant (BO complet), BO admin, facturation, litiges, avis, ticketing,
base documentaire.

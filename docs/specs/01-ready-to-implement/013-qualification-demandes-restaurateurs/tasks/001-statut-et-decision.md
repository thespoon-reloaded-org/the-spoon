---
id: 001
title: Accepter ou rejeter une demande restaurateur, avec journal
status: pending
---

# Task

Donner un statut et un journal aux demandes de partenariat, et permettre au staff de les accepter ou de les rejeter depuis une fiche détail.

Modèle (`prisma/schema.prisma` + migration) :

- `enum StatutDemandeRestaurateur { A_QUALIFIER, ACCEPTEE, REJETEE }`.
- `DemandeContactRestaurateur.statut StatutDemandeRestaurateur @default(A_QUALIFIER)` — les demandes existantes prennent la valeur par défaut.
- `enum TypeEvenementDemandeRestaurateur { DEPOT, DECISION }` (la tâche 002 y ajoutera sa valeur).
- `model EvenementDemandeRestaurateur` sur le modèle d'`EvenementDossier` : `id`, `demandeId` (relation `onDelete: Cascade`, indexée), `type`, `details Json?` figés à l'écriture, `auteurStaffId String?` + relation `Staff` (`null` pour le dépôt, qui vient du restaurateur), `createdAt`. Ajouter la relation inverse sur `Staff`. En ajout seul : aucun code ne met à jour ni ne supprime une ligne.
- Mettre à jour le commentaire `///` de `DemandeContactRestaurateur` qui annonce l'absence de statut.

Écriture : `envoyerDemandeContactRestaurateur` (`src/app/(site)/devenir-partenaire/actions.ts`) crée la demande **et** son événement `DEPOT` dans la même transaction.

Lecture : la lecture et le formatage du journal vont dans un module dédié (ex. `src/lib/evenements-demande.ts`), testé, qui transforme un événement + son auteur en ligne affichable (horodatage, titre, détail, auteur) et ne fait pas confiance à la forme de `details` — même précaution que `src/lib/evenements-dossier.ts`.

Fiche détail `src/app/admin/contacts-restaurateurs/[demandeId]/page.tsx` : toutes les informations de la demande (y compris les champs de la spec 012 s'ils sont déjà en place), le statut, le journal du plus récent au plus ancien, et un formulaire de décision. 404 via `PageIntrouvable` si l'id n'existe pas. Les cartes de la liste deviennent cliquables et portent un badge de statut.

Décision : une server action sous `exigerSessionStaff` qui prend l'issue (`ACCEPTEE` / `REJETEE`) et un motif obligatoire (1 à 2000 caractères), écrit le statut et l'événement `DECISION` (`details` : issue + motif) dans une transaction, puis revalide la fiche et la liste. Une demande déjà décidée n'est plus décidable : l'action refuse, et le formulaire n'est pas affiché.

## Acceptance criteria

- Migration commitée ; une demande existante se lit avec le statut `A_QUALIFIER`.
- Un dépôt depuis `/devenir-partenaire` crée un événement `DEPOT` sans auteur staff.
- Accepter ou rejeter écrit le statut et une ligne de journal portant l'auteur connecté, la date et le motif.
- Décider sans motif est refusé avec un message ; rien n'est écrit.
- Rejouer une décision sur une demande déjà décidée ne crée pas de deuxième ligne de journal (test).
- Le module de formatage du journal est couvert par des tests, dont un `details` vide ou inattendu.
- `pnpm typecheck`, `pnpm lint` et `pnpm test` passent.

## What to test

- Déposer une demande sur `/devenir-partenaire`, puis l'ouvrir depuis `/admin/contacts-restaurateurs` : la fiche montre le statut « À qualifier » et une ligne de journal « Demande déposée ».
- L'accepter avec un motif : le statut passe à « Acceptée », une ligne de journal apparaît avec votre nom et le motif, le formulaire de décision disparaît, et le badge de la liste est à jour.
- Rejeter une autre demande : même comportement avec « Rejetée ».
- Soumettre une décision avec un motif vide : message d'erreur, journal inchangé.
- Ouvrir `/admin/contacts-restaurateurs/un-id-inexistant` : page introuvable, pas d'erreur serveur.
- Vérifier qu'une demande créée avant la migration s'affiche correctement, journal vide ou réduit au dépôt.

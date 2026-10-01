# Qualification des demandes restaurateurs

Donner au staff TheSpoon de quoi traiter une demande de partenariat depuis la Console : l'accepter, la rejeter ou demander un complément d'informations au restaurateur, en gardant la trace de chaque geste.

## Goal

Chaque `DemandeContactRestaurateur` porte un statut de traitement et un journal en ajout seul. Depuis la Console staff, un membre du staff ouvre une demande, voit son historique complet (qui a fait quoi, quand, avec quel motif) et peut l'accepter, la rejeter ou demander des précisions.

## Why

La liste `/admin/contacts-restaurateurs` est aujourd'hui en lecture seule : le modèle dit lui-même « pas de statut de traitement pour l'instant, ça arrivera avec le ticket qui décrira le suivi de ces demandes ». Le suivi se fait donc hors outil (boîtes mail personnelles) : deux personnes peuvent traiter la même demande, personne ne sait pourquoi une candidature a été refusée six mois plus tôt, et une demande de précisions se perd.

## Scope

- `prisma/schema.prisma` + migrations : statut sur `DemandeContactRestaurateur`, journal `EvenementDemandeRestaurateur`.
- `src/app/admin/contacts-restaurateurs/` : liste (badges de statut) et nouvelle fiche détail `[demandeId]`.
- Server actions de décision et de demande de complément, sous garde staff (`exigerSessionStaff`).
- Un composant de journal, dans l'esprit de `JournalDossier` / `src/lib/evenements-dossier.ts`.

## Non-goals

- Aucun envoi d'email au restaurateur : la demande de complément est enregistrée et affichée, le contact part à la main (un ticket « notifications » viendra plus tard).
- Pas de création automatique du `Restaurant` ni du compte `RestaurantContact` à l'acceptation : le référencement reste manuel.
- Pas de rôles ni de permissions fines : tout staff connecté peut décider, comme ailleurs dans la Console.
- Pas de réponse du restaurateur dans le produit (pas d'espace public de suivi de sa candidature).

## Acceptance criteria (whole spec)

- `pnpm typecheck`, `pnpm lint` et `pnpm test` passent.
- Une demande peut être acceptée, rejetée ou mise en attente d'informations depuis la Console staff.
- Chaque geste ajoute une ligne au journal avec son auteur, sa date et son motif ; rien dans le produit ne modifie ni ne supprime une ligne existante.
- Les demandes existantes restent lisibles et apparaissent avec le statut initial.

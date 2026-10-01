# Formulaire d'éligibilité restaurateur

Enrichir le formulaire « Devenir partenaire » avec les trois informations qui manquent au staff pour juger de l'éligibilité d'un établissement : le SIREN, la fiche Google My Business et le fait de proposer, ou non, des menus qui se mangent à la cuillère.

## Goal

Une demande déposée depuis `/devenir-partenaire` porte le SIREN de l'entreprise, l'URL Google My Business (optionnelle) et une réponse oui/non sur les menus à la cuillère ; ces trois champs sont visibles dans la Console staff.

## Why

Aujourd'hui une demande (`DemandeContactRestaurateur`) ne contient que nom, email, établissement, adresse et message. Le staff doit rechercher à la main l'entreprise et son activité avant de pouvoir qualifier la demande. Le critère « menus à la cuillère » est le filtre d'éligibilité de TheSpoon : il doit être déclaré par le restaurateur, pas deviné.

## Scope

- `prisma/schema.prisma` et une migration : trois colonnes sur `DemandeContactRestaurateur`.
- `src/app/(site)/devenir-partenaire/actions.ts` : schéma Zod et enregistrement.
- `src/components/ContactRestaurateurForm.tsx` : les trois champs.
- `src/app/admin/contacts-restaurateurs/page.tsx` : affichage des trois champs.
- Tests unitaires de validation du SIREN et de l'URL.

## Non-goals

- Aucun appel à une API externe (INSEE/Sirene, Google) : rien n'est vérifié hors de la forme du champ.
- Pas de vérification de la clé de Luhn du SIREN : neuf chiffres suffisent.
- Aucun statut ni traitement de la demande — c'est l'objet de la spec 013.

## Acceptance criteria (whole spec)

- `pnpm typecheck`, `pnpm lint` et `pnpm test` passent.
- Un dépôt depuis `/devenir-partenaire` enregistre SIREN, URL Google My Business et menus à la cuillère.
- Les demandes déposées avant la migration restent lisibles dans la Console staff (colonnes nullables).

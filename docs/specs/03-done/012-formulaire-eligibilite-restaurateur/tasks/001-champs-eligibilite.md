---
id: 001
title: Ajouter SIREN, URL Google My Business et menus à la cuillère à la demande restaurateur
status: done
---

# Task

Ajouter trois informations à la demande de contact restaurateur, de la base jusqu'à la Console staff.

Modèle : trois colonnes sur `DemandeContactRestaurateur` dans `prisma/schema.prisma`, avec une migration Prisma. Toutes nullables, comme `adresse` : les demandes déjà en base n'ont pas ces champs, et un journal de demandes ne se réécrit pas.

- `siren String?` — neuf chiffres, stockés sans espace.
- `urlGoogleMyBusiness String?` — optionnel y compris pour les nouvelles demandes.
- `menusALaCuillere Boolean?` — la réponse oui/non du restaurateur.

Commenter chaque champ en `///` comme le reste du schéma, en disant pourquoi il est nullable.

Validation (`src/app/(site)/devenir-partenaire/actions.ts`) : étendre `schemaDemandeContact`.

- SIREN obligatoire ; les espaces sont retirés avant validation (le restaurateur recopie souvent `123 456 789`) ; exactement neuf chiffres, sinon « Le SIREN doit comporter 9 chiffres. ».
- URL Google My Business facultative ; vide -> `null` ; sinon URL `http`/`https` valide, 500 caractères max, sinon « Lien Google My Business invalide. ».
- Menus à la cuillère obligatoire : la valeur attendue est `"oui"` ou `"non"`, convertie en booléen ; absente -> « Indiquez si vous proposez des menus à la cuillère. ».

Formulaire (`src/components/ContactRestaurateurForm.tsx`) : un champ SIREN (`inputMode="numeric"`, `maxLength={11}` pour tolérer les espaces), un champ URL (`type="url"`, facultatif, placeholder d'exemple), et deux boutons radio `oui` / `non` pour « Proposez-vous des menus qui se mangent à la cuillère ? », aucun pré-coché. Même style que les champs existants (`CHAMP`, `LABEL_CHAMP`).

Console staff (`src/app/admin/contacts-restaurateurs/page.tsx`) : sur chaque carte, afficher le SIREN, un lien vers la fiche Google My Business (`target="_blank"`, `rel="noreferrer"`) et la réponse menus à la cuillère (« Menus à la cuillère : oui / non »). Chaque champ absent n'affiche rien, comme `adresse` aujourd'hui.

Tests : extraire la validation testable si besoin, et couvrir dans un fichier `*.test.ts` les cas SIREN valide avec espaces, SIREN à 8 chiffres, SIREN avec des lettres, URL vide, URL invalide, et menus à la cuillère manquant.

## Acceptance criteria

- `prisma/schema.prisma` déclare les trois colonnes nullables et une migration correspondante est commitée.
- Un POST du formulaire sans SIREN ou sans réponse « menus à la cuillère » est refusé avec le message annoncé ; rien n'est écrit en base.
- Un SIREN saisi `123 456 789` est stocké `123456789`.
- La page `/admin/contacts-restaurateurs` affiche les trois champs quand ils sont renseignés, et reste identique pour une demande antérieure.
- `pnpm typecheck`, `pnpm lint` et `pnpm test` passent.

## What to test

- Ouvrir `/devenir-partenaire`, remplir le formulaire avec SIREN `123 456 789`, une URL Google My Business et « oui » : la confirmation s'affiche, et la demande apparaît dans `/admin/contacts-restaurateurs` avec SIREN `123456789`, le lien cliquable et « Menus à la cuillère : oui ».
- Rejouer avec un SIREN de 8 chiffres : message d'erreur, aucune demande créée.
- Soumettre sans cocher oui/non : message d'erreur.
- Laisser l'URL vide : la demande passe, et la carte staff n'affiche pas de lien vide.
- Vérifier qu'une demande créée avant la migration (ou avec les colonnes à `null`) s'affiche toujours sans erreur dans la Console staff.

---
id: 002
title: Demander un complément d'informations à un restaurateur
status: pending
depends_on:
  - 001
---

# Task

Ajouter la troisième action du staff sur une demande de partenariat : contacter le restaurateur pour obtenir des précisions, sans trancher.

Modèle (`prisma/schema.prisma` + migration) : ajouter `INFOS_DEMANDEES` à `StatutDemandeRestaurateur` et `COMPLEMENT_DEMANDE` à `TypeEvenementDemandeRestaurateur`.

Action : une server action sous `exigerSessionStaff`, à côté de celle de la tâche 001, qui prend le message adressé au restaurateur (obligatoire, 1 à 2000 caractères), passe le statut à `INFOS_DEMANDEES` et écrit un événement `COMPLEMENT_DEMANDE` (`details` : le message) dans une transaction, puis revalide la fiche et la liste.

Règles de statut : on peut demander un complément tant que la demande n'est pas décidée (`A_QUALIFIER` ou `INFOS_DEMANDEES`), et plusieurs fois de suite — chaque demande ajoute sa ligne, le journal reste la seule trace complète ; la demande, elle, ne retient que son statut courant. Une demande `ACCEPTEE` ou `REJETEE` n'est plus relançable : l'action refuse et le formulaire n'est pas affiché.

Interface : sur la fiche `[demandeId]`, un formulaire « Demander des informations » (textarea + bouton) à côté du formulaire de décision, dans l'esprit de `DemanderComplementForm`. Le journal affiche le message envoyé. Le statut `INFOS_DEMANDEES` a son badge dans la liste et sur la fiche (libellé « Infos demandées »), et le staff peut toujours accepter ou rejeter ensuite.

Mettre à jour le formatage du journal (`src/lib/evenements-demande.ts`) et ses tests pour le nouveau type.

## Acceptance criteria

- Migration commitée ; le nouveau statut et le nouveau type d'événement existent.
- Demander un complément passe le statut à `INFOS_DEMANDEES` et ajoute une ligne au journal avec l'auteur, la date et le message.
- Deux demandes successives produisent deux lignes de journal (test).
- L'action est refusée sur une demande `ACCEPTEE` ou `REJETEE` (test), et le formulaire n'est pas rendu dans ce cas.
- Un message vide est refusé avec un message d'erreur, rien n'est écrit.
- `pnpm typecheck`, `pnpm lint` et `pnpm test` passent.

## What to test

- Ouvrir une demande « À qualifier », envoyer « Pouvez-vous préciser votre carte de desserts ? » : le statut passe à « Infos demandées », le message apparaît dans le journal avec votre nom, et le badge de la liste suit.
- Envoyer un deuxième message : les deux lignes restent visibles, la plus récente en haut.
- Accepter ensuite la demande : le statut passe à « Acceptée » et le journal garde les deux demandes de complément.
- Sur une demande déjà acceptée ou rejetée, vérifier que le formulaire de complément n'est pas proposé.
- Envoyer un message vide : message d'erreur, journal inchangé.

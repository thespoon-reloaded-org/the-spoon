# Agent de qualification

Juge les demandes « Devenir partenaire » encore `A_ANALYSER` (spec `012-agent-qualification-demandes`) : il cherche l'établissement sur le web, note les cinq critères (existence, localisation, réputation, menu, capacité) et rédige un brouillon de mail. Le statut est calculé par l'app (`deciderStatut`, `src/lib/qualification.ts`), et le staff relit et envoie le mail depuis `/admin/contacts-restaurateurs`.

```bash
pnpm dev               # l'app doit tourner (l'agent passe par l'API admin)
pnpm agent:qualifier
```

| Variable            | Rôle                                                                                                                                            |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `ADMIN_API_TOKEN`   | Jeton de l'API admin (obligatoire).                                                                                                             |
| `QUALIFIER_API_URL` | URL de l'app, `http://localhost:3100` par défaut.                                                                                               |
| `QUALIFIER_MODEL`   | Modèle Claude, `claude-sonnet-5-5` par défaut.                                                                                                  |
| `ANTHROPIC_API_KEY` | Facultatif en local : sans clé, le SDK reprend la connexion Claude Code de la machine (et consomme son abonnement). Obligatoire sur un serveur. |

- Outils de l'agent : `WebSearch` et `WebFetch`, rien d'autre (pas de shell, pas de fichiers). Le texte de la demande est traité comme une donnée.
- Une sortie qui ne respecte pas le schéma est ignorée : la demande reste à analyser et sera reprise au prochain lancement.
- Les consignes sont dans `prompt.md`, les zones cibles et l'adresse du support dans `src/lib/qualification.ts`.

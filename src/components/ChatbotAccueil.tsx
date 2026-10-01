"use client";

import dynamic from "next/dynamic";

/**
 * L'assistant de l'accueil, rendu côté navigateur seulement : il reprend la
 * conversation gardée dans le sessionStorage (voir `ChatbotRecherche`), que
 * le serveur ne peut pas lire — un rendu serveur sans elle ne correspondrait
 * pas au premier rendu client. Le bouton flottant n'a rien à indexer, ne
 * rien rendre côté serveur ne coûte rien.
 */
export const ChatbotAccueil = dynamic(
  () => import("./ChatbotRecherche").then((m) => m.ChatbotRecherche),
  { ssr: false },
);

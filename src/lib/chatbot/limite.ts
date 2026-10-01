/**
 * Garde-fou contre l'usage abusif de la route du chatbot, qui coûte un appel
 * au modèle à chaque requête et est ouverte à tout visiteur.
 *
 * En mémoire, par instance : sur du serverless, chaque instance a son propre
 * compteur, donc la limite réelle est un multiple de `MAX` — assez pour
 * freiner un script, pas pour un plafond exact. Un vrai quota partagé
 * demanderait un stockage commun (hors périmètre de ce premier jet).
 */
const FENETRE_MS = 10 * 60 * 1000;
const MAX = 12;

const passages = new Map<string, number[]>();

export function limiteAtteinte(cle: string, maintenant = Date.now()): boolean {
  const recents = (passages.get(cle) ?? []).filter((t) => maintenant - t < FENETRE_MS);
  if (recents.length >= MAX) {
    passages.set(cle, recents);
    return true;
  }
  recents.push(maintenant);
  passages.set(cle, recents);

  // Évite que la table ne grossisse indéfiniment.
  if (passages.size > 5000) {
    for (const [k, v] of passages) {
      if (v.every((t) => maintenant - t >= FENETRE_MS)) passages.delete(k);
    }
  }
  return false;
}

/** Vide l'état — pour les tests. */
export function reinitialiserLimite(): void {
  passages.clear();
}

import path from "node:path";

import { defineConfig } from "vitest/config";

// Vitest (Vite) ne lit pas `tsconfig.json` — on rejoue ici le seul alias dont
// on a besoin (`@/*` -> `src/*`, voir tsconfig.json) pour que les fichiers
// testés puissent s'importer comme dans l'app.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  test: {
    // Vitest ne lit pas `.env` non plus. Sans ça, tout fichier qui importe
    // `src/lib/env.ts` (API d'administration, générateur du jeu) tombait sur
    // un poste avec « Configuration incomplète », alors que la CI, qui pose
    // ses variables elle-même, restait verte. `dotenv` n'écrase pas une
    // variable déjà posée : la CI et `DATABASE_URL=… pnpm test` gardent la main.
    setupFiles: ["dotenv/config"],
  },
});

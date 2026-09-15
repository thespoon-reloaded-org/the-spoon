import path from "node:path";

import { defineConfig } from "vitest/config";

// Vitest (Vite) ne lit pas `tsconfig.json` — on rejoue ici le seul alias dont
// on a besoin (`@/*` -> `src/*`, voir tsconfig.json) pour que les fichiers
// testés puissent s'importer comme dans l'app.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
});

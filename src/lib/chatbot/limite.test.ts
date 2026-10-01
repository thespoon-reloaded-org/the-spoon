import { beforeEach, expect, test } from "vitest";

import { limiteAtteinte, reinitialiserLimite } from "@/lib/chatbot/limite";

beforeEach(() => reinitialiserLimite());

test("bloque au-delà de 12 recherches en 10 minutes, par visiteur", () => {
  const t0 = 1_000_000;
  for (let i = 0; i < 12; i++) expect(limiteAtteinte("a", t0 + i)).toBe(false);
  expect(limiteAtteinte("a", t0 + 20)).toBe(true);
  expect(limiteAtteinte("b", t0 + 20)).toBe(false);
  // La fenêtre glisse : dix minutes plus tard, c'est reparti.
  expect(limiteAtteinte("a", t0 + 10 * 60 * 1000 + 20)).toBe(false);
});

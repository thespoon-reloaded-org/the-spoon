import Anthropic from "@anthropic-ai/sdk";
import { beforeEach, expect, test, vi } from "vitest";

/**
 * Ce que la route renvoie quand le fournisseur du modèle échoue : la
 * production passait par l'AI Gateway de Netlify, qui répondait 403 sans
 * corps, et le dîneur ne lisait que « La recherche a échoué ».
 */
const agent = vi.hoisted(() => ({ erreur: null as unknown }));

vi.mock("@/lib/env", () => ({ env: { OPENROUTER_API_KEY: "cle-de-test" } }));
vi.mock("@/lib/chatbot/agent", () => ({
  assistantDisponible: () => true,
  lancerAgent: async () => {
    throw agent.erreur;
  },
}));

import { POST } from "@/app/api/chatbot/route";
import { reinitialiserLimite } from "@/lib/chatbot/limite";

function requete() {
  return new Request("http://localhost/api/chatbot", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.7" },
    body: JSON.stringify({ messages: [{ role: "user", content: "Un bistrot à Lyon" }] }),
  });
}

beforeEach(() => {
  reinitialiserLimite();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

test("un refus ou une saturation du fournisseur invite à réessayer", async () => {
  for (const status of [403, 429, 529]) {
    agent.erreur = Anthropic.APIError.generate(status, undefined, "refus", new Headers());
    const reponse = await POST(requete());
    expect(reponse.status).toBe(503);
    expect((await reponse.json()).erreur).toMatch(/très demandé/);
  }
});

test("toute autre panne reste une erreur générique", async () => {
  agent.erreur = new Error("base injoignable");
  const reponse = await POST(requete());
  expect(reponse.status).toBe(502);
  expect((await reponse.json()).erreur).toBe("La recherche a échoué, réessaie.");
});

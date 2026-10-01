import { beforeEach, expect, test, vi } from "vitest";

/**
 * Choix du fournisseur du modèle. En production, une clé OpenRouter mal
 * recopiée a fait échouer toutes les recherches (401 d'OpenRouter) alors que
 * la clé Anthropic injectée par l'AI Gateway aurait répondu : l'assistant
 * doit écarter une clé mal formée, et se replier sur le fournisseur suivant
 * quand une clé est refusée.
 */
const etat = vi.hoisted(() => ({
  env: {} as Record<string, string | undefined>,
  /** Adresses appelées, dans l'ordre : `openrouter` ou `anthropic`. */
  appels: [] as string[],
  /** Le fournisseur qui refuse l'authentification. */
  refuse: null as string | null,
}));

vi.mock("@/lib/env", () => ({ env: etat.env }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

vi.mock("@anthropic-ai/sdk", async (importOriginal) => {
  const { default: Vraie } = await importOriginal<typeof import("@anthropic-ai/sdk")>();
  class Factice {
    beta: { messages: { create: () => Promise<unknown> } };
    constructor(options: { baseURL?: string }) {
      const nom = options.baseURL?.includes("openrouter") ? "openrouter" : "anthropic";
      this.beta = {
        messages: {
          create: async () => {
            etat.appels.push(nom);
            if (etat.refuse === nom) {
              throw Vraie.APIError.generate(401, undefined, "clé refusée", new Headers());
            }
            // Une réponse sans outil : l'agent la rend telle quelle.
            return { stop_reason: "end_turn", content: [{ type: "text", text: `réponse ${nom}` }] };
          },
        },
      };
    }
    static APIError = Vraie.APIError;
    static AuthenticationError = Vraie.AuthenticationError;
    static PermissionDeniedError = Vraie.PermissionDeniedError;
    static APIConnectionTimeoutError = Vraie.APIConnectionTimeoutError;
  }
  return { default: Factice };
});

import { assistantDisponible, lancerAgent } from "@/lib/chatbot/agent";

const DEMANDE = [{ role: "user" as const, content: "Un bistrot à Lyon" }];

beforeEach(() => {
  for (const cle of Object.keys(etat.env)) delete etat.env[cle];
  etat.appels = [];
  etat.refuse = null;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

test("OpenRouter passe avant la clé Anthropic quand sa clé est valide", async () => {
  etat.env.OPENROUTER_API_KEY = "sk-or-v1-cle-de-test";
  etat.env.ANTHROPIC_API_KEY = "cle-injectee";
  expect((await lancerAgent(DEMANDE)).message).toBe("réponse openrouter");
  expect(etat.appels).toEqual(["openrouter"]);
});

test("une clé OpenRouter sans son préfixe est écartée", async () => {
  etat.env.OPENROUTER_API_KEY = "cle-recopiee-sans-prefixe";
  etat.env.ANTHROPIC_API_KEY = "cle-injectee";
  expect((await lancerAgent(DEMANDE)).message).toBe("réponse anthropic");
  expect(etat.appels).toEqual(["anthropic"]);
  expect(console.error).toHaveBeenCalledWith(expect.stringContaining("OPENROUTER_API_KEY ignorée"));
});

test("une clé refusée bascule sur le fournisseur suivant", async () => {
  etat.env.OPENROUTER_API_KEY = "sk-or-v1-revoquee";
  etat.env.ANTHROPIC_API_KEY = "cle-injectee";
  etat.refuse = "openrouter";
  expect((await lancerAgent(DEMANDE)).message).toBe("réponse anthropic");
  expect(etat.appels).toEqual(["openrouter", "anthropic"]);
});

test("sans fournisseur de repli, le refus remonte", async () => {
  etat.env.OPENROUTER_API_KEY = "sk-or-v1-revoquee";
  etat.refuse = "openrouter";
  await expect(lancerAgent(DEMANDE)).rejects.toMatchObject({ status: 401 });
});

test("une clé mal formée seule ne suffit pas à afficher l'assistant", () => {
  etat.env.OPENROUTER_API_KEY = "pas-une-cle";
  expect(assistantDisponible()).toBe(false);
});

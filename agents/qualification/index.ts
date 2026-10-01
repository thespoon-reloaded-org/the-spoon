/**
 * Agent de qualification des demandes « Devenir partenaire » (spec 012).
 * Lit les demandes `A_ANALYSER` par l'API admin, les fait juger par Claude
 * (Claude Agent SDK, recherche web seulement), renvoie l'analyse. Voir
 * README.md à côté.
 *
 * ```bash
 * pnpm agent:qualifier
 * ```
 */
import "dotenv/config";

import { readFileSync } from "node:fs";

import { query } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

import {
  ETAPE_2_URL,
  schemaAnalyseDemande,
  SUPPORT_EMAIL,
  ZONES_CIBLES,
} from "../../src/lib/qualification";
import { type Demande, messageDemande, qualifierDemandes } from "./qualifier";

/** Les seuls outils de l'agent : le texte d'une demande n'est pas digne de confiance. */
export const OUTILS_AGENT = ["WebSearch", "WebFetch"];

const API = process.env.QUALIFIER_API_URL ?? "http://localhost:3100";
const MODELE = process.env.QUALIFIER_MODEL ?? "claude-sonnet-5-5";
const JETON = process.env.ADMIN_API_TOKEN;
if (!JETON) throw new Error("ADMIN_API_TOKEN manquant (voir .env.example).");

const consignes = readFileSync(new URL("./prompt.md", import.meta.url), "utf8")
  .replace("{{ZONES_CIBLES}}", ZONES_CIBLES.join(", "))
  .replace("{{SUPPORT_EMAIL}}", SUPPORT_EMAIL)
  .replace("{{ETAPE_2_URL}}", ETAPE_2_URL);
const schemaSortie = z.toJSONSchema(schemaAnalyseDemande, { io: "input" });

async function api(chemin: string, init?: RequestInit) {
  const reponse = await fetch(`${API}/api/admin${chemin}`, {
    ...init,
    headers: { authorization: `Bearer ${JETON}`, "content-type": "application/json" },
  });
  if (!reponse.ok) throw new Error(`API ${reponse.status} : ${await reponse.text()}`);
  return reponse.json();
}

async function analyser(demande: Demande): Promise<unknown> {
  for await (const message of query({
    prompt: messageDemande(demande),
    options: {
      model: MODELE,
      systemPrompt: consignes,
      tools: OUTILS_AGENT,
      allowedTools: OUTILS_AGENT,
      permissionMode: "dontAsk",
      settingSources: [],
      maxTurns: 30,
      outputFormat: { type: "json_schema", schema: schemaSortie },
    },
  })) {
    if (message.type !== "result") continue;
    if (message.subtype !== "success") throw new Error(`agent : ${message.subtype}`);
    return message.structured_output;
  }
  throw new Error("agent : pas de résultat");
}

await qualifierDemandes({
  listerAAnalyser: async () => (await api("/demandes?statut=A_ANALYSER")).demandes,
  analyser,
  enregistrer: async (id, analyse) => {
    await api(`/demandes/${id}`, { method: "PATCH", body: JSON.stringify(analyse) });
  },
});

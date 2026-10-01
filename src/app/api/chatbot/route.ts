import { NextResponse } from "next/server";
import { z } from "zod";

import { assistantDisponible, lancerAgent } from "@/lib/chatbot/agent";
import { limiteAtteinte } from "@/lib/chatbot/limite";

// Une recherche enchaîne plusieurs appels au modèle et à la base.
export const maxDuration = 60;

const corps = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        // Une réponse de l'assistant porte aussi la liste qu'il a proposée.
        content: z.string().trim().min(1).max(2000),
      }),
    )
    .min(1)
    .max(10)
    .refine((m) => m[0]!.role === "user" && m[m.length - 1]!.role === "user", {
      message: "La conversation doit commencer et finir par un message du dîneur.",
    })
    .refine((m) => m.every((x) => x.role === "assistant" || x.content.length <= 600), {
      message: "Message trop long.",
    }),
  /** Restaurants déjà montrés dans la conversation — « Autre proposition ». */
  dejaProposes: z.array(z.string().min(1).max(40)).max(100).default([]),
});

/**
 * Assistant de recherche de l'accueil : reçoit la conversation (texte seul),
 * rend un message et jusqu'à 10 restaurants classés. Public, comme la
 * recherche de l'accueil — pas de session, mais une limite de débit par IP.
 */
export async function POST(request: Request) {
  if (!assistantDisponible()) {
    return NextResponse.json({ erreur: "Assistant indisponible." }, { status: 503 });
  }

  const lu = corps.safeParse(await request.json().catch(() => null));
  if (!lu.success) {
    return NextResponse.json({ erreur: "Requête invalide." }, { status: 400 });
  }

  const ip =
    request.headers.get("x-nf-client-connection-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "inconnue";
  if (limiteAtteinte(ip)) {
    return NextResponse.json(
      { erreur: "Beaucoup de recherches d'un coup — réessaie dans quelques minutes." },
      { status: 429 },
    );
  }

  try {
    return NextResponse.json(await lancerAgent(lu.data.messages, lu.data.dejaProposes));
  } catch (erreur) {
    console.error("Chatbot en échec :", erreur);
    return NextResponse.json({ erreur: "La recherche a échoué, réessaie." }, { status: 502 });
  }
}

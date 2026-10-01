import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

const corps = z.object({
  propositionId: z.string().min(1).max(40),
  verdict: z.enum(["AIME", "AIME_PAS"]),
});

/**
 * Verdict du dîneur sur un top 10 de l'assistant : cœur plein ou cœur brisé.
 * Il ne peut porter que sur une proposition réellement servie (l'id vient de
 * `/api/chatbot`), et se change à volonté — le dernier clic fait foi.
 */
export async function POST(request: Request) {
  const lu = corps.safeParse(await request.json().catch(() => null));
  if (!lu.success) {
    return NextResponse.json({ erreur: "Requête invalide." }, { status: 400 });
  }

  const { count } = await prisma.propositionAssistant.updateMany({
    where: { id: lu.data.propositionId },
    data: { verdict: lu.data.verdict, verdictLe: new Date() },
  });
  if (count === 0) {
    return NextResponse.json({ erreur: "Proposition introuvable." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

import "dotenv/config";

import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

/** Route `/api/admin/demandes`. Nécessite une vraie base Postgres (`DATABASE_URL`). */
const { JETON, EMAIL_STAFF } = vi.hoisted(() => {
  const valeurs = {
    JETON: "t".repeat(64),
    EMAIL_STAFF: `demandes-${Date.now()}@staff.test.example`,
  };
  process.env.ADMIN_API_TOKEN = valeurs.JETON;
  process.env.ADMIN_API_STAFF_EMAIL = valeurs.EMAIL_STAFF;
  return valeurs;
});

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import * as demandeParId from "@/app/api/admin/demandes/[id]/route";
import * as demandes from "@/app/api/admin/demandes/route";
import { prisma } from "@/lib/prisma";

function requete(corps?: unknown, jeton: string | null = JETON) {
  return new Request("http://test/api/admin/demandes", {
    method: corps === undefined ? "GET" : "POST",
    headers: {
      "content-type": "application/json",
      ...(jeton ? { authorization: `Bearer ${jeton}` } : {}),
    },
    body: corps === undefined ? undefined : JSON.stringify(corps),
  });
}

async function appeler(route: (r: Request, c: unknown) => Promise<Response>, r: Request) {
  const reponse = await route(r, {});
  return { statut: reponse.status, corps: await reponse.json() };
}

const suffixe = randomUUID().slice(0, 8);
const email = `resto-${suffixe}@test.example`;
const valide = (etablissement: string) => ({
  nom: "Sophie Laurent",
  email,
  etablissement: `${etablissement} ${suffixe}`,
  adresse: "7 rue Exemple, 75009 Paris",
  message: "Nous souhaitons être référencés.",
});

beforeAll(async () => {
  await prisma.staff.create({ data: { nom: "Admin demandes", email: EMAIL_STAFF } });
});

afterAll(async () => {
  await prisma.demandeContactRestaurateur.deleteMany({ where: { email } });
  await prisma.staff.deleteMany({ where: { email: EMAIL_STAFF } });
  await prisma.$disconnect();
});

describe("POST /api/admin/demandes", () => {
  test("refuse sans jeton", async () => {
    const r = await appeler(demandes.POST, requete([valide("Sans jeton")], null));
    expect(r.statut).toBe(401);
  });

  test("accepte un objet seul et le date avec creeLe", async () => {
    const r = await appeler(
      demandes.POST,
      requete({ ...valide("Objet seul"), creeLe: "2026-09-24T09:12:00+02:00" }),
    );
    expect(r.statut).toBe(201);
    expect(r.corps.crees).toHaveLength(1);
    expect(r.corps.crees[0].createdAt).toBe("2026-09-24T07:12:00.000Z");
  });

  test("enregistre l'adresse et la rend obligatoire", async () => {
    const r = await appeler(demandes.POST, requete(valide("Avec adresse")));
    expect(r.statut).toBe(201);
    const ligne = await prisma.demandeContactRestaurateur.findUniqueOrThrow({
      where: { id: r.corps.crees[0].id },
    });
    expect(ligne.adresse).toBe("7 rue Exemple, 75009 Paris");

    const sansAdresse: Record<string, unknown> = valide("Sans adresse");
    delete sansAdresse.adresse;
    expect((await appeler(demandes.POST, requete(sansAdresse))).statut).toBe(400);
  });

  test("accepte une liste", async () => {
    const r = await appeler(demandes.POST, requete([valide("Liste A"), valide("Liste B")]));
    expect(r.statut).toBe(201);
    expect(r.corps.crees).toHaveLength(2);
  });

  test("tout-ou-rien : une demande invalide n'écrit rien", async () => {
    const avant = await prisma.demandeContactRestaurateur.count({ where: { email } });
    const r = await appeler(
      demandes.POST,
      requete([valide("Bonne"), { ...valide("Mauvaise"), email: "pas-un-email" }]),
    );
    expect(r.statut).toBe(400);
    expect(await prisma.demandeContactRestaurateur.count({ where: { email } })).toBe(avant);
  });

  test("refuse une date de création dans le futur", async () => {
    const r = await appeler(
      demandes.POST,
      requete({ ...valide("Futur"), creeLe: "2999-01-01T10:00:00+01:00" }),
    );
    expect(r.statut).toBe(400);
  });

  test("refuse les champs vides et trop longs", async () => {
    expect(
      (await appeler(demandes.POST, requete({ ...valide("Vide"), message: "  " }))).statut,
    ).toBe(400);
    expect(
      (await appeler(demandes.POST, requete({ ...valide("Long"), etablissement: "x".repeat(151) })))
        .statut,
    ).toBe(400);
  });
});

describe("GET /api/admin/demandes", () => {
  test("liste les demandes, la plus récente d'abord", async () => {
    const r = await appeler(demandes.GET, requete());
    expect(r.statut).toBe(200);
    const miennes = r.corps.demandes.filter((d: { email: string }) => d.email === email);
    expect(miennes.length).toBeGreaterThanOrEqual(4);
    const dates = r.corps.demandes.map((d: { createdAt: string }) => d.createdAt);
    expect(dates).toEqual([...dates].sort().reverse());
  });
});

describe("PATCH /api/admin/demandes/[id]", () => {
  const critere = (verdict: string) => ({ verdict, justification: "Vu.", sources: [] });
  const analyse = (verdicts: Record<string, string> = {}) => ({
    criteres: Object.fromEntries(
      ["existence", "localisation", "reputation", "menu", "capacite"].map((c) => [
        c,
        critere(verdicts[c] ?? "OK"),
      ]),
    ),
    brouillonObjet: "Votre demande TheSpoon",
    brouillonCorps: "Bonjour,",
    statut: "ACCEPTEE",
  });

  async function patcher(id: string, corps: unknown) {
    const r = new Request(`http://test/api/admin/demandes/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", authorization: `Bearer ${JETON}` },
      body: JSON.stringify(corps),
    });
    const reponse = await demandeParId.PATCH(r, { params: Promise.resolve({ id }) });
    return { statut: reponse.status, corps: await reponse.json() };
  }

  async function nouvelleDemande(adresse = "7 rue Exemple, 75009 Paris") {
    const r = await appeler(demandes.POST, requete({ ...valide("Patch"), adresse }));
    return r.corps.crees[0].id as string;
  }

  test("une nouvelle demande est à analyser, et le filtre par statut la trouve", async () => {
    const id = await nouvelleDemande();
    const r = await appeler(
      demandes.GET,
      new Request("http://test/api/admin/demandes?statut=A_ANALYSER", {
        headers: { authorization: `Bearer ${JETON}` },
      }),
    );
    expect(r.corps.demandes.some((d: { id: string }) => d.id === id)).toBe(true);
    expect(r.corps.demandes.every((d: { statut: string }) => d.statut === "A_ANALYSER")).toBe(true);
  });

  test("calcule le statut, sans lire celui du corps", async () => {
    const id = await nouvelleDemande();
    expect((await patcher(id, analyse())).corps.demande.statut).toBe("ACCEPTEE");
    expect((await patcher(id, analyse({ menu: "INCONNU" }))).corps.demande.statut).toBe(
      "INFOS_MANQUANTES",
    );
    const r = await patcher(id, analyse({ capacite: "KO" }));
    expect(r.corps.demande.statut).toBe("REFUSEE");
    expect(r.corps.demande.analyseeLe).not.toBeNull();
  });

  test("une adresse hors Paris est refusée même si l'agent dit OK", async () => {
    const id = await nouvelleDemande("12 rue de la Ré, 69002 Lyon");
    expect((await patcher(id, analyse())).corps.demande.statut).toBe("REFUSEE");
  });

  test("404 pour un id inconnu, 400 pour une analyse invalide", async () => {
    expect((await patcher("inconnu", analyse())).statut).toBe(404);
    expect((await patcher(await nouvelleDemande(), { criteres: {} })).statut).toBe(400);
  });
});

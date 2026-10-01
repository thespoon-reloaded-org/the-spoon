import "dotenv/config";

import { randomUUID } from "node:crypto";

import { afterAll, describe, expect, test } from "vitest";

import { envoyerDemandeContactRestaurateur } from "@/app/(site)/devenir-partenaire/actions";
import { prisma } from "@/lib/prisma";

/**
 * Le dépôt d'une demande depuis `/devenir-partenaire`, de bout en bout : la
 * validation de l'action jusqu'à la ligne en base. Nécessite une vraie base
 * Postgres (`DATABASE_URL`), comme le job `build` de la CI.
 */
const prefixe = `demande-${randomUUID().slice(0, 8)}`;

function nouvelEmail() {
  return `${prefixe}-${randomUUID().slice(0, 8)}@test.example`;
}

/** Le formulaire tel que le navigateur l'envoie ; `null` omet le champ. */
async function envoyer(champs: Record<string, string | null>) {
  const formulaire = new FormData();
  for (const [cle, valeur] of Object.entries(champs)) {
    if (valeur !== null) formulaire.set(cle, valeur);
  }
  return envoyerDemandeContactRestaurateur({}, formulaire);
}

function valide(
  surcharge: {
    siren?: string | null;
    urlGoogleMyBusiness?: string | null;
    menusALaCuillere?: string | null;
  } = {},
) {
  return {
    nom: "Jeanne Dupont",
    email: nouvelEmail(),
    etablissement: "Le Petit Plat",
    adresse: "12 rue de la Paix, 75002 Paris",
    siren: "123 456 789",
    urlGoogleMyBusiness: "",
    menusALaCuillere: "oui",
    message: "Nous souhaitons être référencés.",
    ...surcharge,
  };
}

afterAll(async () => {
  await prisma.demandeContactRestaurateur.deleteMany({
    where: { email: { startsWith: prefixe } },
  });
  await prisma.$disconnect();
});

describe("envoyerDemandeContactRestaurateur — les champs d'éligibilité", () => {
  test("enregistre le SIREN sans espaces, l'URL et la réponse menus", async () => {
    const champs = valide({
      urlGoogleMyBusiness: "https://maps.app.goo.gl/abc",
      menusALaCuillere: "oui",
    });
    expect(await envoyer(champs)).toEqual({ ok: true });
    const ligne = await prisma.demandeContactRestaurateur.findFirstOrThrow({
      where: { email: champs.email },
    });
    expect(ligne.siren).toBe("123456789");
    expect(ligne.urlGoogleMyBusiness).toBe("https://maps.app.goo.gl/abc");
    expect(ligne.menusALaCuillere).toBe(true);
  });

  test("une URL vide passe et est stockée null", async () => {
    const champs = valide({ urlGoogleMyBusiness: "" });
    expect(await envoyer(champs)).toEqual({ ok: true });
    const ligne = await prisma.demandeContactRestaurateur.findFirstOrThrow({
      where: { email: champs.email },
    });
    expect(ligne.urlGoogleMyBusiness).toBeNull();
  });

  test("un SIREN à 8 chiffres est refusé et rien n'est écrit", async () => {
    const champs = valide({ siren: "12345678" });
    expect(await envoyer(champs)).toEqual({ erreur: "Le SIREN doit comporter 9 chiffres." });
    expect(
      await prisma.demandeContactRestaurateur.count({ where: { email: champs.email } }),
    ).toBe(0);
  });

  test("sans réponse menus, la demande est refusée et rien n'est écrit", async () => {
    const champs = valide({ menusALaCuillere: null });
    expect(await envoyer(champs)).toEqual({
      erreur: "Indiquez si vous proposez des menus à la cuillère.",
    });
    expect(
      await prisma.demandeContactRestaurateur.count({ where: { email: champs.email } }),
    ).toBe(0);
  });
});

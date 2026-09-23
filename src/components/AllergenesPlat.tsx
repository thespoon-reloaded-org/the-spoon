import { LIBELLE_ALLERGENE, lireDeclaration, type PlatAllergenes } from "@/lib/allergenes";
import { pastilleEtat } from "@/lib/ui";

/**
 * Ce qu'un plat dit de ses allergènes, sous la même forme partout : fiche
 * publique et « Ma carte ». Le restaurateur voit exactement ce que lit le
 * dîneur — c'est ce qui rend « non renseigné » inconfortable côté pro, donc
 * utile.
 *
 * Trois rendus pour trois états, et jamais de silence sur le troisième : un
 * plat non renseigné le dit. Ne rien afficher se lirait comme « rien à
 * signaler », ce qui est précisément l'information qu'on n'a pas.
 */
export function AllergenesPlat({ plat }: { plat: PlatAllergenes }) {
  const declaration = lireDeclaration(plat);

  if (declaration.etat === "non_renseigne") {
    return (
      <p className="text-xs font-medium text-[var(--color-ink-muted)]">
        Allergènes non renseignés — demandez au restaurant.
      </p>
    );
  }

  if (declaration.etat === "aucun") {
    return (
      <p>
        <span className={pastilleEtat("succes")}>Aucun des 14 allergènes majeurs</span>
      </p>
    );
  }

  return (
    <ul className="flex flex-wrap gap-1.5">
      {declaration.allergenes.map((allergene) => (
        <li key={allergene} className={pastilleEtat("attention")}>
          {LIBELLE_ALLERGENE[allergene]}
        </li>
      ))}
    </ul>
  );
}

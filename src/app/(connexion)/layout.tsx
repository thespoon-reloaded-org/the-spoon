import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Connexion",
};

/**
 * Les trois écrans de connexion sont en pleine page : pas de header public
 * au-dessus, c'est le panneau photo de l'univers choisi qui occupe la moitié
 * de l'écran (cf. `EcranConnexion`). D'où ce groupe de routes, qui les sort
 * du cadre de `(site)`.
 */
export default function ConnexionLayout({ children }: { children: React.ReactNode }) {
  return children;
}

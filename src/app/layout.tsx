import type { Metadata } from "next";
import { Bricolage_Grotesque, Plus_Jakarta_Sans } from "next/font/google";

import "./globals.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["500", "700", "800"],
  variable: "--font-display",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: { default: "TheSpoon", template: "%s · TheSpoon" },
  description: "Réservez une table. La note s'affiche en cuillères.",
};

/**
 * Layout racine volontairement minimal : le header public n'y est plus, parce
 * que les trois univers de l'app n'ont pas le même cadre — le site public
 * (`(site)`) a un header et un pied de page, les écrans de connexion
 * (`(connexion)`) sont en pleine page, et les espaces connectés
 * (`/espace-restaurant`, `/admin`) ont un menu latéral. Chacun pose le sien.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${bricolage.variable} ${jakarta.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}

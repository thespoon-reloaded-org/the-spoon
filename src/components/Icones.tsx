/**
 * Jeu d'icônes maison.
 *
 * L'app n'affichait jusqu'ici que des emojis (🥄, 🍽, 🥣) : sympathique sur la
 * vitrine, illisible dans un menu latéral où il faut distinguer six entrées
 * d'un coup d'œil. Des traits plutôt qu'une dépendance : une poignée de
 * chemins SVG suffit, et ça évite d'embarquer une bibliothèque d'icônes pour
 * une douzaine de pictos.
 *
 * Toutes suivent la même grille 24×24, trait de 1.75, `currentColor` — donc
 * elles héritent de la couleur du texte qui les entoure.
 */

type ProprietesIcone = {
  className?: string;
  /** Taille en pixels — 20 par défaut, la taille des entrées de menu. */
  taille?: number;
};

function Svg({
  className,
  taille = 20,
  children,
}: ProprietesIcone & { children: React.ReactNode }) {
  return (
    <svg
      width={taille}
      height={taille}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

export function IconeCalendrier(p: ProprietesIcone) {
  return (
    <Svg {...p}>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </Svg>
  );
}

export function IconeBoutique(p: ProprietesIcone) {
  return (
    <Svg {...p}>
      <path d="M4 10v9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-9" />
      <path d="M3.5 8.5 5 4h14l1.5 4.5a3 3 0 0 1-5.6 1.9 3 3 0 0 1-5.8 0 3 3 0 0 1-5.6-1.9Z" />
      <path d="M10 20v-5h4v5" />
    </Svg>
  );
}

export function IconeHorloge(p: ProprietesIcone) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Svg>
  );
}

export function IconeCarte(p: ProprietesIcone) {
  return (
    <Svg {...p}>
      <path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
      <path d="M8 8h8M8 12h8M8 16h4" />
    </Svg>
  );
}

export function IconeFacture(p: ProprietesIcone) {
  return (
    <Svg {...p}>
      <path d="M5 3.5 7 5l2-1.5L11 5l2-1.5L15 5l2-1.5v15.8a2.2 2.2 0 0 1-2.2 2.2H7.2A2.2 2.2 0 0 1 5 19.3Z" />
      <path d="M9 9h6M9 13h6M9 17h3" />
    </Svg>
  );
}

export function IconeTableauBord(p: ProprietesIcone) {
  return (
    <Svg {...p}>
      <rect x="3" y="3" width="7.5" height="8.5" rx="2" />
      <rect x="13.5" y="3" width="7.5" height="5.5" rx="2" />
      <rect x="3" y="14.5" width="7.5" height="6.5" rx="2" />
      <rect x="13.5" y="11.5" width="7.5" height="9.5" rx="2" />
    </Svg>
  );
}

export function IconeRestaurants(p: ProprietesIcone) {
  return (
    <Svg {...p}>
      <path d="M4 21V6l7-3 7 3v15" />
      <path d="M2 21h20" />
      <path d="M9 21v-5h4v5" />
      <path d="M9 10h.01M13.5 10h.01" />
    </Svg>
  );
}

export function IconeDeconnexion(p: ProprietesIcone) {
  return (
    <Svg {...p}>
      <path d="M14 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 8 6 12l4 4M6 12h9" />
    </Svg>
  );
}

export function IconeRecherche(p: ProprietesIcone) {
  return (
    <Svg {...p}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-3.6-3.6" />
    </Svg>
  );
}

export function IconeLieu(p: ProprietesIcone) {
  return (
    <Svg {...p}>
      <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </Svg>
  );
}

export function IconeFleche(p: ProprietesIcone) {
  return (
    <Svg {...p}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Svg>
  );
}

export function IconeChevron(p: ProprietesIcone) {
  return (
    <Svg {...p}>
      <path d="m9 6 6 6-6 6" />
    </Svg>
  );
}

export function IconeMenu(p: ProprietesIcone) {
  return (
    <Svg {...p}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Svg>
  );
}

export function IconeCroix(p: ProprietesIcone) {
  return (
    <Svg {...p}>
      <path d="m6 6 12 12M18 6 6 18" />
    </Svg>
  );
}

export function IconeCouverts(p: ProprietesIcone) {
  return (
    <Svg {...p}>
      <path d="M6 3v7a2.5 2.5 0 0 0 5 0V3M8.5 12.5V21" />
      <path d="M17.5 3c-1.4 1-2 2.6-2 4.5 0 1.6.7 2.6 2 3V21" />
    </Svg>
  );
}

export function IconeCuillere(p: ProprietesIcone) {
  return (
    <Svg {...p}>
      <path d="M12 3c2.2 0 4 1.9 4 4.2S14.2 11.5 12 11.5 8 9.6 8 7.2 9.8 3 12 3Z" />
      <path d="M12 11.5V21" />
    </Svg>
  );
}

export function IconeEtincelle(p: ProprietesIcone) {
  return (
    <Svg {...p}>
      <path d="M12 3.5 13.9 9l5.6 1.9-5.6 1.9L12 18.5l-1.9-5.7L4.5 10.9 10.1 9Z" />
    </Svg>
  );
}

export function IconeUtilisateur(p: ProprietesIcone) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="8.5" r="3.75" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </Svg>
  );
}

export function IconeLitige(p: ProprietesIcone) {
  return (
    <Svg {...p}>
      <path d="M12 3 5 6v6c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6l-7-3Z" />
      <path d="M12 8.5v4M12 16h.01" />
    </Svg>
  );
}

export function IconeReglages(p: ProprietesIcone) {
  return (
    <Svg {...p}>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2.2" />
      <circle cx="10" cy="17" r="2.2" />
    </Svg>
  );
}

export function IconeValide(p: ProprietesIcone) {
  return (
    <Svg {...p}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Svg>
  );
}

export function IconeMessage(p: ProprietesIcone) {
  return (
    <Svg {...p}>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m4 7 7.3 5.2a1.2 1.2 0 0 0 1.4 0L20 7" />
    </Svg>
  );
}

/**
 * Registre des icônes utilisables par nom.
 *
 * La barre latérale est un composant client alimenté par des layouts côté
 * serveur : une référence de composant ne traverse pas cette frontière, une
 * chaîne si. Les menus déclarent donc `icone: "calendrier"` plutôt que
 * `Icone: IconeCalendrier`.
 */
export const ICONES = {
  calendrier: IconeCalendrier,
  boutique: IconeBoutique,
  horloge: IconeHorloge,
  carte: IconeCarte,
  facture: IconeFacture,
  tableauBord: IconeTableauBord,
  restaurants: IconeRestaurants,
  couverts: IconeCouverts,
  cuillere: IconeCuillere,
  utilisateur: IconeUtilisateur,
  litige: IconeLitige,
  reglages: IconeReglages,
  message: IconeMessage,
} as const;

export type CleIcone = keyof typeof ICONES;

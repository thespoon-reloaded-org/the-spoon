/**
 * Matière première du jeu de formation : établissements, cartes, équipe,
 * prénoms et noms. Tout est inventé — noms d'établissements composés pour ne
 * désigner aucun restaurant existant, emails sur des domaines réservés
 * (`.example`, `example.com`, RFC 2606) qui ne reçoivent jamais rien. Les rues,
 * elles, existent : un restaurant parisien a une adresse parisienne.
 */

export type Categorie = "ENTREE" | "PLAT" | "DESSERT";
export type Allergene =
  | "GLUTEN"
  | "CRUSTACES"
  | "OEUFS"
  | "POISSONS"
  | "ARACHIDES"
  | "SOJA"
  | "LAIT"
  | "FRUITS_A_COQUE"
  | "CELERI"
  | "MOUTARDE"
  | "SESAME"
  | "SULFITES"
  | "LUPIN"
  | "MOLLUSQUES";

export type Plat = {
  nom: string;
  description: string;
  categorie: Categorie;
  /** Prix en euros, arrondi au demi-euro à la génération. */
  prix: number;
  allergenes: Allergene[];
};

export type Cuisine = {
  descriptions: string[];
  plats: Plat[];
};

const p = (
  categorie: Categorie,
  nom: string,
  description: string,
  prix: number,
  ...allergenes: Allergene[]
): Plat => ({ nom, description, categorie, prix, allergenes });

export const CUISINES: Record<string, Cuisine> = {
  Bistrot: {
    descriptions: [
      "Ardoise du marché qui change chaque semaine, zinc d'origine.",
      "Cuisine de bistrot généreuse, vins nature au verre.",
      "Le bistrot de quartier, plats canailles et desserts de grand-mère.",
    ],
    plats: [
      p(
        "ENTREE",
        "Œuf mayonnaise",
        "Œufs bio, mayonnaise maison à la moutarde.",
        7,
        "OEUFS",
        "MOUTARDE",
      ),
      p(
        "ENTREE",
        "Poireaux vinaigrette",
        "Noisettes torréfiées, échalote.",
        8,
        "MOUTARDE",
        "FRUITS_A_COQUE",
      ),
      p("ENTREE", "Terrine de campagne", "Cornichons, pain de campagne grillé.", 9, "GLUTEN"),
      p(
        "PLAT",
        "Bœuf bourguignon",
        "Mijoté sept heures, purée à l'ancienne.",
        22,
        "SULFITES",
        "LAIT",
        "CELERI",
      ),
      p("PLAT", "Blanquette de veau", "Riz pilaf, champignons de Paris.", 23, "LAIT", "CELERI"),
      p("PLAT", "Pavé de cabillaud", "Beurre blanc, poireaux fondants.", 24, "POISSONS", "LAIT"),
      p("PLAT", "Tartare au couteau", "Frites maison, salade.", 21, "OEUFS", "MOUTARDE"),
      p("DESSERT", "Mousse au chocolat", "Chocolat noir 70 %, fleur de sel.", 8, "OEUFS", "LAIT"),
      p("DESSERT", "Île flottante", "Crème anglaise vanille, caramel.", 8, "OEUFS", "LAIT"),
      p("DESSERT", "Riz au lait", "Caramel au beurre salé.", 7, "LAIT"),
    ],
  },
  Brasserie: {
    descriptions: [
      "Grande brasserie, service continu et banquettes de velours.",
      "Brasserie parisienne, fruits de mer et plats de tradition.",
    ],
    plats: [
      p("ENTREE", "Soupe à l'oignon", "Gratinée au comté.", 10, "GLUTEN", "LAIT"),
      p("ENTREE", "Six huîtres", "Fines de claire n° 3, vinaigre à l'échalote.", 16, "MOLLUSQUES"),
      p("PLAT", "Choucroute garnie", "Saucisses, lard, pommes vapeur.", 24, "MOUTARDE", "SULFITES"),
      p("PLAT", "Sole meunière", "Pommes vapeur, citron.", 36, "POISSONS", "LAIT"),
      p("PLAT", "Entrecôte frites", "Sauce béarnaise.", 29, "OEUFS", "LAIT"),
      p("DESSERT", "Profiteroles", "Sauce chocolat chaud.", 10, "GLUTEN", "OEUFS", "LAIT"),
      p("DESSERT", "Baba au rhum", "Chantilly maison.", 10, "GLUTEN", "OEUFS", "LAIT"),
    ],
  },
  Italien: {
    descriptions: [
      "Pâtes fraîches tirées chaque matin, carte de vins italiens.",
      "Cuisine de la botte, pizzas au levain et antipasti à partager.",
      "Trattoria familiale, recettes des Pouilles.",
    ],
    plats: [
      p("ENTREE", "Burrata", "Tomates anciennes, basilic, huile d'olive.", 13, "LAIT"),
      p("ENTREE", "Vitello tonnato", "Veau rosé, sauce au thon, câpres.", 12, "POISSONS", "OEUFS"),
      p("PLAT", "Risotto aux cèpes", "Carnaroli, parmesan 24 mois.", 22, "LAIT", "CELERI"),
      p("PLAT", "Tagliatelle al ragù", "Ragù de bœuf mijoté.", 18, "GLUTEN", "OEUFS", "CELERI"),
      p(
        "PLAT",
        "Pizza margherita",
        "Levain naturel, mozzarella fior di latte.",
        14,
        "GLUTEN",
        "LAIT",
      ),
      p("PLAT", "Linguine alle vongole", "Palourdes, ail, persil.", 21, "GLUTEN", "MOLLUSQUES"),
      p("DESSERT", "Tiramisu", "Mascarpone, café serré.", 8, "GLUTEN", "OEUFS", "LAIT"),
      p("DESSERT", "Panna cotta", "Coulis de fruits rouges.", 7, "LAIT"),
    ],
  },
  Japonais: {
    descriptions: [
      "Comptoir de ramen, bouillon mijoté dix-huit heures.",
      "Izakaya : petites assiettes, saké et bière pression.",
    ],
    plats: [
      p("ENTREE", "Gyoza", "Porc et chou, sauce ponzu.", 8, "GLUTEN", "SOJA", "SESAME"),
      p("ENTREE", "Edamame", "Fleur de sel.", 5, "SOJA"),
      p(
        "PLAT",
        "Ramen tonkotsu",
        "Bouillon de porc, œuf mollet mariné.",
        15,
        "GLUTEN",
        "OEUFS",
        "SOJA",
        "SESAME",
      ),
      p(
        "PLAT",
        "Chirashi saumon",
        "Riz vinaigré, saumon, avocat.",
        19,
        "POISSONS",
        "SOJA",
        "SESAME",
      ),
      p(
        "PLAT",
        "Donburi poulet karaage",
        "Poulet frit, mayonnaise yuzu.",
        16,
        "GLUTEN",
        "OEUFS",
        "SOJA",
      ),
      p("DESSERT", "Mochi glacé", "Thé matcha, sésame noir.", 7, "LAIT", "SESAME"),
    ],
  },
  Libanais: {
    descriptions: [
      "Mezzés à partager, grande tablée pour les groupes.",
      "Cuisine du Levant, grillades au feu de bois.",
    ],
    plats: [
      p("ENTREE", "Houmous", "Pois chiches, tahiné, huile d'olive.", 7, "SESAME"),
      p("ENTREE", "Taboulé libanais", "Persil plat, boulgour, citron.", 8, "GLUTEN"),
      p("ENTREE", "Falafels", "Sauce tarator.", 8, "SESAME", "GLUTEN"),
      p("PLAT", "Chich taouk", "Brochettes de poulet, toum, frites.", 18, "LAIT"),
      p("PLAT", "Kafta grillée", "Agneau, oignons, riz aux vermicelles.", 19, "GLUTEN"),
      p("DESSERT", "Baklava", "Pistaches, fleur d'oranger.", 6, "GLUTEN", "FRUITS_A_COQUE", "LAIT"),
    ],
  },
  Végétal: {
    descriptions: [
      "Cuisine végétale de saison, tout est fait maison.",
      "Assiettes végétales colorées, jus pressés minute.",
    ],
    plats: [
      p("ENTREE", "Velouté de potimarron", "Noisettes torréfiées.", 9, "FRUITS_A_COQUE"),
      p("ENTREE", "Tartine de betteraves", "Labneh végétal, aneth.", 9, "GLUTEN", "SOJA"),
      p(
        "PLAT",
        "Bourguignon de seitan",
        "Champignons, vin rouge, purée.",
        18,
        "GLUTEN",
        "SULFITES",
        "CELERI",
      ),
      p("PLAT", "Curry de lentilles corail", "Lait de coco, riz basmati.", 16),
      p("PLAT", "Bowl du marché", "Quinoa, légumes rôtis, tahiné.", 15, "SESAME"),
      p("DESSERT", "Crumble pommes-poires", "Amandes, cannelle.", 7, "GLUTEN", "FRUITS_A_COQUE"),
    ],
  },
  Coréen: {
    descriptions: [
      "Barbecue coréen à table, banchan maison.",
      "Cuisine de Séoul, kimchi fermenté sur place.",
    ],
    plats: [
      p("ENTREE", "Pajeon", "Galette aux oignons verts.", 9, "GLUTEN", "OEUFS", "SOJA"),
      p("PLAT", "Bibimbap", "Riz, légumes, bœuf, œuf, gochujang.", 17, "OEUFS", "SOJA", "SESAME"),
      p("PLAT", "Bulgogi", "Bœuf mariné grillé.", 21, "SOJA", "SESAME"),
      p("PLAT", "Tteokbokki", "Galettes de riz, sauce pimentée.", 14, "SOJA", "GLUTEN"),
      p(
        "DESSERT",
        "Hotteok",
        "Crêpe fourrée cassonade et cannelle.",
        6,
        "GLUTEN",
        "FRUITS_A_COQUE",
      ),
    ],
  },
  Indien: {
    descriptions: [
      "Cuisine du Pendjab, four tandoor.",
      "Currys du sud de l'Inde, dosas croustillants.",
    ],
    plats: [
      p("ENTREE", "Samosas", "Pommes de terre, petits pois, chutney.", 7, "GLUTEN"),
      p("PLAT", "Butter chicken", "Riz basmati, naan.", 18, "LAIT", "GLUTEN", "FRUITS_A_COQUE"),
      p("PLAT", "Dal makhani", "Lentilles noires mijotées.", 15, "LAIT"),
      p("PLAT", "Masala dosa", "Crêpe de riz, pommes de terre épicées.", 14, "MOUTARDE"),
      p("DESSERT", "Kulfi", "Glace pistache cardamome.", 6, "LAIT", "FRUITS_A_COQUE"),
    ],
  },
  Grec: {
    descriptions: ["Taverne grecque, poissons grillés et mezzés."],
    plats: [
      p("ENTREE", "Tzatziki", "Yaourt, concombre, aneth.", 7, "LAIT"),
      p("ENTREE", "Tarama maison", "Œufs de cabillaud fumés.", 8, "POISSONS", "GLUTEN"),
      p("PLAT", "Moussaka", "Aubergines, agneau, béchamel.", 19, "LAIT", "GLUTEN", "OEUFS"),
      p("PLAT", "Souvlaki de porc", "Pita, frites, tzatziki.", 17, "GLUTEN", "LAIT"),
      p("DESSERT", "Yaourt au miel", "Noix, miel de thym.", 6, "LAIT", "FRUITS_A_COQUE"),
    ],
  },
  Mexicain: {
    descriptions: ["Tacos au maïs nixtamalisé, mezcal à la carte."],
    plats: [
      p("ENTREE", "Guacamole", "Totopos maison.", 8),
      p("PLAT", "Tacos al pastor", "Porc mariné, ananas, coriandre.", 15),
      p("PLAT", "Enchiladas de poulet", "Sauce verte, crème, fromage.", 17, "LAIT", "GLUTEN"),
      p("PLAT", "Ceviche", "Daurade, citron vert, piment.", 16, "POISSONS"),
      p("DESSERT", "Churros", "Chocolat chaud épais.", 7, "GLUTEN", "LAIT", "OEUFS"),
    ],
  },
  Thaï: {
    descriptions: ["Street food de Bangkok, wok à la flamme."],
    plats: [
      p(
        "ENTREE",
        "Rouleaux de printemps",
        "Crevettes, menthe, sauce cacahuète.",
        8,
        "CRUSTACES",
        "ARACHIDES",
      ),
      p(
        "PLAT",
        "Pad thaï",
        "Nouilles de riz, crevettes, cacahuètes.",
        16,
        "CRUSTACES",
        "ARACHIDES",
        "OEUFS",
        "SOJA",
      ),
      p("PLAT", "Curry vert au poulet", "Lait de coco, basilic thaï.", 16, "POISSONS"),
      p("PLAT", "Tom yum", "Soupe épicée aux crevettes.", 14, "CRUSTACES", "POISSONS"),
      p("DESSERT", "Riz gluant à la mangue", "Lait de coco.", 7),
    ],
  },
  Vietnamien: {
    descriptions: ["Cantine vietnamienne, phở mijoté toute la nuit."],
    plats: [
      p("ENTREE", "Nems", "Porc, champignons noirs, salade.", 8, "GLUTEN", "POISSONS"),
      p("PLAT", "Phở bò", "Bouillon de bœuf, herbes fraîches.", 15, "SOJA"),
      p(
        "PLAT",
        "Bò bún",
        "Vermicelles, bœuf citronnelle, cacahuètes.",
        15,
        "ARACHIDES",
        "POISSONS",
        "SOJA",
      ),
      p("PLAT", "Bánh mì", "Porc laqué, pickles, coriandre.", 11, "GLUTEN", "OEUFS", "SOJA"),
      p("DESSERT", "Chè ba màu", "Haricots, gelée, lait de coco.", 6),
    ],
  },
  Marocain: {
    descriptions: ["Tajines et couscous du vendredi, thé à la menthe offert."],
    plats: [
      p("ENTREE", "Briouates", "Viande hachée, épices douces.", 8, "GLUTEN"),
      p("PLAT", "Couscous royal", "Merguez, poulet, agneau, légumes.", 22, "GLUTEN", "CELERI"),
      p("PLAT", "Tajine d'agneau", "Pruneaux, amandes.", 21, "FRUITS_A_COQUE"),
      p(
        "PLAT",
        "Pastilla au poulet",
        "Amandes, cannelle.",
        18,
        "GLUTEN",
        "FRUITS_A_COQUE",
        "OEUFS",
      ),
      p(
        "DESSERT",
        "Cornes de gazelle",
        "Pâte d'amande, fleur d'oranger.",
        6,
        "GLUTEN",
        "FRUITS_A_COQUE",
      ),
    ],
  },
  Gastronomique: {
    descriptions: [
      "Menu dégustation en six temps, produits de petits producteurs.",
      "Table d'auteur, accords mets et vins.",
    ],
    plats: [
      p(
        "ENTREE",
        "Langoustine rôtie",
        "Bisque montée au beurre.",
        28,
        "CRUSTACES",
        "LAIT",
        "CELERI",
      ),
      p(
        "ENTREE",
        "Foie gras mi-cuit",
        "Chutney de figues, brioche.",
        26,
        "GLUTEN",
        "OEUFS",
        "LAIT",
      ),
      p("PLAT", "Pigeon en deux cuissons", "Jus corsé, betterave.", 44, "SULFITES"),
      p("PLAT", "Turbot sauvage", "Beurre noisette, câpres.", 48, "POISSONS", "LAIT"),
      p("DESSERT", "Soufflé au Grand Marnier", "Glace vanille.", 16, "OEUFS", "LAIT", "GLUTEN"),
      p("DESSERT", "Chocolat grand cru", "Praliné, sorbet cacao.", 16, "LAIT", "FRUITS_A_COQUE"),
    ],
  },
  "Fruits de mer": {
    descriptions: ["Arrivages de la criée du matin, plateaux à partager."],
    plats: [
      p("ENTREE", "Bulots mayonnaise", "Mayonnaise maison.", 12, "MOLLUSQUES", "OEUFS", "MOUTARDE"),
      p("ENTREE", "Tartare de daurade", "Agrumes, huile d'olive.", 15, "POISSONS"),
      p(
        "PLAT",
        "Bouillabaisse",
        "Rouille, croûtons, service en deux temps.",
        34,
        "POISSONS",
        "CRUSTACES",
        "GLUTEN",
        "OEUFS",
      ),
      p("PLAT", "Moules marinières", "Frites maison.", 18, "MOLLUSQUES", "SULFITES", "CELERI"),
      p("DESSERT", "Tarte au citron", "Meringue légère.", 9, "GLUTEN", "OEUFS", "LAIT"),
    ],
  },
  "Bouchon lyonnais": {
    descriptions: ["Nappes à carreaux, quenelles et pots de côtes-du-rhône."],
    plats: [
      p(
        "ENTREE",
        "Salade lyonnaise",
        "Lardons, œuf poché, croûtons.",
        10,
        "OEUFS",
        "GLUTEN",
        "MOUTARDE",
      ),
      p(
        "PLAT",
        "Quenelle de brochet",
        "Sauce Nantua.",
        21,
        "POISSONS",
        "CRUSTACES",
        "GLUTEN",
        "OEUFS",
        "LAIT",
      ),
      p("PLAT", "Andouillette", "Sauce moutarde, gratin.", 20, "MOUTARDE", "LAIT"),
      p(
        "DESSERT",
        "Tarte aux pralines",
        "Pralines roses.",
        8,
        "GLUTEN",
        "FRUITS_A_COQUE",
        "LAIT",
        "OEUFS",
      ),
    ],
  },
  Crêperie: {
    descriptions: ["Galettes de sarasin bio, cidre fermier."],
    plats: [
      p("PLAT", "Complète", "Jambon, œuf, emmental.", 12, "OEUFS", "LAIT"),
      p("PLAT", "Forestière", "Champignons, crème, lardons.", 14, "LAIT"),
      p("PLAT", "Galette saumon", "Saumon fumé, crème citronnée.", 15, "POISSONS", "LAIT"),
      p("DESSERT", "Crêpe caramel beurre salé", "Caramel maison.", 7, "GLUTEN", "LAIT", "OEUFS"),
    ],
  },
  Péruvien: {
    descriptions: ["Cuisine nikkei, ceviches et pisco sour."],
    plats: [
      p("ENTREE", "Ceviche clásico", "Bar, leche de tigre.", 16, "POISSONS"),
      p("PLAT", "Lomo saltado", "Bœuf sauté, frites, riz.", 22, "SOJA"),
      p(
        "PLAT",
        "Ají de gallina",
        "Poulet, crème de piment jaune.",
        18,
        "LAIT",
        "FRUITS_A_COQUE",
        "GLUTEN",
      ),
      p(
        "DESSERT",
        "Suspiro limeño",
        "Crème de lait, meringue au porto.",
        8,
        "LAIT",
        "OEUFS",
        "SULFITES",
      ),
    ],
  },
  Basque: {
    descriptions: ["Pintxos au comptoir, piment d'Espelette et cidre."],
    plats: [
      p("ENTREE", "Pintxos du jour", "Selon l'arrivage.", 9, "GLUTEN"),
      p("PLAT", "Axoa de veau", "Piment d'Espelette, pommes grenaille.", 20),
      p("PLAT", "Chipirons à la plancha", "Persillade.", 19, "MOLLUSQUES"),
      p("DESSERT", "Gâteau basque", "Crème pâtissière.", 7, "GLUTEN", "OEUFS", "LAIT"),
    ],
  },
};

export type FicheRestaurant = {
  nom: string;
  ville: string;
  cuisine: keyof typeof CUISINES;
  adresse: string;
  capacite: number;
};

const paris = (
  nom: string,
  cuisine: keyof typeof CUISINES,
  adresse: string,
  capacite: number,
): FicheRestaurant => ({
  nom,
  ville: "Paris",
  cuisine,
  adresse,
  capacite,
});

/** 50 établissements : 40 à Paris, les autres dans les grandes villes. */
export const RESTAURANTS: FicheRestaurant[] = [
  paris("Le Zinc des Batignolles", "Bistrot", "14 rue des Dames, 75017 Paris", 38),
  paris("La Table de Léonie", "Bistrot", "27 rue de la Folie-Méricourt, 75011 Paris", 32),
  paris("Au Comptoir Sainte-Marthe", "Bistrot", "8 rue Sainte-Marthe, 75010 Paris", 28),
  paris("Chez Margaux et Fils", "Bistrot", "41 rue de Charonne, 75011 Paris", 44),
  paris("Le Petit Cadran", "Bistrot", "3 rue Mouffetard, 75005 Paris", 26),
  paris("L'Ardoise de Montorgueil", "Bistrot", "52 rue Montorgueil, 75002 Paris", 40),
  paris("Bistrot Paulette", "Bistrot", "19 rue des Martyrs, 75009 Paris", 34),
  paris("Brasserie du Grand Cerf", "Brasserie", "112 boulevard du Montparnasse, 75014 Paris", 110),
  paris("La Coupole Verte", "Brasserie", "6 place de la Nation, 75012 Paris", 90),
  paris("Brasserie Octave", "Brasserie", "88 rue de Rivoli, 75004 Paris", 85),
  paris("Trattoria Giulietta", "Italien", "24 rue Oberkampf, 75011 Paris", 42),
  paris("Osteria del Portico", "Italien", "11 rue du Faubourg-Poissonnière, 75009 Paris", 36),
  paris("Mamma Nerina", "Italien", "63 rue de la Roquette, 75011 Paris", 48),
  paris("Pizzeria Il Forno Rosso", "Italien", "7 rue de Lévis, 75017 Paris", 30),
  paris("Ramen Kaizen", "Japonais", "35 rue Sainte-Anne, 75001 Paris", 22),
  paris("Izakaya Hotaru", "Japonais", "18 rue Saint-Maur, 75011 Paris", 28),
  paris("Cèdre et Jasmin", "Libanais", "9 rue de Turenne, 75003 Paris", 40),
  paris("Maison Byblos", "Libanais", "46 rue du Commerce, 75015 Paris", 50),
  paris("Racine Carrée", "Végétal", "30 rue du Faubourg-Saint-Denis, 75010 Paris", 30),
  paris("Le Potager d'Alma", "Végétal", "12 rue des Vinaigriers, 75010 Paris", 24),
  paris("Séoul Grill Belleville", "Coréen", "71 rue de Belleville, 75019 Paris", 46),
  paris("Maison Gochu", "Coréen", "22 rue Sainte-Anne, 75002 Paris", 26),
  paris("Tandoor Sentier", "Indien", "15 rue du Nil, 75002 Paris", 38),
  paris("Jardin de Kerala", "Indien", "54 rue du Faubourg-Saint-Denis, 75010 Paris", 34),
  paris("Taverna Kyma", "Grec", "20 rue Mouffetard, 75005 Paris", 36),
  paris("Cantina Azul", "Mexicain", "29 rue de la Fontaine-au-Roi, 75011 Paris", 32),
  paris("Baan Siam Canal", "Thaï", "5 quai de Valmy, 75010 Paris", 40),
  paris("Phở Lotus d'Or", "Vietnamien", "101 avenue d'Ivry, 75013 Paris", 60),
  paris("Cantine Hanoï Rive Gauche", "Vietnamien", "17 rue Monge, 75005 Paris", 34),
  paris("Dar Yasmina", "Marocain", "38 rue de Ménilmontant, 75020 Paris", 52),
  paris("Maison Célestin", "Gastronomique", "4 rue du Cherche-Midi, 75006 Paris", 24),
  paris("L'Atelier d'Aurèle", "Gastronomique", "16 rue de Bellechasse, 75007 Paris", 20),
  paris("La Marée de Rungis", "Fruits de mer", "58 rue de Lévis, 75017 Paris", 44),
  paris("Ker Bihan", "Crêperie", "13 rue du Montparnasse, 75006 Paris", 36),
  paris("Crêperie des Abbesses", "Crêperie", "25 rue des Abbesses, 75018 Paris", 30),
  paris("Qosqo Cantina", "Péruvien", "42 rue de Paradis, 75010 Paris", 32),
  paris("Txoko Bastille", "Basque", "10 rue de Lappe, 75011 Paris", 38),
  paris("Le Bouillon Mazagran", "Brasserie", "9 rue Mazagran, 75010 Paris", 120),
  paris(
    "Trattoria Butte-aux-Cailles",
    "Italien",
    "31 rue de la Butte-aux-Cailles, 75013 Paris",
    34,
  ),
  paris("Le Café des Deux Écluses", "Bistrot", "60 quai de Jemmapes, 75010 Paris", 46),
  {
    nom: "Le Bouchon des Canuts",
    ville: "Lyon",
    cuisine: "Bouchon lyonnais",
    adresse: "8 rue Saint-Jean, 69005 Lyon",
    capacite: 40,
  },
  {
    nom: "La Quenelle d'Or",
    ville: "Lyon",
    cuisine: "Bouchon lyonnais",
    adresse: "21 rue Mercière, 69002 Lyon",
    capacite: 36,
  },
  {
    nom: "Osteria Fourvière",
    ville: "Lyon",
    cuisine: "Italien",
    adresse: "3 place Sathonay, 69001 Lyon",
    capacite: 32,
  },
  {
    nom: "Le Comptoir des Chartrons",
    ville: "Bordeaux",
    cuisine: "Bistrot",
    adresse: "45 rue Notre-Dame, 33000 Bordeaux",
    capacite: 38,
  },
  {
    nom: "Txakoli Saint-Michel",
    ville: "Bordeaux",
    cuisine: "Basque",
    adresse: "12 place Canteloup, 33800 Bordeaux",
    capacite: 42,
  },
  {
    nom: "La Criée du Panier",
    ville: "Marseille",
    cuisine: "Fruits de mer",
    adresse: "5 rue du Panier, 13002 Marseille",
    capacite: 48,
  },
  {
    nom: "Taverna Vieux-Port",
    ville: "Marseille",
    cuisine: "Grec",
    adresse: "18 quai de Rive-Neuve, 13007 Marseille",
    capacite: 44,
  },
  {
    nom: "L'Estaminet du Beffroi",
    ville: "Lille",
    cuisine: "Brasserie",
    adresse: "27 rue de la Monnaie, 59800 Lille",
    capacite: 56,
  },
  {
    nom: "Cèdre de Wazemmes",
    ville: "Lille",
    cuisine: "Libanais",
    adresse: "9 place de la Nouvelle-Aventure, 59000 Lille",
    capacite: 34,
  },
  {
    nom: "La Galette de l'Erdre",
    ville: "Nantes",
    cuisine: "Crêperie",
    adresse: "14 rue Kervégan, 44000 Nantes",
    capacite: 30,
  },
];

/** L'équipe TheSpoon qui a instruit les litiges de l'historique. */
export const STAFF = [
  {
    nom: "Sophie Laurent",
    email: "sophie.laurent@thespoon.example",
    role: "Partenaires — litiges",
  },
  { nom: "Karim Benali", email: "karim.benali@thespoon.example", role: "Partenaires — litiges" },
  { nom: "Julie Moreau", email: "julie.moreau@thespoon.example", role: "Support restaurants" },
  {
    nom: "Thomas Nguyen",
    email: "thomas.nguyen@thespoon.example",
    role: "Responsable partenaires",
  },
  { nom: "Claire Dubois", email: "claire.dubois@thespoon.example", role: "Facturation" },
] as const;

export const PRENOMS = [
  "Camille",
  "Léa",
  "Manon",
  "Chloé",
  "Emma",
  "Inès",
  "Sarah",
  "Julie",
  "Lucie",
  "Clara",
  "Pauline",
  "Marie",
  "Alice",
  "Anaïs",
  "Juliette",
  "Charlotte",
  "Élise",
  "Margaux",
  "Zoé",
  "Nina",
  "Yasmine",
  "Fatou",
  "Aïcha",
  "Mei",
  "Sofia",
  "Laura",
  "Mathilde",
  "Hélène",
  "Céline",
  "Aurélie",
  "Thomas",
  "Nicolas",
  "Julien",
  "Maxime",
  "Antoine",
  "Hugo",
  "Lucas",
  "Louis",
  "Paul",
  "Arthur",
  "Alexandre",
  "Romain",
  "Kevin",
  "Mehdi",
  "Karim",
  "Youssef",
  "Samuel",
  "Adrien",
  "Baptiste",
  "Victor",
  "Théo",
  "Mathieu",
  "Guillaume",
  "Olivier",
  "Stéphane",
  "Pierre",
  "Jean",
  "David",
  "Omar",
  "Minh",
];

export const NOMS = [
  "Martin",
  "Bernard",
  "Dubois",
  "Thomas",
  "Robert",
  "Richard",
  "Petit",
  "Durand",
  "Leroy",
  "Moreau",
  "Simon",
  "Laurent",
  "Lefebvre",
  "Michel",
  "Garcia",
  "David",
  "Bertrand",
  "Roux",
  "Vincent",
  "Fournier",
  "Morel",
  "Girard",
  "André",
  "Lefèvre",
  "Mercier",
  "Dupont",
  "Lambert",
  "Bonnet",
  "François",
  "Martinez",
  "Legrand",
  "Garnier",
  "Faure",
  "Rousseau",
  "Blanc",
  "Guérin",
  "Muller",
  "Henry",
  "Roussel",
  "Nicolas",
  "Perrin",
  "Morin",
  "Mathieu",
  "Clément",
  "Gauthier",
  "Dumont",
  "Lopez",
  "Fontaine",
  "Chevalier",
  "Robin",
  "Benali",
  "Haddad",
  "Nguyen",
  "Tran",
  "Diallo",
  "Traoré",
  "Cohen",
  "Da Silva",
  "Ferreira",
  "Kaya",
];

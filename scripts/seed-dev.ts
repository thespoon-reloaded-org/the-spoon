import "dotenv/config";

import { prisma } from "../src/lib/prisma";

/** Une poignée de vrais restaurants, pour avoir quelque chose à chercher en dev. */
const restaurants = [
  {
    nom: "Chez Antoine",
    ville: "Lyon",
    cuisine: "Bouchon lyonnais",
    adresse: "12 rue Mercière, 69002 Lyon",
    description: "Quenelles et gratin dauphinois, service en salle depuis 1987.",
    capacite: 40,
    noteCuilleres: 4.3,
    nombreAvis: 128,
    plats: [{ nom: "Gratin dauphinois", description: "Crémeux, cuit trois heures." }],
  },
  {
    nom: "Miso Bar",
    ville: "Lyon",
    cuisine: "Japonais",
    adresse: "5 quai Saint-Vincent, 69001 Lyon",
    description: "Comptoir de 12 places, ramen maison et izakaya le soir.",
    capacite: 24,
    noteCuilleres: 4.7,
    nombreAvis: 64,
    plats: [{ nom: "Ramen tonkotsu", description: "Bouillon os de porc 18h, œuf mollet." }],
  },
  {
    nom: "Le Petit Marché",
    ville: "Paris",
    cuisine: "Bistrot",
    adresse: "9 rue de Bretagne, 75003 Paris",
    description: null,
    capacite: 30,
    noteCuilleres: null,
    nombreAvis: 0,
    plats: [{ nom: "Pot-au-feu", description: null }],
  },
  {
    nom: "Trattoria Bellini",
    ville: "Paris",
    cuisine: "Italien",
    adresse: "18 rue Oberkampf, 75011 Paris",
    description: "Pâtes fraîches faites sur place, carte de vins italiens.",
    capacite: 45,
    noteCuilleres: 4.8,
    nombreAvis: 212,
    plats: [{ nom: "Risotto aux cèpes", description: "Riz carnaroli, cèpes séchés, parmesan 24 mois." }],
  },
  {
    nom: "Racines Vertes",
    ville: "Paris",
    cuisine: "Végé",
    adresse: "22 rue du Faubourg Saint-Denis, 75010 Paris",
    description: "Cuisine végétale de saison, tout est fait maison.",
    capacite: 28,
    noteCuilleres: 4.6,
    nombreAvis: 97,
    plats: [{ nom: "Velouté de potimarron", description: "Noisettes torréfiées, huile de courge." }],
  },
  {
    nom: "Beyrouth Café",
    ville: "Paris",
    cuisine: "Libanais",
    adresse: "7 rue de Turenne, 75003 Paris",
    description: "Mezzés à partager, grande table pour les groupes.",
    capacite: 36,
    noteCuilleres: 4.5,
    nombreAvis: 73,
    plats: [{ nom: "Chorba libanaise", description: "Soupe de lentilles corail, citron confit." }],
  },
];

async function run() {
  await prisma.platCuillere.deleteMany();
  await prisma.restaurant.deleteMany();

  for (const { plats, ...restaurant } of restaurants) {
    await prisma.restaurant.create({
      data: { ...restaurant, platsCuillere: { create: plats } },
    });
  }
  console.log(`${restaurants.length} restaurants créés, avec leur plat à la cuillère.`);
}

run()
  .catch((erreur) => {
    console.error(erreur);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

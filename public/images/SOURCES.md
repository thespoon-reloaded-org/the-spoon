# Photos

Photos Unsplash (licence Unsplash : usage commercial libre, sans attribution
obligatoire), redimensionnées et recadrées au téléchargement pour ne pas
embarquer des fichiers de plusieurs Mo dans le dépôt.

⚠️ **Uniquement des photos Unsplash gratuites.** Les résultats de recherche
mélangent des photos « Unsplash+ » (champs `premium`/`plus` à `true`, URL sur
`plus.unsplash.com`) : celles-là sont livrées avec un filigrane « Unsplash+ »
répété en travers de l'image. Si vous remplacez un visuel, écartez-les.

| Fichier | Sujet |
|---|---|
| `hero-salle.jpg` | Salle de restaurant chaleureuse — hero de la landing |
| `hero-tablee.jpg` | Tablée vue du dessus — vignette du hero |
| `univers-client.jpg` | Convives à table — panneau de `/connexion` |
| `univers-restaurant.jpg` | Chef en cuisine — panneau de `/connexion-restaurant` |
| `univers-staff.jpg` | Salle vide, tons froids — panneau de `/connexion-admin` |
| `restaurateur-cta.jpg` | Restauratrice au comptoir — bloc partenaire de la landing |
| `plat-*.jpg` | Visuel de repli d'un plat sans photo, par catégorie (velouté en entrée, mijoté/risotto/ramen en plat, glace en dessert) |
| `cuisine-*.jpg` | Visuel de repli d'un restaurant sans photo, par type de cuisine |

Les visuels `cuisine-*` servent uniquement de repli : dès qu'un restaurant
téléverse sa propre photo (`/espace-restaurant/fiche`), c'est elle qui
s'affiche. Voir `src/lib/images.ts`.

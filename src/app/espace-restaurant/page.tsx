import { redirect } from "next/navigation";

/** Pas d'écran propre : `/espace-restaurant` retombe toujours sur le tableau de bord. */
export default function EspaceRestaurantPage() {
  redirect("/espace-restaurant/tableau-de-bord");
}

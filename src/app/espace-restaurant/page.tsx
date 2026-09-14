import { redirect } from "next/navigation";

/** Pas d'écran propre : `/espace-restaurant` retombe toujours sur son premier onglet. */
export default function EspaceRestaurantPage() {
  redirect("/espace-restaurant/reservations");
}

import { redirect } from "next/navigation";

/** Pas d'écran propre : `/admin` retombe sur la première entrée du menu. */
export default function ConsoleAdminPage() {
  redirect("/admin/restaurants");
}

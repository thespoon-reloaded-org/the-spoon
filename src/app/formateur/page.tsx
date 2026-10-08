import { redirect } from "next/navigation";

/** Pas d'écran propre : `/formateur` retombe sur la première entrée du menu. */
export default function ConsoleFormateurPage() {
  redirect("/formateur/evenements");
}

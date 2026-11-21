/**
 * Les bornes du nombre de couverts servis qu'un restaurant déclare en
 * marquant une réservation « honorée » (`marquerReservation`, dans
 * `src/app/espace-restaurant/reservations/actions.ts`, est déjà branchée ici).
 *
 * Ce nombre sert de base à la commission facturée (2,50 € par couvert) : une
 * faute de frappe (38 au lieu de 3) part telle quelle sur la facture.
 *
 * Module pur, sans base de données : il se teste sans rien démarrer.
 */

/** Ce que l'on sait de la réservation au moment du signalement. */
export type ReservationSignalee = {
  /** Couverts réservés par le dîneur (`Booking.couverts`). */
  couvertsReserves: number;
  /**
   * Capacité de la salle, déjà résolue par `capaciteEffective` : la capacité
   * de la fiche établissement, ou 100 si la fiche ne l'indique pas.
   */
  capacite: number;
};

/**
 * Le plus grand nombre de couverts servis accepté pour cette réservation.
 *
 * TODO (affaire 02) : aujourd'hui, aucune borne. C'est le bug de la facture
 * d'octobre.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- le correctif s'en servira
export function couvertsServisMaximum(reservation: ReservationSignalee): number {
  return Number.POSITIVE_INFINITY;
}

/** Vrai si le nombre saisi par le restaurant est accepté. */
export function couvertsServisAcceptes(
  couvertsServis: number,
  reservation: ReservationSignalee,
): boolean {
  return couvertsServis <= couvertsServisMaximum(reservation);
}

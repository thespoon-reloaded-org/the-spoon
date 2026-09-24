/** Refus métier explicite, porté jusqu'au client avec son statut HTTP. */
export class ErreurApi extends Error {
  constructor(
    readonly statut: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ErreurApi";
  }
}

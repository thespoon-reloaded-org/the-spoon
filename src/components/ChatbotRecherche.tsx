"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { BookingCard } from "@/components/BookingCard";
import { IconeCoeur, IconeCoeurBrise } from "@/components/Icones";
import { NoteCuilleres } from "@/components/NoteCuilleres";
import { PhotoCouverture } from "@/components/PhotoCouverture";
import { lireReservationAssistant, type CarteReservationAssistant } from "@/lib/chatbot/actions";
import type { CarteRestaurant, ReponseChatbot } from "@/lib/chatbot/agent";

type Verdict = "AIME" | "AIME_PAS";

type Bulle =
  | { role: "user"; content: string }
  | {
      role: "assistant";
      content: string;
      restaurants: CarteRestaurant[];
      propositionId?: string;
      verdict?: Verdict;
      souhait?: ReponseChatbot["souhait"];
    };

/** La carte de réservation ouverte sous un restaurant (clé : bulle + restaurant). */
type Reservation = {
  cle: string;
  restaurantId: string;
  donnees: CarteReservationAssistant | "chargement" | "erreur";
};

/**
 * La conversation survit à l'aller-retour par la page de connexion (qui
 * ramène sur l'accueil) : sans ça, « Connecte-toi pour réserver » ferait
 * perdre au dîneur la liste qu'il était en train de choisir. Le temps de
 * l'onglet seulement — `sessionStorage`, pas de trace durable.
 */
const CLE_STOCKAGE = "thespoon:assistant";

function lireConversation(): { bulles: Bulle[]; ouvert: boolean } | null {
  try {
    const brut = sessionStorage.getItem(CLE_STOCKAGE);
    return brut ? (JSON.parse(brut) as { bulles: Bulle[]; ouvert: boolean }) : null;
  } catch {
    return null;
  }
}

const DEMANDE_AUTRE = "D'autres propositions, s'il te plaît.";

/**
 * Ce que l'agent relit d'une réponse passée : le texte, plus la liste qu'il
 * avait proposée — sans elle, « pas le deuxième » ou « plus près » ne
 * voudraient rien dire au tour suivant.
 */
function versHistorique(bulle: Bulle): { role: Bulle["role"]; content: string } {
  if (bulle.role === "user" || bulle.restaurants.length === 0) {
    return { role: bulle.role, content: bulle.content };
  }
  const liste = bulle.restaurants
    .map((r, i) => `${i + 1}. ${r.nom} (${r.cuisine}, ${r.ville})`)
    .join("\n");
  return { role: "assistant", content: `${bulle.content}\n\nProposés :\n${liste}`.slice(0, 2000) };
}

const EXEMPLES = [
  "Un italien à Lyon avec un plat à moins de 20 €",
  "Ouvert samedi soir vers 20h, bien noté",
  "Une soupe sans gluten ni lait",
];

/**
 * Assistant de recherche de l'accueil : le dîneur décrit ce qu'il cherche en
 * langage naturel, l'agent (voir `src/lib/chatbot/agent.ts`) interroge la base
 * et rend un top 10 classé. Bouton flottant + panneau, pour ne rien retirer à
 * la recherche classique de la page.
 */
export function ChatbotRecherche() {
  // Lu dès l'état initial : le composant n'est rendu que côté navigateur
  // (voir `ChatbotAccueil`), le sessionStorage y est donc toujours là.
  const [sauvegarde] = useState(lireConversation);
  const [ouvert, setOuvert] = useState(sauvegarde?.ouvert ?? false);
  const [bulles, setBulles] = useState<Bulle[]>(sauvegarde?.bulles ?? []);
  const [saisie, setSaisie] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const fil = useRef<HTMLDivElement>(null);
  const champ = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(CLE_STOCKAGE, JSON.stringify({ bulles, ouvert }));
    } catch {
      // Navigation privée ou stockage plein : la conversation ne survivra pas, rien de plus.
    }
  }, [bulles, ouvert]);

  useEffect(() => {
    fil.current?.scrollTo({ top: fil.current.scrollHeight, behavior: "smooth" });
  }, [bulles, enCours]);

  useEffect(() => {
    if (ouvert) champ.current?.focus();
  }, [ouvert]);

  async function envoyer(texte: string, autreProposition = false) {
    const question = texte.trim();
    if (!question || enCours) return;
    // Tous les restaurants déjà montrés dans la conversation, pour ne pas les reproposer.
    const dejaProposes = autreProposition
      ? bulles.flatMap((b) => (b.role === "assistant" ? b.restaurants.map((r) => r.id) : []))
      : [];

    const suivantes: Bulle[] = [...bulles, { role: "user", content: question }];
    setBulles(suivantes);
    setSaisie("");
    setErreur(null);
    setEnCours(true);

    try {
      const reponse = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Les 10 derniers messages, texte seul : l'API refuse au-delà.
        body: JSON.stringify({ messages: suivantes.slice(-9).map(versHistorique), dejaProposes }),
      });
      const donnees = (await reponse.json().catch(() => null)) as
        (ReponseChatbot & { erreur?: undefined }) | { erreur: string } | null;

      if (!reponse.ok || !donnees || donnees.erreur !== undefined) {
        setErreur(donnees?.erreur ?? "La recherche a échoué, réessaie.");
        setBulles(bulles);
        if (!autreProposition) setSaisie(question);
        return;
      }
      setBulles([
        ...suivantes,
        {
          role: "assistant",
          content: donnees.message,
          restaurants: donnees.restaurants,
          propositionId: donnees.propositionId,
          souhait: donnees.souhait,
        },
      ]);
    } catch {
      setErreur("Connexion impossible, réessaie.");
      setBulles(bulles);
      if (!autreProposition) setSaisie(question);
    } finally {
      setEnCours(false);
    }
  }

  /** Le vote s'affiche tout de suite ; s'il n'a pas pu être enregistré, on revient en arrière. */
  async function voter(index: number, verdict: Verdict) {
    const bulle = bulles[index];
    if (bulle?.role !== "assistant" || !bulle.propositionId) return;
    const precedent = bulle.verdict;
    const changer = (v: Verdict | undefined) =>
      setBulles((actuelles) =>
        actuelles.map((b, i) => (i === index && b.role === "assistant" ? { ...b, verdict: v } : b)),
      );

    changer(verdict);
    try {
      const reponse = await fetch("/api/chatbot/avis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propositionId: bulle.propositionId, verdict }),
      });
      if (!reponse.ok) throw new Error();
    } catch {
      changer(precedent);
      setErreur("Ton avis n'a pas pu être enregistré, réessaie.");
    }
  }

  /** Ouvre (ou referme) la carte de réservation d'un restaurant, lue au clic. */
  async function basculerReservation(cle: string, restaurantId: string) {
    if (reservation?.cle === cle) {
      setReservation(null);
      return;
    }
    setReservation({ cle, restaurantId, donnees: "chargement" });
    let donnees: Reservation["donnees"];
    try {
      donnees = (await lireReservationAssistant(restaurantId)) ?? "erreur";
    } catch {
      donnees = "erreur";
    }
    // Le dîneur a pu ouvrir un autre restaurant entre-temps.
    setReservation((actuelle) => (actuelle?.cle === cle ? { ...actuelle, donnees } : actuelle));
  }

  const derniere = bulles.length - 1;

  return (
    <>
      {!ouvert && (
        <button
          type="button"
          onClick={() => setOuvert(true)}
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-[var(--color-accent)] px-5 py-3.5 text-sm font-bold text-white shadow-[var(--shadow-carte-levee)] transition-colors hover:bg-[var(--color-accent-hover)]"
        >
          <span aria-hidden>✦</span>
          Trouve-moi un resto
        </button>
      )}

      {ouvert && (
        <section
          role="dialog"
          aria-label="Assistant de recherche"
          // Hauteur fixe plutôt que maximale : le panneau ne se tasse plus sur
          // trois lignes quand la conversation est vide, et une liste de dix
          // restaurants avec sa carte de réservation tient sans défiler sans cesse.
          className="fixed inset-x-3 bottom-3 top-3 z-40 flex flex-col overflow-hidden rounded-[26px] border border-[var(--color-line-strong)] bg-[var(--color-cream)] shadow-[var(--shadow-carte-levee)] sm:inset-x-auto sm:top-auto sm:right-5 sm:bottom-5 sm:h-[min(860px,calc(100vh-40px))] sm:w-[560px] lg:w-[640px]"
        >
          <header className="flex items-center justify-between gap-3 bg-[var(--color-ink)] px-5 py-4 text-[var(--color-cream)]">
            <div className="flex flex-col leading-tight">
              <span className="font-[family-name:var(--font-display)] text-lg font-bold">
                Ton assistant TheSpoon
              </span>
              <span className="text-xs opacity-75">Dis-moi ce qui te ferait plaisir.</span>
            </div>
            <button
              type="button"
              onClick={() => setOuvert(false)}
              aria-label="Fermer l'assistant"
              className="rounded-full px-2.5 py-1 text-xl leading-none hover:bg-white/10"
            >
              ×
            </button>
          </header>

          <div
            ref={fil}
            className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4"
            aria-live="polite"
          >
            {bulles.length === 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-[var(--color-ink-soft)]">
                  Décris ton envie : ville, cuisine, budget, allergies, jour, ambiance… Je te
                  propose les 10 adresses qui s&apos;en rapprochent le plus.
                </p>
                {EXEMPLES.map((exemple) => (
                  <button
                    key={exemple}
                    type="button"
                    onClick={() => envoyer(exemple)}
                    className="rounded-2xl border-[1.5px] border-[var(--color-line-strong)] bg-white px-3.5 py-2 text-left text-sm text-[var(--color-ink)] hover:border-[var(--color-ink)]"
                  >
                    {exemple}
                  </button>
                ))}
              </div>
            )}

            {bulles.map((bulle, i) =>
              bulle.role === "user" ? (
                <p
                  key={i}
                  className="ml-8 self-end rounded-2xl rounded-br-md bg-[var(--color-ink)] px-3.5 py-2 text-sm text-[var(--color-cream)]"
                >
                  {bulle.content}
                </p>
              ) : (
                <div key={i} className="flex flex-col gap-3">
                  <p className="mr-8 whitespace-pre-line rounded-2xl rounded-bl-md bg-white px-3.5 py-2 text-sm text-[var(--color-ink)]">
                    {bulle.content}
                  </p>
                  {bulle.restaurants.length > 0 && (
                    <ol className="flex flex-col gap-2">
                      {bulle.restaurants.map((r, rang) => {
                        const cle = `${i}-${r.id}`;
                        const resa = reservation?.cle === cle ? reservation : null;
                        return (
                          <li
                            key={r.id}
                            className="flex flex-col overflow-hidden rounded-2xl border border-[var(--color-line-strong)] bg-white"
                          >
                            <Link
                              href={`/restaurants/${r.id}`}
                              className="flex gap-3 p-2 transition-colors hover:bg-[var(--color-page)]"
                            >
                              <span className="relative h-[88px] w-[88px] shrink-0 overflow-hidden rounded-xl">
                                <PhotoCouverture photo={r.photo} alt={r.nom} sizes="88px" />
                                <span className="absolute left-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--color-accent)] px-1 text-[11px] font-bold text-white">
                                  {rang + 1}
                                </span>
                              </span>
                              <span className="flex min-w-0 flex-col gap-0.5">
                                <span className="truncate font-[family-name:var(--font-display)] text-[15px] font-bold text-[var(--color-ink)]">
                                  {r.nom}
                                </span>
                                <span className="truncate text-xs text-[var(--color-ink-muted)]">
                                  {r.cuisine} · {r.ville}
                                </span>
                                <NoteCuilleres
                                  note={r.noteCuilleres}
                                  nombreAvis={r.nombreAvis}
                                  taille="petit"
                                />
                                <span className="line-clamp-2 text-xs text-[var(--color-ink-soft)]">
                                  {r.raison}
                                </span>
                              </span>
                            </Link>
                            <div className="flex justify-end border-t border-[var(--color-line)] px-2 py-1.5">
                              <button
                                type="button"
                                onClick={() => basculerReservation(cle, r.id)}
                                aria-expanded={resa !== null}
                                className={
                                  resa
                                    ? "rounded-full px-3.5 py-1.5 text-sm font-semibold text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
                                    : "rounded-full bg-[var(--color-accent)] px-4 py-1.5 text-sm font-bold text-white transition-colors hover:bg-[var(--color-accent-hover)]"
                                }
                              >
                                {resa ? "Fermer" : "Réserver"}
                              </button>
                            </div>
                            {resa && (
                              <div className="border-t border-[var(--color-line)] bg-[var(--color-page)] p-2">
                                {resa.donnees === "chargement" && (
                                  <p className="px-2 py-3 text-sm text-[var(--color-ink-muted)]">
                                    Je regarde les créneaux…
                                  </p>
                                )}
                                {resa.donnees === "erreur" && (
                                  <p
                                    role="alert"
                                    className="px-2 py-3 text-sm text-[var(--color-danger)]"
                                  >
                                    Impossible de charger les créneaux, réessaie.
                                  </p>
                                )}
                                {typeof resa.donnees === "object" && (
                                  <BookingCard
                                    restaurantId={r.id}
                                    estConnecte={resa.donnees.estConnecte}
                                    jours={resa.donnees.jours}
                                    ouvertures={resa.donnees.ouvertures}
                                    occupation={resa.donnees.occupation}
                                    capacite={resa.donnees.capacite}
                                    delaiAnnulationHeures={resa.donnees.delaiAnnulationHeures}
                                    souhait={bulle.souhait}
                                  />
                                )}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ol>
                  )}
                  {bulle.propositionId && (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div
                        role="group"
                        aria-labelledby={`avis-${i}`}
                        className="flex items-center gap-1"
                      >
                        {/* Sans ce libellé, deux cœurs isolés ne disent pas qu'on note la liste. */}
                        <span
                          id={`avis-${i}`}
                          className="pr-1 text-xs font-semibold text-[var(--color-ink-soft)]"
                        >
                          {bulle.verdict
                            ? "Merci pour ton avis !"
                            : "Ces propositions te plaisent ?"}
                        </span>
                        <button
                          type="button"
                          onClick={() => voter(i, "AIME")}
                          aria-pressed={bulle.verdict === "AIME"}
                          aria-label="J'aime ces propositions"
                          title="J'aime ces propositions"
                          className={`rounded-full p-2 transition-colors hover:bg-[var(--color-accent-tint)] ${bulle.verdict === "AIME" ? "text-[var(--color-accent)]" : "text-[var(--color-ink-muted)]"}`}
                        >
                          <IconeCoeur pleine={bulle.verdict === "AIME"} taille={20} />
                        </button>
                        <button
                          type="button"
                          onClick={() => voter(i, "AIME_PAS")}
                          aria-pressed={bulle.verdict === "AIME_PAS"}
                          aria-label="Ces propositions ne me plaisent pas"
                          title="Ces propositions ne me plaisent pas"
                          className={`rounded-full p-2 transition-colors hover:bg-[var(--color-line)] ${bulle.verdict === "AIME_PAS" ? "text-[var(--color-ink)]" : "text-[var(--color-ink-muted)]"}`}
                        >
                          <IconeCoeurBrise pleine={bulle.verdict === "AIME_PAS"} taille={20} />
                        </button>
                      </div>
                      {i === derniere && !enCours && (
                        <button
                          type="button"
                          onClick={() => envoyer(DEMANDE_AUTRE, true)}
                          className="rounded-full border-[1.5px] border-[var(--color-line-strong)] bg-white px-4 py-1.5 text-sm font-semibold text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)]"
                        >
                          Autre proposition
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ),
            )}

            {enCours && (
              <p className="mr-8 self-start rounded-2xl rounded-bl-md bg-white px-3.5 py-2 text-sm text-[var(--color-ink-muted)]">
                Je fouille la carte…
              </p>
            )}
          </div>

          {erreur && (
            <p role="alert" className="px-4 pb-2 text-sm text-[var(--color-danger)]">
              {erreur}
            </p>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              envoyer(saisie);
            }}
            className="flex items-end gap-2 border-t border-[var(--color-line)] bg-white px-3 py-3"
          >
            <textarea
              ref={champ}
              value={saisie}
              onChange={(e) => setSaisie(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  envoyer(saisie);
                }
              }}
              rows={1}
              maxLength={600}
              placeholder="Un bouchon lyonnais pour 6 vendredi…"
              aria-label="Ta recherche"
              className="max-h-28 flex-1 resize-none rounded-xl border-[1.5px] border-[var(--color-line-strong)] px-3 py-2 text-[15px] text-[var(--color-ink)] placeholder:text-[var(--color-ink-muted)] focus:border-[var(--color-ink)]"
            />
            <button
              type="submit"
              disabled={enCours || !saisie.trim()}
              className="rounded-full bg-[var(--color-accent)] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-40"
            >
              Envoyer
            </button>
          </form>
        </section>
      )}
    </>
  );
}

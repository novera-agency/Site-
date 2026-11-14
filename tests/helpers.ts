import { createGame } from "@/engine/engine";
import type { GameState } from "@/engine/types";
import { tOfDay, dayIndex, nextBusinessDay, START_T } from "@/engine/time";

export const profile = { firstName: "Test", lastName: "Joueur", nationality: "FR", age: 25, education: "Master", knowledge: "etudiant" as const, goal: "", specialization: "", riskProfile: "equilibre" as const };
export function game(mode: "carriere" | "bac_a_sable" | "defi" = "bac_a_sable", seed = "seed-test", capital = 100000): GameState {
  return createGame({ ownerId: "u", mode, difficulty: "normal", seed, profile, bankId: "lutece", track: "trader", startingCapital: capital, challengeId: mode === "defi" ? "objectif_10" : undefined });
}
/** Place l'horloge à 10 h un jour ouvré (marché européen ouvert), sans rien simuler */
export function atEuOpen(s: GameState) { s.t = tOfDay(nextBusinessDay(dayIndex(START_T)), 10, 0); return s; }
export const cash = (s: GameState, acc = "perso", cur = "EUR") => (s.balances[`${acc}:cash|${cur}`] ?? 0) / 100;

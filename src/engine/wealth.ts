/** Patrimoine du joueur en euros : liquidités, placements, immobilier (résidence + locatif), société. */
import type { GameState } from "./types";
import { accountEquity } from "./portfolio";
import { cashOf } from "./ledger";
import { housingEquity } from "./life";

export function wealthOf(s: GameState) {
  const cash = cashOf(s, "perso", "EUR") / 100;
  const perso = accountEquity(s, "perso");
  const realEstate = housingEquity(s);
  const company = s.company && !s.company.bankrupt ? Math.max(0, accountEquity(s, s.company.accountId)) * (1 - ((s.flags["dilution"] as number) ?? 0)) : 0;
  return { cash, perso, realEstate, company, total: perso + realEstate + company };
}

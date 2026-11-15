/**
 * Investissement immobilier locatif en France : 13 villes avec leurs prix, loyers, tension locative, risques et règles
 * (encadrement des loyers, interdiction de louer les passoires thermiques). Annonces renouvelées chaque mois.
 * Le joueur achète (comptant ou à crédit), loue ou vend au prix qu'il fixe : c'est le marché qui décide.
 *   – Loyer trop cher : personne ne signe. Loyer bas : plus de candidats, mais la demande de la ville reste limitée.
 *   – Prix de vente trop élevé : le bien ne part pas.
 */
import type { GameState, Property } from "./types";
import { Rng, seedRng } from "./rng";
import { notify, nextId, logDecision } from "./core";
import { cashAcc, post } from "./ledger";
import { toCents } from "./money";
import { dateOf, MIN_PER_DAY, EPOCH_YEAR, isWeekend } from "./time";
import { priceLevel, payslip, mortgageRate, eurCash } from "./life";

const EXT_RE = "ext:immobilier";

export interface City { id: string; name: string; price: number; rent: number; tension: number; trend: number; unpaid: number; turnover: number; cap: boolean; pros: string[]; cons: string[]; }
/** Prix et loyers moyens au m² (ordres de grandeur 2024), tension = probabilité mensuelle maximale de trouver un locataire */
export const CITIES: City[] = [
  { id: "paris", name: "Paris", price: 10000, rent: 30, tension: 0.95, trend: 0.01, unpaid: 0.002, turnover: 1 / 36, cap: true, pros: ["Demande locative énorme", "Valeur refuge, revente facile"], cons: ["Rendement faible (≈ 3,5 %)", "Encadrement des loyers", "Prix d'entrée très élevé"] },
  { id: "lyon", name: "Lyon", price: 4800, rent: 16.5, tension: 0.9, trend: 0.005, unpaid: 0.002, turnover: 1 / 30, cap: true, pros: ["Marché dynamique", "Bonne revente"], cons: ["Encadrement des loyers", "Rendement moyen"] },
  { id: "bordeaux", name: "Bordeaux", price: 4500, rent: 15, tension: 0.85, trend: -0.005, unpaid: 0.0025, turnover: 1 / 30, cap: true, pros: ["Ville attractive"], cons: ["Prix qui se tassent", "Encadrement des loyers"] },
  { id: "lille", name: "Lille", price: 3500, rent: 16, tension: 0.92, trend: 0.005, unpaid: 0.003, turnover: 1 / 14, cap: true, pros: ["Très forte demande étudiante", "Bon rendement"], cons: ["Locataires qui changent souvent", "Encadrement des loyers"] },
  { id: "montpellier", name: "Montpellier", price: 3600, rent: 15.5, tension: 0.85, trend: 0.005, unpaid: 0.003, turnover: 1 / 18, cap: true, pros: ["Ville étudiante en croissance"], cons: ["Encadrement des loyers"] },
  { id: "toulouse", name: "Toulouse", price: 3500, rent: 14, tension: 0.85, trend: 0.01, unpaid: 0.0025, turnover: 1 / 18, cap: false, pros: ["Pas d'encadrement des loyers", "Aéronautique et étudiants"], cons: ["Beaucoup de constructions neuves en concurrence"] },
  { id: "nantes", name: "Nantes", price: 3700, rent: 13.5, tension: 0.8, trend: 0, unpaid: 0.002, turnover: 1 / 30, cap: false, pros: ["Locataires solvables"], cons: ["Rendement modeste"] },
  { id: "rennes", name: "Rennes", price: 3800, rent: 14, tension: 0.9, trend: 0.01, unpaid: 0.0015, turnover: 1 / 18, cap: false, pros: ["Peu d'impayés", "Forte demande étudiante"], cons: ["Prix déjà élevés"] },
  { id: "strasbourg", name: "Strasbourg", price: 3500, rent: 14, tension: 0.85, trend: 0, unpaid: 0.002, turnover: 1 / 24, cap: false, pros: ["Institutions européennes", "Marché stable"], cons: ["Hausse des prix limitée"] },
  { id: "nice", name: "Nice", price: 5000, rent: 19, tension: 0.8, trend: 0.015, unpaid: 0.0025, turnover: 1 / 30, cap: false, pros: ["Loyers élevés", "Plus-values grâce au soleil et au tourisme"], cons: ["Charges de copropriété élevées", "Prix d'entrée élevé"] },
  { id: "marseille", name: "Marseille", price: 3500, rent: 15, tension: 0.75, trend: 0.015, unpaid: 0.007, turnover: 1 / 30, cap: false, pros: ["Bon rendement", "Prix en hausse"], cons: ["Risque d'impayés plus élevé", "Quartiers très inégaux"] },
  { id: "limoges", name: "Limoges", price: 1700, rent: 10, tension: 0.5, trend: -0.005, unpaid: 0.005, turnover: 1 / 24, cap: false, pros: ["Prix très bas", "Rendement élevé (≈ 7 %)"], cons: ["Demande faible : longues vacances locatives", "Revente difficile"] },
  { id: "saint-etienne", name: "Saint-Étienne", price: 1300, rent: 9, tension: 0.45, trend: -0.01, unpaid: 0.006, turnover: 1 / 24, cap: false, pros: ["Ticket d'entrée minime", "Rendement brut très élevé (≈ 8 %)"], cons: ["Vacance locative fréquente", "Prix en baisse", "Impayés plus fréquents"] },
];
export const CITY_BY_ID = Object.fromEntries(CITIES.map((c) => [c.id, c]));
const TYPES: { id: Property["type"]; name: string; surface: [number, number] }[] = [
  { id: "studio", name: "Studio", surface: [16, 28] }, { id: "t2", name: "Deux pièces", surface: [32, 48] },
  { id: "t3", name: "Trois pièces", surface: [55, 75] }, { id: "maison", name: "Maison", surface: [85, 130] },
];
export const TYPE_NAME: Record<Property["type"], string> = { studio: "Studio", t2: "Deux pièces", t3: "Trois pièces", maison: "Maison" };
const COND: Record<Property["condition"], { name: string; value: number; rent: number }> = {
  neuf: { name: "Neuf ou refait à neuf", value: 1.12, rent: 1.06 }, bon: { name: "Bon état", value: 1, rent: 1 }, renover: { name: "À rénover", value: 0.78, rent: 0.9 },
};
export const COND_NAME = Object.fromEntries(Object.entries(COND).map(([k, v]) => [k, v.name])) as Record<Property["condition"], string>;

/** Indice des prix des logements anciens en France (2024 = 1) : ×2,2 entre 2000 et 2010, palier, hausse 2016-2022, baisse 2023-2024 */
const FR_IDX: [number, number][] = [[2000, 0.45], [2003, 0.58], [2005, 0.75], [2007, 0.86], [2009, 0.82], [2011, 0.89], [2015, 0.85], [2018, 0.9], [2020, 0.97], [2022, 1.05], [2024, 0.98], [2027, 1.03]];
function frIndex(y: number) {
  if (y <= FR_IDX[0][0]) return FR_IDX[0][1];
  for (let i = 1; i < FR_IDX.length; i++) if (y <= FR_IDX[i][0]) { const [y0, v0] = FR_IDX[i - 1], [y1, v1] = FR_IDX[i]; return v0 + (v1 - v0) * (y - y0) / (y1 - y0); }
  return FR_IDX[FR_IDX.length - 1][1] * Math.pow(1.015, y - 2027);
}
const yearOf = (s: GameState) => { const d = dateOf(s.t); return d.getUTCFullYear() + d.getUTCMonth() / 12; };
/** Prix moyen au m² d'une ville aujourd'hui (indice national × tendance propre de la ville) */
export function cityPrice(s: GameState, c: City) { const y = yearOf(s); return c.price * frIndex(y) / 0.98 * Math.exp(c.trend * (y - 2024)); }
export function cityRent(s: GameState, c: City) { return c.rent * priceLevel(s) / (1 / 1.04); }
export function marketValue(s: GameState, p: Property) { return Math.round(cityPrice(s, CITY_BY_ID[p.city]) * p.surface * COND[p.condition].value * (p.dpe === "G" || p.dpe === "F" ? 0.92 : 1) / 100) * 100; }
export function marketRent(s: GameState, p: Property) { return Math.round(cityRent(s, CITY_BY_ID[p.city]) * p.surface * COND[p.condition].rent * (p.surface < 30 ? 1.15 : 1)); }
/** Loyer maximum légal dans les villes encadrées (référence majorée) */
export function rentCap(s: GameState, p: Property) { return CITY_BY_ID[p.city].cap && yearOf(s) >= 2019 ? Math.round(marketRent(s, p) * 1.1) : null; }
const canRent = (s: GameState, p: Property) => !(p.dpe === "G" && yearOf(s) >= 2025);

/** Probabilité mensuelle de trouver un locataire au loyer demandé */
export function rentProbability(s: GameState, p: Property, ask: number) {
  const r = ask / marketRent(s, p);
  const f = r <= 0.9 ? 1 : r >= 1.25 ? 0 : (1.25 - r) / 0.35;
  return CITY_BY_ID[p.city].tension * f;
}
/** Probabilité hebdomadaire de vendre au prix demandé */
export function saleProbability(s: GameState, p: Property, ask: number) {
  const occupied = p.status === "loue" ? 0.9 : 1;
  const r = ask / (marketValue(s, p) * occupied);
  const c = CITY_BY_ID[p.city];
  const f = r <= 0.92 ? 0.6 : r >= 1.18 ? 0 : 0.6 * (1.18 - r) / 0.26;
  const reg = s.macro.regime === "crise" || s.macro.regime === "recession" ? 0.6 : 1;
  const rates = Math.max(0.4, 1 - Math.max(0, s.macro.zones.EZ.y10 - 3) * 0.15);
  return f * (0.4 + 0.6 * c.tension) * reg * rates;
}

// ───────────── Annonces du mois ─────────────
export interface Listing { id: string; city: string; type: Property["type"]; surface: number; condition: Property["condition"]; dpe: Property["dpe"]; price: number; desc: string; }
export function listings(s: GameState, cityId: string): Listing[] {
  const c = CITY_BY_ID[cityId]; if (!c) return [];
  const d = dateOf(s.t); const month = (d.getUTCFullYear() - EPOCH_YEAR) * 12 + d.getUTCMonth();
  const rng = new Rng(seedRng(`${s.seed}|${cityId}|${month}`));
  const out: Listing[] = [];
  const bought = new Set(s.life?.reBought ?? []);
  for (let k = 0; k < 4; k++) {
    const t = rng.pick(c.id === "paris" ? TYPES.slice(0, 3) : TYPES);
    const surface = Math.round(rng.range(t.surface[0], t.surface[1]));
    const condition = rng.weighted<Property["condition"]>([{ item: "bon", w: 5 }, { item: "renover", w: 3 }, { item: "neuf", w: 2 }]);
    const dpe = condition === "renover" ? rng.pick(["E", "F", "G"] as const) : condition === "neuf" ? rng.pick(["A", "B", "C"] as const) : rng.pick(["C", "D", "D", "E"] as const);
    const fake: Property = { id: "", city: cityId, type: t.id, surface, condition, dpe, buyPrice: 0, buyT: 0, status: "vacant" };
    const price = Math.round(marketValue(s, fake) * rng.range(0.9, 1.1) / 1000) * 1000;
    const id = `${cityId}-${month}-${k}`;
    if (bought.has(id)) continue;
    const quart = rng.pick(c.id === "marseille" ? ["quartier recherché du 7e", "quartier populaire du 3e", "quartier calme du 12e"] : ["centre-ville", "proche gare", "quartier étudiant", "quartier résidentiel", "proche tramway"]);
    out.push({ id, city: cityId, type: t.id, surface, condition, dpe, price, desc: `${TYPE_NAME[t.id]} de ${surface} m², ${quart}, ${COND[condition].name.toLowerCase()}, DPE ${dpe}.` });
  }
  return out;
}

// ───────────── Actions ─────────────
const ok = (message: string) => ({ ok: true as const, message });
const err = (error: string) => ({ ok: false as const, error });
const fmt = (v: number) => `${Math.round(v).toLocaleString("fr-FR")} €`;
function monthlyLoan(principal: number, rate: number, n = 240) { return principal * (rate / 12) / (1 - Math.pow(1 + rate / 12, -n)); }
/** Mensualités de crédit déjà engagées (résidence + investissements), en euros */
export function loanBurden(s: GameState) {
  const l = s.life!; let m = (l.housing.mortgage?.monthly ?? 0) / 100;
  for (const p of l.properties ?? []) if (p.loan) m += p.loan.monthly / 100;
  return m;
}
export function buyProperty(s: GameState, listingId: string, credit: boolean) {
  const l = s.life; if (!l) return err("Investissement réservé au mode carrière.");
  const cityId = listingId.split("-").slice(0, -2).join("-");
  const li = listings(s, cityId).find((x) => x.id === listingId);
  if (!li) return err("Cette annonce n'est plus disponible.");
  const fees = Math.round(li.price * 0.075);
  const cash = eurCash(s);
  const p: Property = { id: nextId(s, "bien"), city: li.city, type: li.type, surface: li.surface, condition: li.condition, dpe: li.dpe, buyPrice: li.price, buyT: s.t, status: "vacant" };
  if (credit) {
    if (!s.career.employed) return err("Sans emploi, aucune banque ne financera l'investissement.");
    const down = Math.round(li.price * 0.1);
    if (cash < down + fees) return err(`Apport insuffisant : ${fmt(down + fees)} nécessaires (10 % + frais de notaire).`);
    const rate = mortgageRate(s) + 0.002;
    const monthly = monthlyLoan(li.price - down, rate);
    const income = payslip(s).net + 0.7 * (l.properties ?? []).reduce((a, x) => a + (x.status === "loue" ? x.rent ?? 0 : 0), 0);
    if (loanBurden(s) + monthly > income * 0.35) return err(`Refus de la banque : vos mensualités dépasseraient 35 % de vos revenus (${fmt(loanBurden(s) + monthly)} pour ${fmt(income)} de revenus). Constituez un apport plus important ou louez d'abord vos biens.`);
    post(s, EXT_RE, cashAcc("perso"), toCents(down + fees), "EUR", `Investissement : ${li.desc} à ${CITY_BY_ID[li.city].name} — apport et frais de notaire`);
    p.loan = { principal: toCents(li.price - down), rate, monthly: toCents(monthly), monthsLeft: 240 };
  } else {
    if (cash < li.price + fees) return err(`Il faut ${fmt(li.price + fees)} au comptant (prix + 7,5 % de frais de notaire).`);
    post(s, EXT_RE, cashAcc("perso"), toCents(li.price + fees), "EUR", `Investissement : ${li.desc} à ${CITY_BY_ID[li.city].name} — achat comptant et frais de notaire`);
  }
  l.properties = [...(l.properties ?? []), p];
  l.reBought = [...(l.reBought ?? []).slice(-60), li.id];
  logDecision(s, "patrimoine", `Achat locatif à ${CITY_BY_ID[li.city].name} : ${li.desc} pour ${fmt(li.price)}`);
  return ok(`Achat signé à ${CITY_BY_ID[li.city].name} : ${li.desc} Fixez maintenant un loyer pour trouver un locataire.`);
}
const findP = (s: GameState, id: string) => s.life?.properties?.find((x) => x.id === id);
export function setRent(s: GameState, id: string, rent: number) {
  const p = findP(s, id); if (!p) return err("Bien introuvable.");
  if (p.status === "loue") return err("Le bien est déjà loué : le loyer sera révisé chaque année.");
  if (p.status === "travaux") return err("Travaux en cours.");
  if (!canRent(s, p)) return err("Logement classé G au DPE : il est interdit de le louer. Faites des travaux de rénovation énergétique.");
  const cap = rentCap(s, p);
  if (cap !== null && rent > cap) return err(`Encadrement des loyers à ${CITY_BY_ID[p.city].name} : maximum légal ${fmt(cap)} par mois pour ce logement.`);
  if (rent < 50) return err("Loyer invalide.");
  p.status = "en_location"; p.askRent = Math.round(rent); p.askPrice = undefined;
  const pr = rentProbability(s, p, rent);
  return ok(`Annonce publiée à ${fmt(rent)} par mois. Loyer du marché : ${fmt(marketRent(s, p))}. Chances de trouver un locataire dans le mois : ${Math.round(pr * 100)} %.`);
}
export function setSale(s: GameState, id: string, price: number) {
  const p = findP(s, id); if (!p) return err("Bien introuvable.");
  if (p.status === "travaux") return err("Travaux en cours.");
  if (price < 1000) return err("Prix invalide.");
  p.askPrice = Math.round(price);
  if (p.status !== "loue") p.status = "en_vente";
  p.askRent = p.status === "en_vente" ? undefined : p.askRent;
  return ok(`Mis en vente à ${fmt(price)}. Estimation du marché : ${fmt(marketValue(s, p) * (p.status === "loue" ? 0.9 : 1))}${p.status === "loue" ? " (vendu occupé, avec son locataire : −10 %)" : ""}. Chances de vendre dans la semaine : ${Math.round(saleProbability(s, p, price) * 100)} %.`);
}
export function withdraw(s: GameState, id: string) {
  const p = findP(s, id); if (!p) return err("Bien introuvable.");
  if (p.askPrice) p.askPrice = undefined;
  if (p.status === "en_vente" || p.status === "en_location") p.status = "vacant";
  p.askRent = undefined;
  return ok("Annonce retirée.");
}
export function renovate(s: GameState, id: string) {
  const p = findP(s, id); if (!p) return err("Bien introuvable.");
  if (p.status === "loue") return err("Impossible pendant la location.");
  if (p.condition === "neuf") return err("Le bien est déjà refait à neuf.");
  const cost = Math.round(p.surface * (p.condition === "renover" ? 1100 : 600) * priceLevel(s) / 100) * 100;
  if (eurCash(s) < cost) return err(`Les travaux coûtent ${fmt(cost)}.`);
  post(s, EXT_RE, cashAcc("perso"), toCents(cost), "EUR", `Travaux de rénovation — ${TYPE_NAME[p.type]} à ${CITY_BY_ID[p.city].name}`);
  p.status = "travaux"; p.worksUntil = s.t + (p.condition === "renover" ? 75 : 40) * MIN_PER_DAY; p.askRent = undefined; p.askPrice = undefined;
  return ok(`Travaux lancés (${fmt(cost)}). Fin prévue dans ${p.condition === "renover" ? "deux mois et demi" : "six semaines"} : état « neuf », meilleur DPE, loyer et valeur en hausse.`);
}

// ───────────── Chaque jour / chaque mois ─────────────
function lg(s: GameState, p: Property, text: string) { p.log = [{ t: s.t, text }, ...(p.log ?? [])].slice(0, 20); }
export function dailyRealEstate(s: GameState, rng: Rng) {
  const l = s.life; if (!l?.properties?.length) return;
  const wk = !isWeekend(s.t);
  for (const p of [...l.properties]) {
    const c = CITY_BY_ID[p.city];
    const name = `${TYPE_NAME[p.type]} à ${c.name}`;
    if (p.status === "travaux" && p.worksUntil !== undefined && s.t >= p.worksUntil) {
      p.condition = "neuf"; p.dpe = p.dpe === "A" || p.dpe === "B" ? p.dpe : "C"; p.status = "vacant"; p.worksUntil = undefined;
      notify(s, "succes", `Travaux terminés : ${name}`, `Valeur estimée : ${fmt(marketValue(s, p))}, loyer de marché : ${fmt(marketRent(s, p))}.`, "/play/immobilier"); lg(s, p, "Travaux terminés");
    }
    if (p.status === "en_location" && p.askRent && wk && rng.chance(1 - Math.pow(1 - rentProbability(s, p, p.askRent), 1 / 22))) {
      p.status = "loue"; p.rent = p.askRent; p.tenantSince = s.t; p.askRent = undefined;
      notify(s, "succes", `Locataire trouvé : ${name}`, `Bail signé à ${fmt(p.rent)} par mois.`, "/play/immobilier"); lg(s, p, `Bail signé à ${fmt(p.rent)}`);
    } else if (p.status === "loue" && rng.chance(c.turnover / 30)) {
      p.status = "vacant"; lg(s, p, "Départ du locataire");
      const was = p.rent; p.rent = undefined; p.tenantSince = undefined;
      notify(s, "alerte", `Votre locataire quitte le ${name.toLowerCase()}`, `Le logement est vide : remettez-le en location (ancien loyer ${fmt(was ?? 0)}).`, "/play/immobilier");
    }
    if (p.askPrice && wk && rng.chance(saleProbability(s, p, p.askPrice) / 5)) sell(s, p);
  }
}
function sell(s: GameState, p: Property) {
  const l = s.life!;
  const c = CITY_BY_ID[p.city];
  const price = p.askPrice!;
  const years = (s.t - p.buyT) / (365 * MIN_PER_DAY);
  const gain = price - p.buyPrice;
  const abatt = Math.min(1, Math.max(0, (years - 5) * 0.06));
  const tax = gain > 0 ? Math.round(gain * 0.362 * (1 - abatt)) : 0;
  const loan = (p.loan?.principal ?? 0) / 100;
  const agency = Math.round(price * 0.04);
  const net = price - loan - tax - agency;
  if (net >= 0) post(s, cashAcc("perso"), EXT_RE, toCents(net), "EUR", `Vente — ${TYPE_NAME[p.type]} à ${c.name} : ${fmt(price)} − crédit ${fmt(loan)} − impôt sur la plus-value ${fmt(tax)} − agence ${fmt(agency)}`);
  else post(s, EXT_RE, cashAcc("perso"), toCents(-net), "EUR", `Vente à perte — ${TYPE_NAME[p.type]} à ${c.name} : solde du crédit`);
  l.properties = l.properties!.filter((x) => x.id !== p.id);
  logDecision(s, "patrimoine", `Vente à ${c.name} pour ${fmt(price)} (plus-value brute ${fmt(gain)})`);
  notify(s, "succes", `Vendu : ${TYPE_NAME[p.type]} à ${c.name}`, `${fmt(price)} — vous encaissez ${fmt(net)} après crédit, impôt et agence.`, "/play/immobilier");
}
/** Le 1er du mois : loyers, charges, taxe foncière, crédit, impôt sur les revenus locatifs, impayés */
export function monthlyRealEstate(s: GameState, rng: Rng) {
  const l = s.life; if (!l?.properties?.length) return;
  for (const p of l.properties) {
    const c = CITY_BY_ID[p.city];
    const name = `${TYPE_NAME[p.type]} à ${c.name}`;
    const value = marketValue(s, p);
    const costs = Math.round(value * 0.009 / 12 + p.surface * 2.2 * priceLevel(s) + 15);
    post(s, EXT_RE, cashAcc("perso"), toCents(costs), "EUR", `Immobilier : taxe foncière, copropriété, assurance — ${name}`);
    let interest = 0;
    if (p.loan && p.loan.monthsLeft > 0) {
      post(s, EXT_RE, cashAcc("perso"), p.loan.monthly, "EUR", `Immobilier : mensualité du crédit — ${name}`);
      interest = Math.round(p.loan.principal * p.loan.rate / 12);
      p.loan.principal = Math.max(0, p.loan.principal - (p.loan.monthly - interest)); p.loan.monthsLeft--;
      if (p.loan.monthsLeft === 0) { p.loan = undefined; lg(s, p, "Crédit remboursé"); }
    }
    if (p.status === "loue" && p.rent) {
      if (rng.chance(c.unpaid)) { p.unpaid = (p.unpaid ?? 0) + 1; notify(s, "alerte", `Loyer impayé : ${name}`, "Votre locataire n'a pas payé ce mois-ci.", "/play/immobilier"); lg(s, p, "Loyer impayé"); }
      else {
        post(s, cashAcc("perso"), EXT_RE, toCents(p.rent), "EUR", `Loyer perçu — ${name}`);
        const taxable = Math.max(0, p.rent * 0.7 - interest / 100);
        const tax = Math.round(taxable * 0.3);
        if (tax > 0) post(s, EXT_RE, cashAcc("perso"), toCents(tax), "EUR", `Immobilier : impôt et prélèvements sociaux sur les loyers — ${name}`);
      }
      // Révision annuelle du loyer
      if (p.tenantSince && Math.round((s.t - p.tenantSince) / MIN_PER_DAY) % 365 < 31 && s.t - p.tenantSince > 300 * MIN_PER_DAY) p.rent = Math.round(p.rent * (1 + Math.max(0, s.macro.zones.EZ.inflation) / 100));
    }
  }
}
/** Valeur nette du parc locatif (valeur de marché − crédits restants) */
export function propertiesEquity(s: GameState) { return (s.life?.properties ?? []).reduce((a, p) => a + marketValue(s, p) - (p.loan?.principal ?? 0) / 100, 0); }

/**
 * Réparation des parties touchées par l'ancien bug (solde lu en centimes) : les achats immobiliers qui ont mis le compte
 * dans le rouge sont annulés et remboursés, du plus récent au plus ancien, tant que le compte reste négatif.
 */
export function repairUnaffordablePurchases(s: GameState) {
  const l = s.life;
  if (!l?.properties?.length || s.flags["reCashFix"]) return;
  s.flags["reCashFix"] = true;
  const undone: string[] = [];
  for (const p of [...l.properties].sort((a, b) => b.buyT - a.buyT)) {
    if (eurCash(s) >= 0) break;
    const paid = Math.round(p.loan ? p.buyPrice * 0.175 : p.buyPrice * 1.075);
    post(s, cashAcc("perso"), EXT_RE, toCents(paid), "EUR", `Annulation d'un achat non finançable (correction) — ${TYPE_NAME[p.type]} à ${CITY_BY_ID[p.city].name}`);
    l.properties = l.properties.filter((x) => x.id !== p.id);
    undone.push(`${TYPE_NAME[p.type]} à ${CITY_BY_ID[p.city].name}`);
  }
  if (undone.length) notify(s, "info", "Correction : achat immobilier annulé", `Un défaut du jeu vous avait laissé acheter sans les fonds nécessaires. Achat annulé et remboursé : ${undone.join(", ")}.`, "/play/immobilier");
}

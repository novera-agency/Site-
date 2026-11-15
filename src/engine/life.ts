/**
 * Vie privée : salaire net et impôt, logement (location ou achat à crédit), factures mensuelles, transport, abonnements,
 * loisirs (temps libre limité), jauges de santé mentale, forme physique, vie sociale et épanouissement, événements de la vie.
 * Le joueur doit concilier travail, obligations et plaisir : chaque jauge influence le stress, l'énergie et les performances.
 */
import type { GameState, LifeState } from "./types";
import { Rng } from "./rng";
import { clamp, notify, nextId, logDecision, changeTrust, gainXp, changeRep } from "./core";
import { cashAcc, post, cashOf } from "./ledger";
const EXT_LIVING = "ext:depenses_vie";
/** Solde du compte courant personnel, en euros (le grand livre compte en centimes) */
export function eurCash(s: GameState) { return cashOf(s, "perso", "EUR") / 100; }
import { toCents, fromCents } from "./money";
import { dayIndex, isWeekend, MIN_PER_DAY, EPOCH_YEAR, dateOf } from "./time";
import { BANK_BY_ID } from "./data/banks";
import { dailyRealEstate, monthlyRealEstate, propertiesEquity } from "./realestate";

// ───────────── Niveau des prix (mode historique : la vie coûtait moins cher en 2000) ─────────────
const PRICE_PTS: [number, number][] = [[2000, 0.68], [2005, 0.75], [2010, 0.82], [2015, 0.86], [2020, 0.89], [2022, 0.95], [2024, 1.0], [2027, 1.04]];
export function priceLevelYear(y: number) {
  if (y <= PRICE_PTS[0][0]) return PRICE_PTS[0][1];
  for (let i = 1; i < PRICE_PTS.length; i++) if (y <= PRICE_PTS[i][0]) { const [y0, v0] = PRICE_PTS[i - 1], [y1, v1] = PRICE_PTS[i]; return v0 + (v1 - v0) * (y - y0) / (y1 - y0); }
  return PRICE_PTS[PRICE_PTS.length - 1][1] * Math.pow(1.02, y - 2027);
}
/** Niveau des prix courant, normalisé sur 2027 (monde fictif = 1) */
export function priceLevel(s: GameState) { const d = dateOf(s.t); return priceLevelYear(d.getUTCFullYear() + d.getUTCMonth() / 12) / 1.04; }

// ───────────── Logement ─────────────
export interface HousingDef { id: string; name: string; rent: number; price: number | null; comfort: number; desc: string; commute: number; }
export const HOUSING: HousingDef[] = [
  { id: "coloc", name: "Chambre en colocation", rent: 700, price: null, comfort: 1, desc: "Pas cher et animé, mais peu d'intimité.", commute: 0 },
  { id: "studio", name: "Studio en centre-ville", rent: 950, price: 230000, comfort: 2, desc: "Petit, mais proche du bureau.", commute: 0 },
  { id: "t2", name: "Appartement 2 pièces", rent: 1400, price: 380000, comfort: 3, desc: "Confortable, une vraie chambre.", commute: 0 },
  { id: "t4", name: "Grand appartement familial", rent: 2300, price: 680000, comfort: 4, desc: "Spacieux, pour recevoir.", commute: 0 },
  { id: "maison", name: "Maison avec jardin en banlieue", rent: 2000, price: 540000, comfort: 4, desc: "Calme et verdure, mais 50 min de trajet chaque jour.", commute: 1 },
  { id: "loft", name: "Loft de standing", rent: 4500, price: 1400000, comfort: 5, desc: "Le grand luxe, avec vue.", commute: 0 },
];
export const HOUSING_BY_ID = Object.fromEntries(HOUSING.map((h) => [h.id, h]));
const CITY_MULT: Record<string, number> = { Paris: 1, "New York": 1.35, Genève: 1.3, Francfort: 0.8, "Tokyo / Singapour": 1.05, Lyon: 0.7, Londres: 1.3 };
export function cityMult(s: GameState) { return CITY_MULT[BANK_BY_ID[s.career.bankId]?.city ?? "Paris"] ?? 1; }
export function rentOf(s: GameState, id: string) { return Math.round(HOUSING_BY_ID[id].rent * cityMult(s) * priceLevel(s) / 10) * 10; }
export function priceOf(s: GameState, id: string) { const p = HOUSING_BY_ID[id].price; return p === null ? null : Math.round(p * cityMult(s) * priceLevel(s) / 1000) * 1000; }

// ───────────── Transport et abonnements ─────────────
export const TRANSPORT: Record<LifeState["transport"], { name: string; cost: number; desc: string }> = {
  commun: { name: "Transports en commun", cost: 86, desc: "Économique ; un peu fatigant aux heures de pointe." },
  velo: { name: "Vélo", cost: 20, desc: "Bon pour la forme, gratuit ou presque." },
  occasion: { name: "Voiture d'occasion", cost: 420, desc: "Liberté le week-end ; crédit, assurance, carburant, parking." },
  neuve: { name: "Voiture neuve en location longue durée", cost: 780, desc: "Confort et prestige." },
};
export const SUBS: Record<keyof LifeState["subs"], { name: string; cost: number; desc: string }> = {
  mutuelle: { name: "Mutuelle santé", cost: 55, desc: "Sans elle, les frais médicaux sont mal remboursés." },
  assurance: { name: "Assurance habitation", cost: 22, desc: "Couvre dégâts des eaux, incendie, vol." },
  sport: { name: "Salle de sport", cost: 45, desc: "Séances de sport gratuites et forme entretenue." },
  streaming: { name: "Abonnements vidéo et musique", cost: 25, desc: "Petits plaisirs du quotidien." },
};

// ───────────── Loisirs ─────────────
export interface Activity { id: string; name: string; cost: number; hours: number; m: number; p: number; so: number; f: number; weekend?: boolean; desc: string; emoji: string; }
export const ACTIVITIES: Activity[] = [
  { id: "amis", name: "Dîner entre amis", cost: 45, hours: 3, m: 3, p: -1, so: 9, f: 6, desc: "Rire, refaire le monde.", emoji: "🍝" },
  { id: "resto", name: "Restaurant gastronomique", cost: 160, hours: 3, m: 4, p: 0, so: 4, f: 10, desc: "Une belle table pour se faire plaisir.", emoji: "🍷" },
  { id: "sport", name: "Séance de sport", cost: 15, hours: 1.5, m: 3, p: 8, so: 1, f: 1, desc: "Gratuite avec l'abonnement à la salle.", emoji: "🏋️" },
  { id: "course", name: "Course à pied", cost: 0, hours: 1, m: 2, p: 5, so: 0, f: 1, desc: "Gratuit et efficace.", emoji: "🏃" },
  { id: "cine", name: "Cinéma ou série", cost: 12, hours: 2, m: 2, p: 0, so: 1, f: 4, desc: "Se vider la tête.", emoji: "🎬" },
  { id: "jeux", name: "Jeux vidéo", cost: 0, hours: 2, m: 1, p: -1, so: -1, f: 5, desc: "Seul devant l'écran.", emoji: "🎮" },
  { id: "lecture", name: "Lecture, méditation", cost: 0, hours: 1, m: 4, p: 0, so: 0, f: 2, desc: "Un moment calme pour soi.", emoji: "📖" },
  { id: "famille", name: "Voir sa famille", cost: 60, hours: 6, m: 6, p: 0, so: 8, f: 3, desc: "Garder le lien avec ses proches.", emoji: "👨‍👩‍👧" },
  { id: "concert", name: "Concert ou spectacle", cost: 75, hours: 3, m: 3, p: 0, so: 5, f: 9, desc: "Une soirée qui marque.", emoji: "🎤" },
  { id: "club", name: "Sortie en club", cost: 90, hours: 5, m: 1, p: -7, so: 9, f: 11, desc: "On se couche tard… et le lendemain pique.", emoji: "🪩" },
  { id: "shopping", name: "Shopping", cost: 250, hours: 2, m: 1, p: 0, so: 1, f: 7, desc: "Se faire plaisir (mais l'effet s'estompe vite).", emoji: "🛍️" },
  { id: "psy", name: "Séance chez un psychologue", cost: 70, hours: 1, m: 11, p: 0, so: 0, f: 0, desc: "Parler à un professionnel aide vraiment.", emoji: "🛋️" },
  { id: "repos", name: "Grasse matinée et repos", cost: 0, hours: 4, m: 3, p: 5, so: 0, f: 2, weekend: true, desc: "Récupérer, tout simplement.", emoji: "😴" },
  { id: "amour", name: "Soirée en amoureux", cost: 80, hours: 3, m: 4, p: 0, so: 3, f: 6, desc: "Du temps rien que pour vous deux (si vous êtes en couple).", emoji: "💞" },
  { id: "enfants", name: "Journée avec les enfants", cost: 40, hours: 6, m: 6, p: 1, so: 4, f: 5, weekend: true, desc: "Parc, jeux, devoirs… (si vous avez des enfants).", emoji: "🧸" },
  { id: "weekend", name: "Week-end à la campagne", cost: 420, hours: 14, m: 12, p: 4, so: 6, f: 14, weekend: true, desc: "Deux jours loin de tout.", emoji: "🏡" },
];

export function initLife(s: GameState): LifeState {
  return {
    mental: 72, physique: 70, social: 65, fun: 60,
    housing: { id: "studio", owned: false, since: s.t }, transport: "commun",
    subs: { mutuelle: true, assurance: true, sport: false, streaming: true },
    free: { day: dayIndex(s.t), used: 0 }, unpaid: 0, perks: { teletravail: false, extraLeave: 0 }, log: [], budget: [],
  };
}
export const lifeOn = (s: GameState) => !!s.life && s.mode === "carriere";

function lg(s: GameState, text: string) { const l = s.life!; l.log.unshift({ t: s.t, text }); if (l.log.length > 60) l.log.length = 60; }
const bar = (x: number) => clamp(x, 0, 100);
function apply(s: GameState, m: number, p: number, so: number, f: number) { const l = s.life!; l.mental = bar(l.mental + m); l.physique = bar(l.physique + p); l.social = bar(l.social + so); l.fun = bar(l.fun + f); }

/** Heures de temps libre de la journée en cours */
export function freeHours(s: GameState) {
  const l = s.life!;
  const vac = !!s.flags["vacationUntil"] && s.t < (s.flags["vacationUntil"] as number);
  const kids = l.children ?? 0;
  const total = Math.max(1, (isWeekend(s.t) || vac || !s.career.employed ? 14 - 3 * kids : (l.perks.teletravail ? 5 : HOUSING_BY_ID[l.housing.id].commute ? 3 : 4) - kids));
  const used = l.free.day === dayIndex(s.t) ? l.free.used : 0;
  return { total, used, left: Math.max(0, total - used) };
}

export function doActivity(s: GameState, id: string) {
  if (!lifeOn(s)) return { ok: false as const, error: "La vie privée n'est simulée qu'en mode carrière." };
  const a = ACTIVITIES.find((x) => x.id === id);
  if (!a) return { ok: false as const, error: "Activité inconnue." };
  if (s.activeMeetingId) return { ok: false as const, error: "Vous êtes en réunion." };
  const l = s.life!;
  if (a.weekend && !isWeekend(s.t) && !(s.flags["vacationUntil"] && s.t < (s.flags["vacationUntil"] as number))) return { ok: false as const, error: "Possible seulement le week-end ou en congés." };
  if (a.id === "amour" && !l.partner) return { ok: false as const, error: "Vous n'êtes pas en couple pour l'instant." };
  if (a.id === "enfants" && !(l.children ?? 0)) return { ok: false as const, error: "Vous n'avez pas d'enfant." };
  const fh = freeHours(s);
  if (fh.left < a.hours) return { ok: false as const, error: `Il ne vous reste que ${fh.left} h de temps libre aujourd'hui (il en faut ${a.hours}).` };
  const cost = a.id === "sport" && l.subs.sport ? 0 : Math.round(a.cost * priceLevel(s));
  if (cost > 0 && eurCash(s) < cost) return { ok: false as const, error: "Solde insuffisant sur votre compte personnel." };
  if (l.free.day !== dayIndex(s.t)) l.free = { day: dayIndex(s.t), used: 0 };
  l.free.used += a.hours;
  // Les plaisirs répétés lassent : rendement décroissant si la même activité est refaite dans la semaine
  const key = `act_${a.id}`;
  const recent = (s.flags[key] as number | undefined) ?? -1e9;
  const tired = s.t - recent < 7 * MIN_PER_DAY ? 0.5 : 1;
  s.flags[key] = s.t;
  if (cost > 0) post(s, EXT_LIVING, cashAcc("perso"), toCents(cost), "EUR", `Loisirs : ${a.name}`);
  apply(s, a.m * tired, a.p * (a.p > 0 ? tired : 1), a.so * tired, a.f * tired);
  if (l.partner) l.partner.bond = bar(l.partner.bond + (a.id === "amour" ? 14 : ["weekend", "resto", "concert", "cine", "famille", "enfants"].includes(a.id) ? 4 : 0) * tired);
  if (a.id === "club") s.career.stress = clamp(s.career.stress + 2, 0, 100);
  else s.career.stress = clamp(s.career.stress - Math.max(0, a.m) * 0.6 * tired, 0, 100);
  lg(s, `${a.emoji} ${a.name}${cost ? ` (−${cost} €)` : ""}`);
  return { ok: true as const, message: `${a.emoji} ${a.name}${tired < 1 ? " — un peu moins d'effet, vous l'avez déjà fait cette semaine" : ""}.` };
}

// ───────────── Budget mensuel ─────────────
/** Impôt sur le revenu annuel (barème progressif simplifié, une part, abattement de 10 %) */
export function incomeTax(s: GameState, netAnnual: number) {
  const k = priceLevel(s);
  const taxable = netAnnual * 0.9;
  const br: [number, number][] = [[11300 * k, 0], [28800 * k, 0.11], [82300 * k, 0.3], [177100 * k, 0.41], [Infinity, 0.45]];
  let tax = 0, low = 0;
  for (const [hi, r] of br) { if (taxable > low) tax += (Math.min(taxable, hi) - low) * r; low = hi; }
  return Math.round(tax);
}
export function payslip(s: GameState) {
  const gross = s.career.salaryAnnual / 100 / 12;
  const social = gross * 0.23;
  const net = gross - social;
  const tax = incomeTax(s, net * 12) / 12;
  return { gross: Math.round(gross), social: Math.round(social), net: Math.round(net), tax: Math.round(tax), netAfterTax: Math.round(net - tax) };
}
export function monthlyBills(s: GameState): [string, number][] {
  const l = s.life!;
  const k = priceLevel(s);
  const h = HOUSING_BY_ID[l.housing.id];
  const out: [string, number][] = [];
  if (l.housing.owned && l.housing.mortgage) out.push([`Mensualité du crédit immobilier (${(l.housing.mortgage.rate * 100).toFixed(2).replace(".", ",")} %, encore ${l.housing.mortgage.monthsLeft} mois)`, l.housing.mortgage.monthly / 100]);
  else if (!l.housing.owned) out.push([`Loyer — ${h.name}`, rentOf(s, h.id)]);
  if (l.housing.owned) out.push(["Taxe foncière et charges de copropriété", Math.round(((l.housing.value ?? 0) / 100) * 0.012 / 12)]);
  out.push(["Électricité, chauffage, eau, internet", Math.round((60 + 28 * h.comfort) * k)]);
  out.push(["Courses et alimentation", Math.round(380 * k)]);
  out.push([TRANSPORT[l.transport].name + (h.commute && l.transport === "commun" ? " (abonnement grande banlieue)" : ""), Math.round(TRANSPORT[l.transport].cost * k * (h.commute && l.transport === "commun" ? 1.4 : 1))]);
  out.push(["Téléphone", Math.round(25 * k)]);
  if (l.children) out.push([`Enfants : garde, cantine, vêtements (${l.children})`, Math.round(650 * l.children * k)]);
  if (l.pets) out.push([`Animal de compagnie (${l.pets})`, Math.round(40 * l.pets * k)]);
  for (const [key, sub] of Object.entries(SUBS) as [keyof LifeState["subs"], (typeof SUBS)[keyof typeof SUBS]][]) if (l.subs[key]) out.push([sub.name, Math.round(sub.cost * k)]);
  return out;
}

/** Prélèvements du début de mois (après le versement du salaire) */
export function monthlyLife(s: GameState) {
  if (!lifeOn(s)) return;
  const l = s.life!;
  const bills = monthlyBills(s);
  const total = bills.reduce((a, [, v]) => a + v, 0);
  for (const [label, v] of bills) if (v > 0) post(s, EXT_LIVING, cashAcc("perso"), toCents(v), "EUR", `Facture : ${label}`);
  // Crédit immobilier : amortissement et valeur du bien
  const mg = l.housing.mortgage;
  if (l.housing.owned && mg && mg.monthsLeft > 0) {
    const interest = Math.round(mg.principal * mg.rate / 12);
    mg.principal = Math.max(0, mg.principal - (mg.monthly - interest));
    mg.monthsLeft--;
    if (mg.monthsLeft === 0 || mg.principal <= 0) { l.housing.mortgage = undefined; notify(s, "succes", "Crédit immobilier remboursé", "Votre logement vous appartient entièrement.", "/play/vie"); lg(s, "🏠 Dernière mensualité payée : le logement est à vous."); }
  }
  if (l.housing.owned && l.housing.value) {
    const z = s.macro.zones.EZ;
    const reg = s.macro.regime;
    const yearly = z.inflation / 100 + 0.01 + (reg === "crise" || reg === "recession" ? -0.06 : reg === "bulle" ? 0.04 : 0) - Math.max(0, z.y10 - 3) * 0.01;
    l.housing.value = Math.round(l.housing.value * (1 + yearly / 12));
  }
  // Impayés
  const cash = eurCash(s);
  const limit = -Math.max(1500, payslip(s).netAfterTax);
  if (cash < limit) {
    l.unpaid++;
    apply(s, -10, 0, -2, -3);
    notify(s, "critique", "Incident de paiement", `Votre découvert dépasse l'autorisation : ${l.unpaid} mois d'impayés. Réduisez vos dépenses ou trouvez de l'argent.`, "/play/vie");
    lg(s, `⚠️ Factures impayées (${l.unpaid} mois)`);
    if (l.unpaid >= 3) evict(s);
  } else if (l.unpaid > 0) { l.unpaid = 0; lg(s, "✅ Situation bancaire régularisée."); }
  monthlyRealEstate(s, new Rng(s.rng));
  l.budget.unshift({ month: dateOf(s.t).getUTCMonth() + 12 * (dateOf(s.t).getUTCFullYear() - EPOCH_YEAR), bills: total, net: payslip(s).netAfterTax });
  if (l.budget.length > 24) l.budget.length = 24;
}

function evict(s: GameState) {
  const l = s.life!;
  if (l.housing.owned) { sellHousing(s, true); lg(s, "🏚️ Saisie : votre logement a été vendu aux enchères."); }
  l.housing = { id: "coloc", owned: false, since: s.t };
  l.unpaid = 0;
  apply(s, -20, -5, -8, -10);
  s.career.stress = clamp(s.career.stress + 15, 0, 100);
  notify(s, "critique", "Expulsion", "Après trois mois d'impayés, vous devez quitter votre logement pour une chambre en colocation.", "/play/vie");
  lg(s, "🏚️ Expulsé : retour en colocation.");
}

// ───────────── Logement : déménager, acheter, vendre ─────────────
export function mortgageRate(s: GameState) { return Math.max(0.01, (s.macro.zones.EZ.y10 + 1.3) / 100); }
export function moveHousing(s: GameState, id: string, buy: boolean) {
  if (!lifeOn(s)) return { ok: false as const, error: "Mode carrière uniquement." };
  const l = s.life!;
  const h = HOUSING_BY_ID[id];
  if (!h) return { ok: false as const, error: "Logement inconnu." };
  if (l.housing.id === id && l.housing.owned === buy) return { ok: false as const, error: "Vous y habitez déjà." };
  if (s.t - l.housing.since < 30 * MIN_PER_DAY) return { ok: false as const, error: "Vous avez déménagé il y a moins d'un mois." };
  const cash = eurCash(s);
  if (buy) {
    const price = priceOf(s, id);
    if (price === null) return { ok: false as const, error: "Ce logement ne s'achète pas." };
    if (!s.career.employed) return { ok: false as const, error: "Sans emploi, aucune banque ne vous prêtera." };
    const fees = Math.round(price * 0.075), down = Math.round(price * 0.1);
    // Vendre l'ancien logement d'abord
    const saleNet = l.housing.owned ? Math.max(0, (l.housing.value ?? 0) / 100 * 0.95 - (l.housing.mortgage?.principal ?? 0) / 100) : 0;
    if (cash + saleNet < fees + down) return { ok: false as const, error: `Apport insuffisant : il faut ${(fees + down).toLocaleString("fr-FR")} € (10 % d'apport + 7,5 % de frais de notaire).` };
    const loan = price - down;
    const rate = mortgageRate(s), n = 240;
    const monthly = Math.round(loan * (rate / 12) / (1 - Math.pow(1 + rate / 12, -n)));
    const income = payslip(s).net;
    if (monthly > income * 0.35) return { ok: false as const, error: `Refus de la banque : la mensualité (${monthly.toLocaleString("fr-FR")} €) dépasserait 35 % de vos revenus nets (${Math.round(income).toLocaleString("fr-FR")} €).` };
    if (l.housing.owned) sellHousing(s);
    post(s, EXT_LIVING, cashAcc("perso"), toCents(fees + down), "EUR", `Achat — ${h.name} : apport et frais de notaire`);
    l.housing = { id, owned: true, since: s.t, value: toCents(price), mortgage: { principal: toCents(loan), rate, monthly: toCents(monthly), monthsLeft: n } };
    logDecision(s, "patrimoine", `Achat : ${h.name} pour ${price.toLocaleString("fr-FR")} € (crédit de ${loan.toLocaleString("fr-FR")} € sur 20 ans à ${(rate * 100).toFixed(2)} %)`);
    lg(s, `🔑 Achat : ${h.name} (${price.toLocaleString("fr-FR")} €)`);
    apply(s, 6, 0, 2, 8);
    return { ok: true as const, message: `Félicitations, vous êtes propriétaire ! Mensualité : ${monthly.toLocaleString("fr-FR")} € pendant 20 ans.` };
  }
  const rent = rentOf(s, id);
  const deposit = rent + Math.round(600 * priceLevel(s));
  if (l.housing.owned) sellHousing(s);
  if (eurCash(s) < deposit) return { ok: false as const, error: `Il faut ${deposit.toLocaleString("fr-FR")} € (dépôt de garantie et déménagement).` };
  post(s, EXT_LIVING, cashAcc("perso"), toCents(deposit), "EUR", `Déménagement — ${h.name} : dépôt de garantie et déménageurs`);
  const before = HOUSING_BY_ID[l.housing.id].comfort;
  l.housing = { id, owned: false, since: s.t };
  apply(s, (h.comfort - before) * 3, 0, 0, (h.comfort - before) * 2);
  lg(s, `📦 Emménagement : ${h.name} (${rent.toLocaleString("fr-FR")} €/mois)`);
  return { ok: true as const, message: `Bienvenue dans votre ${h.name.toLowerCase()} : loyer ${rent.toLocaleString("fr-FR")} € par mois.` };
}
export function sellHousing(s: GameState, forced = false) {
  const l = s.life!;
  if (!l.housing.owned) return { ok: false as const, error: "Vous êtes locataire." };
  const value = (l.housing.value ?? 0) / 100 * (forced ? 0.8 : 0.95);
  const debt = (l.housing.mortgage?.principal ?? 0) / 100;
  const netv = Math.round(value - debt);
  if (netv >= 0) post(s, cashAcc("perso"), EXT_LIVING, toCents(netv), "EUR", `Vente du logement (prix ${Math.round(value).toLocaleString("fr-FR")} €, crédit soldé ${Math.round(debt).toLocaleString("fr-FR")} €)`);
  else post(s, EXT_LIVING, cashAcc("perso"), toCents(-netv), "EUR", "Vente du logement à perte : solde du crédit");
  l.housing = { id: "coloc", owned: false, since: s.t };
  return { ok: true as const, message: `Logement vendu : ${netv.toLocaleString("fr-FR")} € nets.` };
}
export function setTransport(s: GameState, mode: LifeState["transport"]) { if (!lifeOn(s)) return { ok: false as const, error: "Mode carrière uniquement." }; s.life!.transport = mode; lg(s, `🚗 Transport : ${TRANSPORT[mode].name}`); return { ok: true as const, message: `${TRANSPORT[mode].name} : ${Math.round(TRANSPORT[mode].cost * priceLevel(s))} € par mois.` }; }
export function setSub(s: GameState, key: keyof LifeState["subs"], on: boolean) { if (!lifeOn(s)) return { ok: false as const, error: "Mode carrière uniquement." }; s.life!.subs[key] = on; return { ok: true as const, message: `${SUBS[key].name} : ${on ? "souscrit" : "résilié"}.` }; }
/** Valeur nette du logement (bien − crédit restant), comptée dans le patrimoine */
export function housingEquity(s: GameState) { const l = s.life; if (!l) return 0; return (l.housing.owned ? ((l.housing.value ?? 0) - (l.housing.mortgage?.principal ?? 0)) / 100 : 0) + propertiesEquity(s); }

// ───────────── Chaque jour ─────────────
const colleague = (s: GameState, rng: Rng) => { const ids = ["colleague", "senior", "analyst", "risk"].filter((x) => s.npcs[x]); const id = rng.pick(ids); s.flags["storyNpc"] = id; return s.npcs[id]; };
const LIFE_EVENTS: { id: string; w: (s: GameState) => number; fire: (s: GameState, rng: Rng) => void }[] = [
  { id: "collegue_divorce", w: (s) => (s.career.employed ? 0.5 : 0), fire: (s, rng) => { const n = colleague(s, rng); choice(s, "collegue_divorce", `${n.name} traverse un divorce`, `${n.name} (${n.role}) vous confie traverser un divorce difficile et vous demande de prendre le relais sur un dossier cette semaine.`, [["Apporter votre soutien et reprendre le dossier", "go"], ["Expliquer que vous êtes débordé", "no"]]); } },
  { id: "collegue_bebe", w: (s) => (s.career.employed ? 0.6 : 0), fire: (s, rng) => { const n = colleague(s, rng); choice(s, "collegue_bebe", `${n.name} vient d'être parent`, `L'équipe organise une cagnotte (30 €) pour la naissance du bébé de ${n.name}.`, [["Participer", "go"], ["Ne pas participer", "no"]]); } },
  { id: "collegue_burnout", w: (s) => (s.career.employed ? 0.35 : 0), fire: (s, rng) => { const n = colleague(s, rng); choice(s, "collegue_burnout", `${n.name} est en arrêt pour épuisement`, `${n.name} est en arrêt pour trois semaines. Votre responsable demande qui peut reprendre une partie de ses dossiers.`, [["Se porter volontaire", "go"], ["Ne pas se proposer", "no"]]); } },
  { id: "collegue_pot", w: (s) => (s.career.employed ? 0.7 : 0), fire: (s, rng) => { const n = colleague(s, rng); choice(s, "collegue_pot", `Pot de départ de ${n.name} ?`, `${n.name} fête sa promotion ce soir dans un bar près de la banque.`, [["Y passer", "go"], ["Rentrer chez soi", "no"]]); } },
  { id: "panne", w: () => 1, fire: (s, rng) => { const l = s.life!; const cost = Math.round(rng.range(250, 900) * priceLevel(s)); const pay = l.housing.owned ? cost : Math.round(cost * 0.1); post(s, EXT_LIVING, cashAcc("perso"), toCents(pay), "EUR", "Réparation imprévue (chauffe-eau, électroménager)"); apply(s, -3, 0, 0, -1); notify(s, "alerte", "Panne à la maison", `${l.housing.owned ? "Propriétaire, vous payez tout" : "Votre propriétaire prend l'essentiel en charge"} : ${pay} € à votre charge.`, "/play/vie"); lg(s, `🔧 Panne à la maison (−${pay} €)`); } },
  { id: "degat", w: () => 0.4, fire: (s) => { const l = s.life!; const cost = Math.round((l.subs.assurance ? 150 : 1800) * priceLevel(s)); post(s, EXT_LIVING, cashAcc("perso"), toCents(cost), "EUR", `Dégât des eaux${l.subs.assurance ? " (franchise de l'assurance)" : " (non assuré)"}`); apply(s, -5, 0, 0, -2); notify(s, l.subs.assurance ? "info" : "critique", "Dégât des eaux", l.subs.assurance ? `Votre assurance couvre tout sauf la franchise : ${cost} €.` : `Sans assurance habitation, la facture est lourde : ${cost} €.`, "/play/vie"); lg(s, `💧 Dégât des eaux (−${cost} €)`); } },
  { id: "grippe", w: () => 0.8, fire: (s) => { const l = s.life!; const cost = Math.round((l.subs.mutuelle ? 25 : 180) * priceLevel(s)); post(s, EXT_LIVING, cashAcc("perso"), toCents(cost), "EUR", `Médecin et pharmacie${l.subs.mutuelle ? "" : " (sans mutuelle)"}`); apply(s, -4, -15, -2, -3); s.career.stress = clamp(s.career.stress + 4, 0, 100); notify(s, "alerte", "Vous êtes malade", `Une mauvaise grippe : forme en berne. Frais restant à votre charge : ${cost} €.`, "/play/vie"); lg(s, "🤒 Grippe"); } },
  { id: "amende", w: (s) => (s.life!.transport === "occasion" || s.life!.transport === "neuve" ? 1 : 0), fire: (s) => { const c = Math.round(135 * priceLevel(s)); post(s, EXT_LIVING, cashAcc("perso"), toCents(c), "EUR", "Amende de stationnement"); apply(s, -2, 0, 0, -1); lg(s, `🚓 Amende (−${c} €)`); } },
  { id: "mariage", w: () => 0.6, fire: (s) => choice(s, "mariage", "Un ami proche se marie", "Votre meilleur ami se marie dans trois semaines, à 500 km. Le voyage, l'hôtel et le cadeau coûteront environ 400 €.", [["Y aller", "go"], ["Décliner poliment", "no"]]) },
  { id: "anniv", w: () => 0.8, fire: (s) => choice(s, "anniv", "Anniversaire de votre mère", "Votre mère fête ses 60 ans ce week-end. Toute la famille sera là.", [["Y aller (une journée, ~80 €)", "go"], ["Appeler seulement", "no"]]) },
  { id: "weekend_amis", w: () => 0.7, fire: (s) => choice(s, "weekend_amis", "Week-end entre amis", "Vos amis louent une maison pour le week-end prochain. Part de chacun : environ 420 €.", [["Je viens !", "go"], ["Pas cette fois", "no"]]) },
  { id: "demenagement_ami", w: () => 0.5, fire: (s) => choice(s, "demenagement_ami", "Un ami déménage", "Un ami vous demande un coup de main samedi pour porter des cartons.", [["Aider (une journée)", "go"], ["Refuser", "no"]]) },
  { id: "concert", w: () => 0.7, fire: (s) => choice(s, "concert", "Places de concert", "Un ami a deux places pour le concert de votre groupe préféré vendredi soir (90 € la place). Mais vous avez une présentation importante samedi matin.", [["Y aller", "go"], ["Rester préparer la présentation", "no"]]) },
  { id: "adoption", w: (s) => (s.life!.pets ? 0 : 0.35), fire: (s) => choice(s, "adoption", "Un chaton cherche une famille", "Une voisine cherche quelqu'un pour adopter un chaton. Vétérinaire et nourriture : environ 40 € par mois.", [["L'adopter", "go"], ["Refuser", "no"]]) },
  { id: "parent_malade", w: () => 0.3, fire: (s) => choice(s, "parent_malade", "Votre père est hospitalisé", "Votre père a fait un malaise et passe quelques jours à l'hôpital, à 300 km. Il aimerait vous voir.", [["Prendre deux jours pour aller le voir", "go"], ["Appeler tous les soirs", "no"]]) },
  { id: "marathon", w: (s) => (s.life!.physique >= 55 ? 0.4 : 0), fire: (s) => choice(s, "marathon", "Un semi-marathon caritatif", "Des collègues montent une équipe pour un semi-marathon au profit d'une association (inscription 45 €). Il faudra s'entraîner deux soirs par semaine.", [["S'inscrire", "go"], ["Les encourager depuis le bord", "no"]]) },
  { id: "vol_tel", w: () => 0.35, fire: (s) => { const l = s.life!; const cost = Math.round((l.subs.assurance ? 90 : 650) * priceLevel(s)); post(s, EXT_LIVING, cashAcc("perso"), toCents(cost), "EUR", `Téléphone volé${l.subs.assurance ? " (franchise)" : ""}`); apply(s, -4, 0, 0, -3); notify(s, "alerte", "On vous a volé votre téléphone", `Dans le métro. ${l.subs.assurance ? "L'assurance rembourse l'essentiel" : "Sans assurance, il faut tout racheter"} : ${cost} €.`, "/play/vie"); lg(s, `📱 Téléphone volé (−${cost} €)`); } },
  { id: "remboursement_impot", w: () => 0.3, fire: (s) => { const gain = Math.round(rngGain(s) * priceLevel(s)); post(s, cashAcc("perso"), "ext:fisc", toCents(gain), "EUR", "Remboursement d'impôt"); apply(s, 3, 0, 0, 2); notify(s, "succes", "Bonne surprise des impôts", `Un trop-perçu vous est remboursé : ${gain} €.`, "/play/vie"); lg(s, `🧾 Remboursement d'impôt (+${gain} €)`); } },
  { id: "benevolat", w: () => 0.4, fire: (s) => choice(s, "benevolat", "Bénévolat le samedi", "Une association de quartier cherche des bénévoles pour aider des jeunes à préparer leur budget, un samedi par mois.", [["Accepter", "go"], ["Pas le temps", "no"]]) },
  { id: "voyage_derniere", w: () => 0.45, fire: (s) => choice(s, "voyage_derniere", "Voyage de dernière minute", "Une offre à 650 € : quatre jours au soleil le week-end prochain, avec un jour de congé à poser.", [["Réserver !", "go"], ["Laisser passer", "no"]]) },
];
const rngGain = (s: GameState) => 150 + (s.seq % 7) * 60;
function choice(s: GameState, ev: string, subject: string, body: string, opts: [string, string][]) {
  s.messages.unshift({ id: nextId(s, "msg"), t: s.t, from: "Vie privée", subject, body, read: false, actions: opts.map(([label, c]) => ({ label, action: "life_choice", payload: { ev, choice: c } })) });
  notify(s, "info", subject, "Une décision personnelle vous attend dans la messagerie.", "/play/messagerie");
}
/** Vie sentimentale et familiale : rencontre, entretien du lien, mariage, enfants, rupture */
const FIRST_NAMES = ["Camille", "Alex", "Sacha", "Charlie", "Lou", "Noa", "Maël", "Eden", "Andréa", "Morgan", "Jules", "Inès", "Léo", "Clara", "Hugo", "Sarah"];
function dailyLove(s: GameState, rng: Rng) {
  const l = s.life!;
  const p = l.partner;
  if (!p) {
    if (l.social >= 55 && rng.chance(0.01) && !s.messages.some((m) => !m.handled && m.actions?.some((a) => a.payload?.ev === "rencontre"))) {
      const name = rng.pick(FIRST_NAMES);
      s.flags["metName"] = name;
      choice(s, "rencontre", `Une rencontre : ${name}`, `Lors d'une soirée, vous avez longuement discuté avec ${name}. Le courant passe très bien, et ${name} vous propose de vous revoir.`, [["Accepter un rendez-vous", "go"], ["Pas le moment, le travail d'abord", "no"]]);
    }
    return;
  }
  p.bond = bar(p.bond - (s.career.stress > 70 ? 1.6 : 1));
  if (p.bond >= 60) l.mental = bar(l.mental + 0.3);
  if ((l.children ?? 0) > 0) { l.mental = bar(l.mental + 0.15 * (l.children ?? 0)); l.physique = bar(l.physique - 0.1); }
  if (p.bond < 12) {
    notify(s, "critique", `Rupture avec ${p.name}`, "Vous ne vous voyiez plus. La séparation est douloureuse.", "/play/vie");
    lg(s, `💔 Rupture avec ${p.name}`);
    apply(s, -20, 0, -10, -10); s.career.stress = clamp(s.career.stress + 10, 0, 100);
    l.partner = undefined; return;
  }
  const years = (s.t - p.since) / (365 * MIN_PER_DAY);
  if (!p.married && p.bond >= 80 && years >= 1 && rng.chance(0.004)) choice(s, "mariage_soi", `Et si vous vous mariiez avec ${p.name} ?`, `Cela fait plus d'un an que vous êtes ensemble. ${p.name} évoque l'idée d'un mariage (environ 15 000 € de cérémonie).`, [["Dire oui !", "go"], ["Pas maintenant", "no"]]);
  if ((l.children ?? 0) < 3 && p.bond >= 70 && years >= 1.5 && rng.chance(0.003)) choice(s, "enfant", "Un projet d'enfant", `${p.name} aimerait agrandir la famille. Un enfant, c'est de la joie… et moins de temps libre, plus de dépenses (garde, cantine…).`, [["Oui, fondons une famille", "go"], ["Pas encore", "no"]]);
}
export function lifeChoice(s: GameState, ev: string, c: string): string {
  if (!s.life) return "";
  const k = priceLevel(s);
  const pay = (v: number, memo: string) => post(s, EXT_LIVING, cashAcc("perso"), toCents(Math.round(v * k)), "EUR", memo);
  const go = c === "go";
  switch (ev) {
    case "mariage": if (go) { pay(400, "Mariage d'un ami : voyage et cadeau"); apply(s, 6, -2, 14, 10); lg(s, "💍 Mariage d'un ami"); return "Une journée inoubliable. Votre ami est touché."; } apply(s, -3, 0, -10, -2); return "Votre ami est déçu.";
    case "anniv": if (go) { pay(80, "Cadeau d'anniversaire"); apply(s, 5, 0, 8, 4); lg(s, "🎂 Anniversaire en famille"); return "Votre mère est ravie de vous voir."; } apply(s, -2, 0, -5, 0); return "Elle comprend… mais aurait préféré vous voir.";
    case "weekend_amis": if (go) { pay(420, "Week-end entre amis"); apply(s, 8, 2, 12, 15); s.career.stress = clamp(s.career.stress - 8, 0, 100); lg(s, "🏡 Week-end entre amis"); return "Deux jours de rires : vous revenez rechargé."; } apply(s, -1, 0, -6, -2); return "Vous restez chez vous.";
    case "rencontre": if (go) { const name = String(s.flags["metName"] ?? "Camille"); s.life.partner = { name, since: s.t, bond: 55 }; apply(s, 8, 0, 6, 8); lg(s, `❤️ Début d'une histoire avec ${name}`); return `Premier rendez-vous réussi avec ${name}. Entretenez votre relation : soirées en amoureux, sorties à deux.`; } return "Vous restez concentré sur votre carrière.";
    case "mariage_soi": if (go && s.life.partner) { pay(15000, `Mariage avec ${s.life.partner.name}`); s.life.partner.married = true; s.life.partner.bond = 100; apply(s, 15, 0, 15, 15); lg(s, `💍 Mariage avec ${s.life.partner.name}`); return "Un mariage magnifique, entouré de vos proches."; } if (s.life.partner) s.life.partner.bond = bar(s.life.partner.bond - 10); return "Votre partenaire comprend, mais la déception se lit dans son regard.";
    case "enfant": if (go) { s.life.children = (s.life.children ?? 0) + 1; apply(s, 12, -4, 6, 10); lg(s, "👶 Naissance d'un enfant"); notify(s, "succes", "Naissance !", "Félicitations : votre famille s'agrandit. Prévoyez la garde et un peu moins de temps libre.", "/play/vie"); return "Neuf mois plus tard… félicitations !"; } if (s.life.partner) s.life.partner.bond = bar(s.life.partner.bond - 6); return "Vous en reparlerez plus tard.";
    case "collegue_divorce": { const id = String(s.flags["storyNpc"] ?? "colleague"); if (go) { s.career.stress = clamp(s.career.stress + 5, 0, 100); changeTrust(s, id, 10, "Vous l'avez soutenu pendant son divorce"); return "Votre collègue vous en sera longtemps reconnaissant·e."; } changeTrust(s, id, -4, "Pas de soutien pendant son divorce"); return "Votre collègue comprend… mais s'en souviendra."; }
    case "collegue_bebe": { const id = String(s.flags["storyNpc"] ?? "colleague"); if (go) { pay(30, "Cagnotte naissance d'un collègue"); changeTrust(s, id, 4, "Cadeau de naissance"); apply(s, 1, 0, 2, 1); return "Votre geste fait chaud au cœur."; } changeTrust(s, id, -1); return "Vous ne participez pas."; }
    case "collegue_burnout": { const id = String(s.flags["storyNpc"] ?? "colleague"); if (go) { s.career.stress = clamp(s.career.stress + 8, 0, 100); changeTrust(s, id, 12, "A repris ses dossiers pendant son arrêt"); changeTrust(s, "boss", 3, "Esprit d'équipe"); return "Semaine chargée, mais l'équipe vous en est reconnaissante."; } changeTrust(s, "boss", -2, "Manque d'esprit d'équipe"); return "Le responsable répartit les dossiers autrement."; }
    case "collegue_pot": { const id = String(s.flags["storyNpc"] ?? "colleague"); if (go) { apply(s, 2, -1, 6, 4); changeTrust(s, id, 3, "Présent à son pot"); s.career.stress = clamp(s.career.stress - 2, 0, 100); return "Bonne ambiance : vous apprenez au passage deux ou trois choses sur la banque."; } return "Vous rentrez directement."; }
    case "concert": if (go) { pay(90, "Concert"); apply(s, 7, -1, 6, 14); s.career.stress = clamp(s.career.stress + 3, 0, 100); lg(s, "🎸 Concert"); return "Une soirée géniale… et une présentation préparée un peu vite."; } apply(s, -1, 0, -3, -4); gainXp(s, "client", 8, "Présentation bien préparée"); return "Votre présentation sera impeccable."; 
    case "adoption": if (go) { s.life.pets = (s.life.pets ?? 0) + 1; apply(s, 8, 1, 2, 8); lg(s, "🐱 Adoption d'un chaton"); return "Un nouveau compagnon à la maison : il vous accueille chaque soir."; } return "La voisine trouvera quelqu'un d'autre.";
    case "parent_malade": if (go) { pay(120, "Voyage pour voir votre père"); apply(s, 4, -2, 10, 0); changeTrust(s, "boss", -1, "Absence imprévue"); lg(s, "🏥 Visite à votre père"); return "Votre père est rassuré de vous voir. Il se remet bien."; } apply(s, -6, 0, -4, -2); return "Il comprend, mais vous culpabilisez un peu.";
    case "marathon": if (go) { pay(45, "Inscription semi-marathon"); apply(s, 5, 10, 8, 6); s.flags["fitBoost"] = s.t; changeTrust(s, "colleague", 3, "Équipe du semi-marathon"); lg(s, "🏃 Semi-marathon caritatif"); return "21 km bouclés avec vos collègues. Fierté et courbatures."; } return "Vous les applaudissez à l'arrivée.";
    case "benevolat": if (go) { apply(s, 6, 0, 7, 5); changeRep(s, "professionnelle", 1, "Engagement associatif"); lg(s, "🤝 Bénévolat"); return "Aider des jeunes à gérer leur budget vous donne du sens."; } return "Peut-être une autre fois.";
    case "voyage_derniere": if (go) { pay(650, "Voyage de dernière minute"); apply(s, 12, 4, 4, 18); s.career.stress = clamp(s.career.stress - 12, 0, 100); lg(s, "🌴 Voyage au soleil"); return "Quatre jours de soleil : vous revenez reposé."; } return "Vous gardez votre argent.";
    case "demenagement_ami": if (go) { apply(s, 2, -3, 9, 1); lg(s, "📦 Coup de main à un ami"); return "Courbatures, mais un ami reconnaissant."; } apply(s, 0, 0, -5, 0); return "Votre ami se débrouillera sans vous.";
  }
  return "";
}

export function dailyLife(s: GameState, rng: Rng) {
  if (!lifeOn(s)) return;
  const l = s.life!;
  const c = s.career;
  const weekend = isWeekend(s.t);
  const vac = !!s.flags["vacationUntil"] && s.t < (s.flags["vacationUntil"] as number);
  const h = HOUSING_BY_ID[l.housing.id];
  // Usure naturelle : sans entretien, les jauges baissent
  l.social = bar(l.social - 1.4);
  l.fun = bar(l.fun - 1.6);
  l.physique = bar(l.physique - (l.transport === "velo" ? 0.1 : 0.45) + (l.subs.sport ? 0.15 : 0));
  let dm = 0;
  if (!weekend && !vac && c.employed) dm -= 0.35 + Math.max(0, c.stress - 35) / 25 + (h.commute && !l.perks.teletravail ? 0.4 : 0);
  if (weekend || vac) dm += 1.2;
  dm += (h.comfort - 2) * 0.15 + (l.perks.teletravail ? 0.25 : 0) + (l.subs.streaming ? 0.1 : 0);
  if (l.social < 25) dm -= 0.8;
  if (l.fun < 25) dm -= 0.8;
  if (l.physique < 25) dm -= 0.5;
  if (l.unpaid > 0) dm -= 1.5;
  if (eurCash(s) < 0) dm -= 0.6;
  l.mental = bar(l.mental + dm);
  // Retour sur le travail : moral et forme pèsent sur le stress et l'énergie
  if (c.employed) {
    if (l.mental < 35) c.stress = clamp(c.stress + (35 - l.mental) / 10, 0, 100);
    c.energy = clamp((100 - c.stress * 0.8) * 0.6 + l.physique * 0.4, 5, 100);
  }
  // Alertes au franchissement des seuils
  for (const [k, label, tip] of [["mental", "Santé mentale", "Prenez du temps pour vous : voyez des amis, faites du sport, consultez si besoin."], ["physique", "Forme physique", "Faites du sport et reposez-vous."], ["social", "Vie sociale", "Vos amis ne vous voient plus : appelez-les, sortez."], ["fun", "Épanouissement", "Faites-vous plaisir de temps en temps."]] as const) {
    const v = l[k], flag = `lifeLow_${k}`;
    if (v < 25 && !s.flags[flag]) { s.flags[flag] = true; notify(s, k === "mental" ? "critique" : "alerte", `${label} au plus bas (${Math.round(v)}/100)`, tip, "/play/vie"); }
    if (v >= 35) delete s.flags[flag];
  }
  if (l.mental <= 8 && !s.flags["burnoutUntil"]) c.stress = Math.max(c.stress, 93); // déclenche l'arrêt pour épuisement
  dailyRealEstate(s, rng);
  dailyLove(s, rng);
  // Événements de la vie (environ un par semaine)
  if (rng.chance(0.14)) {
    const pool = LIFE_EVENTS.filter((e) => e.w(s) > 0 && s.t - ((s.eventCooldowns[`life_${e.id}`] as number) ?? -1e9) > 45 * MIN_PER_DAY);
    if (pool.length) { const e = rng.weighted(pool.map((x) => ({ item: x, w: x.w(s) }))); s.eventCooldowns[`life_${e.id}`] = s.t; e.fire(s, rng); }
  }
}

/** Effet de la vie privée sur l'évaluation au travail (fatigue, erreurs, manque de concentration) */
export function lifePerformanceAdj(s: GameState) { const l = s.life; if (!l || !lifeOn(s)) return 0; return -(Math.max(0, 40 - l.mental) * 0.3 + Math.max(0, 30 - l.physique) * 0.15); }
export const fmtE = (v: number) => `${Math.round(v).toLocaleString("fr-FR")} €`;
export { fromCents };

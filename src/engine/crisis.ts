/**
 * Moteur de crises : chaque crise a une cause, des phases successives et des conséquences durables.
 * Des signaux faibles précèdent les phases aiguës (actualités, spreads, stress des émetteurs).
 */
import type { CrisisKind, CrisisState, GameState } from "./types";
import { Rng } from "./rng";
import { applyShock, shockFx } from "./market";
import { setRegime } from "./macro";
import { defaultBond } from "./corporate";
import { nextId, notify, pushNews, pause } from "./core";
import { dayIndex, MIN_PER_DAY, minuteOfDay, isWeekend, fmtTime } from "./time";
import { addAgendaItem } from "./agenda";

export const CRISIS_LABELS: Record<CrisisKind, string> = {
  liquidite_bancaire: "Crise de liquidité bancaire", krach: "Krach boursier", hausse_taux: "Choc de taux", bulle_tech: "Éclatement de la bulle technologique",
  crise_energie: "Crise énergétique", defaut_souverain: "Crise de la dette souveraine", crise_change: "Crise de change", faillite_entreprise: "Effondrement d'une entreprise majeure",
  recession: "Récession mondiale", inflation: "Inflation incontrôlée", immobilier: "Crise immobilière",
};

function addLog(c: CrisisState, t: number, text: string) { c.log.push({ t, text }); }
export function activeCrises(s: GameState) { return s.crises.filter((c) => !c.resolved); }

export function startCrisis(s: GameState, kind: CrisisKind, rng: Rng, target?: string): CrisisState {
  const c: CrisisState = { id: nextId(s, "cr"), kind, phase: 0, phaseSinceT: s.t, startT: s.t, target, severity: 0.4 + rng.next() * 0.4, resolved: false, log: [] };
  s.crises.push(c);
  addLog(c, s.t, "Apparition de signaux faibles.");
  weakSignal(s, c);
  return c;
}

function weakSignal(s: GameState, c: CrisisState) {
  switch (c.kind) {
    case "liquidite_bancaire": {
      const d = s.instruments[c.target!];
      s.quotes[c.target!].stress = Math.max(s.quotes[c.target!].stress, 0.18);
      pushNews(s, { category: "entreprises", title: `${d.name} : les moins-values latentes sur le portefeuille obligataire inquiètent`, body: `Selon des analystes, la hausse des taux a creusé les moins-values latentes du portefeuille de titres de ${d.name}. Les dépôts d'entreprises auraient reculé de 6 % sur le trimestre. Le CDS de l'établissement s'élargit.`, impact: "moyen", tickers: [c.target!], zones: [d.zone], sentiment: -0.4 });
      applyShock(s, { kind: "instrument", id: c.target! }, -0.06, 0.5);
      break;
    }
    case "krach": pushNews(s, { category: "marches", title: "Les valorisations atteignent des sommets historiques", body: "Le ratio cours/bénéfices moyen dépasse largement sa moyenne de long terme. Plusieurs gérants évoquent une « exubérance irrationnelle » et des positions à effet de levier record.", impact: "moyen", tickers: [], zones: ["US"], sentiment: -0.2 }); break;
    case "bulle_tech": pushNews(s, { category: "marches", title: "Introductions en bourse technologiques : la frénésie continue", body: "Les introductions de sociétés sans bénéfices se multiplient et doublent dès le premier jour. Les volumes sur options d'achat atteignent des records.", impact: "moyen", tickers: ["XTEC"], zones: ["US"], sentiment: 0.2 }); break;
    case "crise_energie": s.macro.geopolitics = Math.min(1, s.macro.geopolitics + 0.25); pushNews(s, { category: "geopolitique", title: "Tensions dans une région productrice de pétrole", body: "Des incidents sur une route maritime stratégique font craindre des perturbations de l'offre. Les assureurs relèvent leurs primes.", impact: "moyen", tickers: ["BRENT", "NGAS"], zones: [], sentiment: -0.3 }); break;
    case "defaut_souverain": pushNews(s, { category: "macro", title: "Dette italienne : les agences de notation placent la note sous surveillance", body: "Le déficit budgétaire dérape et les écarts de taux avec l'Allemagne s'élargissent.", impact: "moyen", tickers: ["IT10Y", "BADR"], zones: ["EZ"], sentiment: -0.4 }); s.macro.factors["spread_IT10Y"] = (s.macro.factors["spread_IT10Y"] ?? 0) + 40; break;
    case "hausse_taux": pushNews(s, { category: "banques_centrales", title: "L'inflation sous-jacente accélère, les banquiers centraux durcissent le ton", body: "Plusieurs membres du comité monétaire évoquent la possibilité d'un resserrement plus agressif.", impact: "moyen", tickers: [], zones: ["US", "EZ"], sentiment: -0.3 }); break;
    case "faillite_entreprise": { const d = s.instruments[c.target!]; s.quotes[c.target!].stress = 0.25; pushNews(s, { category: "entreprises", title: `${d.name} : un vendeur à découvert publie un rapport accablant`, body: `Le rapport met en cause la comptabilisation du chiffre d'affaires et l'endettement hors bilan de ${d.name}. La société dément.`, impact: "moyen", tickers: [d.id], zones: [d.zone], sentiment: -0.5 }); applyShock(s, { kind: "instrument", id: d.id }, -0.12, 1); break; }
    case "crise_change": pushNews(s, { category: "macro", title: "Fuite de capitaux : le yuan sous pression", body: "Les sorties de capitaux s'accélèrent ; la banque centrale puise dans ses réserves pour défendre la devise.", impact: "moyen", tickers: ["USDCNY"], zones: ["CN"], sentiment: -0.4 }); break;
    case "immobilier": pushNews(s, { category: "entreprises", title: "Immobilier de bureau : les taux de vacance grimpent", body: "Les foncières font face à des refinancements coûteux. Les valeurs d'expertise reculent.", impact: "moyen", tickers: ["FONC", "SKYL"], zones: ["US", "EZ"], sentiment: -0.4 }); applyShock(s, { kind: "sector", id: "Immobilier" }, -0.04, 0.3); break;
    default: break;
  }
}

/** Probabilités de déclenchement conditionnelles (appel journalier) */
export function maybeTriggerCrises(s: GameState, rng: Rng) {
  const day = dayIndex(s.t);
  const act = activeCrises(s);
  if (act.length >= 2) return;
  const has = (k: CrisisKind) => s.crises.some((c) => c.kind === k && (!c.resolved || day - dayIndex(c.startT) < 120));
  // Scénario garanti en mode carrière : crise de liquidité bancaire entre le 25e et le 55e jour
  const careerStartDay = s.flags["startDay"] as number;
  const scripted = s.flags["scriptedCrisisDay"] as number | undefined;
  if (s.mode === "carriere" && scripted !== undefined && day >= scripted && !has("liquidite_bancaire") && !s.flags["scriptedCrisisDone"]) {
    s.flags["scriptedCrisisDone"] = true;
    startCrisis(s, "liquidite_bancaire", rng, "PCBK");
    return;
  }
  const dy = (s.macro.zones.US.y10 - (s.macro.factors["y10_0_US"] ?? 4.1));
  const valuation = avgValuation(s);
  const weights: [CrisisKind, number, string?][] = [
    ["liquidite_bancaire", 0.0008 + Math.max(0, dy) * 0.004, rng.pick(["PCBK", "BADR"])],
    ["krach", 0.0004 + Math.max(0, valuation - 1.2) * 0.01],
    ["bulle_tech", s.macro.regime === "bulle" ? 0.006 : 0.0002],
    ["crise_energie", 0.0005 + s.macro.geopolitics * 0.002],
    ["defaut_souverain", 0.0003 + Math.max(0, s.macro.riskAversion - 0.5) * 0.003],
    ["hausse_taux", Math.max(0, s.macro.zones.US.inflation - 3.5) * 0.004 + Math.max(0, s.macro.zones.EZ.inflation - 3.5) * 0.004],
    ["faillite_entreprise", 0.0006, rng.pick(["CARV", "SKYL", "ELEC", "PIXA", "MTRA", "ACER"])],
    ["crise_change", 0.0003],
    ["immobilier", 0.0003 + Math.max(0, dy) * 0.002],
  ];
  if (careerStartDay !== undefined && day - careerStartDay < 20) return;
  for (const [k, p, target] of weights) {
    if (has(k)) continue;
    if (rng.chance(p)) { startCrisis(s, k, rng, target); return; }
  }
}
function avgValuation(s: GameState) {
  let n = 0, v = 0;
  for (const d of Object.values(s.instruments)) if (d.cls === "action") { const q = s.quotes[d.id]; if (q.fair) { v += q.price / q.fair; n++; } }
  return n ? v / n : 1;
}

/** Avancement des crises — appelé à chaque pas (vérifications horaires légères) */
export function stepCrises(s: GameState, rng: Rng) {
  for (const c of s.crises) {
    if (c.resolved) continue;
    const ageDays = (s.t - c.phaseSinceT) / MIN_PER_DAY;
    const m = minuteOfDay(s.t);
    if (isWeekend(s.t)) continue;
    switch (c.kind) {
      case "liquidite_bancaire": stepBankCrisis(s, c, rng, ageDays, m); break;
      default: stepGenericCrisis(s, c, rng, ageDays, m); break;
    }
  }
}

function advance(c: CrisisState, s: GameState, text: string) { c.phase++; c.phaseSinceT = s.t; addLog(c, s.t, text); }

function stepBankCrisis(s: GameState, c: CrisisState, rng: Rng, age: number, m: number) {
  const bank = s.instruments[c.target!];
  const q = s.quotes[c.target!];
  const zone = bank.zone;
  if (c.phase === 0 && age >= 5 && m === 14 * 60 + 40) {
    // 14 h 42 : annonce des difficultés de refinancement
    advance(c, s, "Annonce de difficultés de refinancement.");
    s.flags["crisisAlertT"] = s.t + 2;
    q.stress = 0.6;
    applyShock(s, { kind: "instrument", id: c.target! }, -0.32, 2.5, `Crise de liquidité ${bank.name}`);
    applyShock(s, { kind: "sector", id: "Banque" }, -0.07, 1.2, "Contagion bancaire");
    applyShock(s, { kind: "global", id: "*" }, -0.025, 0.6);
    applyShock(s, { kind: "sector", id: "Immobilier" }, -0.03, 0.5);
    for (const b of ["BADR", "UBCE", "PCBK", "LUTB", "HDMP"]) if (b !== c.target) s.quotes[b].stress = Math.max(s.quotes[b].stress, b === "BADR" || b === "UBCE" ? 0.22 : 0.1);
    s.macro.riskAversion = Math.min(1.2, s.macro.riskAversion + 0.3);
    s.macro.liquidity = Math.max(0.3, s.macro.liquidity - 0.2);
    s.macro.factors[`ypend_${zone}`] = (s.macro.factors[`ypend_${zone}`] ?? 0) - 0.12; // fuite vers la qualité
    shockFx(s, "JPY", 0.01); shockFx(s, "CHF", 0.008);
    pushNews(s, { category: "crises", title: `CRISE DE LIQUIDITÉ — 14 H 42 : ${bank.name} annonce des difficultés de refinancement`, body: `${bank.name} indique ne plus pouvoir renouveler une partie de ses financements de marché et étudie « toutes les options », y compris une augmentation de capital d'urgence. L'action chute, les spreads de crédit bancaires s'écartent, la volatilité bondit.`, impact: "fort", tickers: [c.target!, "XBNK"], zones: [zone], sentiment: -1 });
    notify(s, "critique", `CRISE DE LIQUIDITÉ — ${fmtTime(s.t + 2)}`, `${bank.name} annonce des difficultés de refinancement. Comité des risques convoqué en urgence.`, "/play/reunions");
    pause(s, `CRISE DE LIQUIDITÉ — ${bank.name} annonce des difficultés de refinancement.`);
    if (s.mode === "carriere" && s.career.employed) addAgendaItem(s, { t: s.t + 15, durationMin: 45, title: "Comité des risques — réunion de crise", kind: "reunion", meetingTemplate: "crise_liquidite", params: { bank: c.target!, crisis: c.id }, important: true });
    for (const cl of s.clients.filter((x) => !x.lost).slice(0, 1)) addAgendaItem(s, { t: s.t + 120, durationMin: 20, title: `Appel inquiet de ${cl.name}`, kind: "appel", meetingTemplate: "client_panique", params: { client: cl.id, bank: c.target! }, important: false });
    return;
  }
  if (c.phase === 1 && age >= 1 && m === 9 * 60 + 5) {
    advance(c, s, "Retraits massifs des déposants, contagion.");
    q.stress = 0.8;
    applyShock(s, { kind: "instrument", id: c.target! }, -0.25, 1.5, "Panique des déposants");
    applyShock(s, { kind: "sector", id: "Banque" }, -0.04, 0.6);
    s.quotes["BADR"].stress = Math.max(s.quotes["BADR"].stress, 0.3);
    pushNews(s, { category: "crises", title: `Files d'attente devant les agences de ${bank.name} : les retraits s'accélèrent`, body: "Les déposants retirent leurs fonds en ligne à un rythme inédit. La banque cède des obligations dans l'urgence, matérialisant des pertes. Les autres banques régionales sont attaquées en bourse.", impact: "fort", tickers: [c.target!, "BADR"], zones: [zone], sentiment: -1 });
    if (s.macro.regime !== "crise" && c.severity > 0.55) setRegime(s, "crise", "La contagion bancaire se propage.");
    return;
  }
  if (c.phase === 2 && age >= 2 && m === 8 * 60) {
    const rescue = rng.chance(0.55 + (s.macro.zones[zone].policyRate > 2 ? 0.1 : 0) - c.severity * 0.2);
    advance(c, s, rescue ? "Plan de sauvetage : rachat par un concurrent avec garantie publique." : "Faillite et mise en résolution.");
    if (rescue) {
      q.stress = 0.3;
      applyShock(s, { kind: "instrument", id: c.target! }, Math.log(0.55), 1, "Rachat à prix cassé");
      applyShock(s, { kind: "sector", id: "Banque" }, 0.05, 0.3, "Soulagement après le sauvetage");
      applyShock(s, { kind: "global", id: "*" }, 0.02, 0);
      s.macro.riskAversion = Math.max(0.3, s.macro.riskAversion - 0.2);
      pushNews(s, { category: "crises", title: `Sauvetage : Hudson Meridian rachète ${bank.name} avec le soutien des autorités`, body: "Le régulateur organise un rachat en urgence, assorti d'une garantie sur les dépôts. Les actionnaires sont fortement dilués mais les créanciers seniors sont protégés. La banque centrale ouvre une facilité de liquidité exceptionnelle.", impact: "fort", tickers: [c.target!, "HDMP"], zones: [zone], sentiment: 0.5 });
    } else {
      q.stress = 1; q.defaulted = false;
      applyShock(s, { kind: "instrument", id: c.target! }, Math.log(0.12), 2, "Mise en résolution");
      for (const d of Object.values(s.instruments)) if (d.bond?.issuerStock === c.target) defaultBond(s, d, 0.4);
      applyShock(s, { kind: "sector", id: "Banque" }, -0.06, 1, "Faillite bancaire");
      pushNews(s, { category: "crises", title: `${bank.name} placée en résolution : les actionnaires et créanciers subordonnés perdent tout`, body: "Les autorités ferment l'établissement. Les dépôts garantis sont protégés, les obligations sont en défaut. La banque centrale abaisse ses taux en urgence.", impact: "fort", tickers: [c.target!], zones: [zone], sentiment: -1 });
      s.macro.zones[zone].nextCbDay = dayIndex(s.t) + 1;
    }
    for (const b of ["BADR", "UBCE", "LUTB", "HDMP"]) s.quotes[b].stress *= 0.5;
    return;
  }
  if (c.phase === 3 && age >= 10) {
    c.resolved = true; addLog(c, s.t, "Normalisation progressive des marchés.");
    pushNews(s, { category: "marches", title: "Banques : le calme revient après la tempête", body: "Les spreads de crédit se resserrent, la volatilité reflue. Les régulateurs annoncent un renforcement des exigences de liquidité.", impact: "moyen", tickers: ["XBNK"], zones: [zone], sentiment: 0.4 });
    if (s.macro.regime === "crise") setRegime(s, "reprise", "Après l'intervention des autorités,");
  }
}

function stepGenericCrisis(s: GameState, c: CrisisState, rng: Rng, age: number, m: number) {
  if (m !== 10 * 60) return; // les phases évoluent à 10 h les jours ouvrés
  const sev = c.severity;
  switch (c.kind) {
    case "krach":
      if (c.phase === 0 && age >= 3) { advance(c, s, "Krach : ventes paniques."); applyShock(s, { kind: "global", id: "*" }, -0.09 * sev - 0.03, 2, "Krach boursier"); s.macro.riskAversion = Math.min(1.2, s.macro.riskAversion + 0.4); setRegime(s, "crise", "Un mouvement de vente panique balaie les places financières."); pushNews(s, { category: "crises", title: "KRACH : les bourses mondiales dévissent", body: "Des appels de marge en cascade forcent les fonds à effet de levier à liquider leurs positions. Les indices enregistrent leur pire séance depuis des années.", impact: "fort", tickers: ["IDX-US", "IDX-EU"], zones: ["US", "EZ"], sentiment: -1 }); notify(s, "critique", "KRACH BOURSIER", "Ventes paniques sur toutes les places.", "/play/actualites"); pause(s, "KRACH BOURSIER : ventes paniques sur toutes les places."); }
      else if (c.phase === 1 && age >= 2) { advance(c, s, "Répliques."); applyShock(s, { kind: "global", id: "*" }, -0.04 * sev, 1); }
      else if (c.phase === 2 && age >= 8) { c.resolved = true; addLog(c, s.t, "Stabilisation."); setRegime(s, "reprise", "Les acheteurs reviennent sur les marchés."); }
      break;
    case "bulle_tech":
      if (c.phase === 0 && age >= 6) { advance(c, s, "La bulle éclate."); applyShock(s, { kind: "sector", id: "Technologie" }, -0.18 * sev - 0.05, 1.8, "Éclatement de la bulle"); applyShock(s, { kind: "class", id: "crypto" }, -0.3, 1.5); setRegime(s, "baissier", "Les valeurs technologiques s'effondrent."); pushNews(s, { category: "crises", title: "Technologie : la bulle éclate", body: "Une série d'avertissements sur résultats déclenche une débandade sur les valeurs de croissance. Les valorisations se contractent violemment.", impact: "fort", tickers: ["XTEC", "NOVX", "ELEC"], zones: ["US"], sentiment: -1 }); notify(s, "critique", "Éclatement de la bulle technologique", undefined, "/play/actualites"); }
      else if (c.phase === 1 && age >= 15) { c.resolved = true; addLog(c, s.t, "Purge achevée."); }
      break;
    case "crise_energie":
      if (c.phase === 0 && age >= 4) { advance(c, s, "Perturbation majeure de l'offre."); s.macro.oilSupplyShock = 0.8; applyShock(s, { kind: "instrument", id: "BRENT" }, 0.25 * sev + 0.08, 1.5, "Choc pétrolier"); applyShock(s, { kind: "instrument", id: "WTI" }, 0.22 * sev + 0.07, 1.5); applyShock(s, { kind: "instrument", id: "NGAS" }, 0.4 * sev, 2); applyShock(s, { kind: "sector", id: "Énergie" }, 0.06, 0.5); applyShock(s, { kind: "sector", id: "Automobile" }, -0.04, 0.5); applyShock(s, { kind: "zone", id: "EZ" }, -0.03, 0.5); pushNews(s, { category: "matieres", title: "Les prix du pétrole bondissent après une perturbation de l'offre", body: "Le blocage d'une route maritime stratégique retire plusieurs millions de barils par jour du marché. Le gaz européen s'envole.", impact: "fort", tickers: ["BRENT", "NGAS", "TERA"], zones: ["EZ"], sentiment: -0.6 }); notify(s, "critique", "Choc pétrolier", "Le Brent s'envole.", "/play/actualites"); pause(s, "Choc pétrolier : le Brent s'envole."); }
      else if (c.phase === 1 && age >= 20) { c.resolved = true; s.macro.geopolitics *= 0.5; addLog(c, s.t, "Réouverture progressive des routes d'approvisionnement."); applyShock(s, { kind: "instrument", id: "BRENT" }, -0.12, 0.5); pushNews(s, { category: "matieres", title: "Pétrole : détente après la réouverture des routes maritimes", body: "L'offre se normalise progressivement.", impact: "moyen", tickers: ["BRENT"], zones: [], sentiment: 0.4 }); }
      break;
    case "defaut_souverain":
      if (c.phase === 0 && age >= 6) { advance(c, s, "Dégradation de la note souveraine."); s.macro.factors["spread_IT10Y"] = (s.macro.factors["spread_IT10Y"] ?? 0) + 180 * sev; s.macro.factors["spread_FR10Y"] = (s.macro.factors["spread_FR10Y"] ?? 0) + 30; s.quotes["BADR"].stress = Math.max(s.quotes["BADR"].stress, 0.4); applyShock(s, { kind: "instrument", id: "BADR" }, -0.2, 1.5); applyShock(s, { kind: "zone", id: "EZ" }, -0.05, 1, "Crise de la dette"); shockFx(s, "EUR", -0.025); pushNews(s, { category: "crises", title: "Crise de la dette : la note de l'Italie dégradée en catégorie spéculative", body: "Les écarts de taux s'envolent, les banques détentrices de dette souveraine chutent. La BCE se dit prête à agir.", impact: "fort", tickers: ["IT10Y", "BADR"], zones: ["EZ"], sentiment: -1 }); notify(s, "critique", "Crise de la dette souveraine", undefined, "/play/actualites"); }
      else if (c.phase === 1 && age >= 12) { c.resolved = true; s.macro.factors["spread_IT10Y"] = (s.macro.factors["spread_IT10Y"] ?? 0) * 0.4; addLog(c, s.t, "Intervention de la banque centrale."); pushNews(s, { category: "banques_centrales", title: "La BCE annonce un programme d'achat ciblé : les spreads se détendent", body: "L'annonce provoque un fort resserrement des écarts de taux périphériques.", impact: "fort", tickers: ["IT10Y"], zones: ["EZ"], sentiment: 0.7 }); applyShock(s, { kind: "zone", id: "EZ" }, 0.03, 0); }
      break;
    case "hausse_taux":
      if (c.phase === 0 && age >= 4) { advance(c, s, "Resserrement monétaire brutal."); for (const z of ["US", "EZ"] as const) { s.macro.zones[z].policyRate += 0.5; s.macro.factors[`ypend_${z}`] = (s.macro.factors[`ypend_${z}`] ?? 0) + 0.6; } applyShock(s, { kind: "global", id: "*" }, -0.05, 1, "Choc de taux"); applyShock(s, { kind: "sector", id: "Immobilier" }, -0.06, 0.5); shockFx(s, "EUR", 0.005); pushNews(s, { category: "banques_centrales", title: "Réunion d'urgence : hausse coordonnée des taux de 50 pb", body: "Face à l'inflation, les banques centrales relèvent leurs taux en dehors du calendrier prévu. Les obligations longues plongent.", impact: "fort", tickers: ["US10Y", "DE10Y"], zones: ["US", "EZ"], sentiment: -1 }); notify(s, "critique", "ALERTE : hausse surprise des taux", "Hausse coordonnée de 50 pb.", "/play/actualites"); pause(s, "ALERTE : la banque centrale vient d'annoncer une hausse inattendue des taux."); s.flags["lastRateShock"] = "US"; s.flags["lastRateShockT"] = s.t; s.flags["lastRateShockBp"] = 50; }
      else if (c.phase === 1 && age >= 10) { c.resolved = true; addLog(c, s.t, "Les marchés intègrent le nouveau niveau de taux."); }
      break;
    case "faillite_entreprise": {
      const d = s.instruments[c.target!];
      if (c.phase === 0 && age >= 3) { advance(c, s, "Révélation d'irrégularités comptables."); s.quotes[d.id].stress = 0.9; applyShock(s, { kind: "instrument", id: d.id }, -0.65, 3, `Effondrement ${d.name}`); applyShock(s, { kind: "sector", id: d.sector! }, -0.03, 0.4); for (const b of Object.values(s.instruments)) if (b.bond?.issuerStock === d.id) defaultBond(s, b, 0.3); pushNews(s, { category: "crises", title: `${d.name} s'effondre : irrégularités comptables et dépôt de bilan`, body: `Les commissaires aux comptes refusent de certifier les comptes de ${d.name}. Le directeur financier démissionne. La société se place sous la protection du tribunal.`, impact: "fort", tickers: [d.id], zones: [d.zone], sentiment: -1 }); notify(s, "critique", `Effondrement de ${d.name}`, undefined, "/play/actualites"); }
      else if (c.phase === 1 && age >= 5) { c.resolved = true; addLog(c, s.t, "Restructuration en cours."); }
      break;
    }
    case "crise_change":
      if (c.phase === 0 && age >= 5) { advance(c, s, "Dévaluation."); shockFx(s, "CNY", -0.06 * sev - 0.02); applyShock(s, { kind: "zone", id: "CN" }, -0.08, 1.2, "Crise de change"); applyShock(s, { kind: "zone", id: "JP" }, -0.03, 0.5); applyShock(s, { kind: "sector", id: "Luxe" }, -0.05, 0.5); applyShock(s, { kind: "instrument", id: "COPR" }, -0.06, 0.6); pushNews(s, { category: "crises", title: "Le yuan dévisse : la banque centrale chinoise laisse filer sa devise", body: "La dévaluation surprise déclenche des ventes sur les actifs asiatiques, le luxe et les métaux industriels.", impact: "fort", tickers: ["USDCNY", "MAIS", "COPR"], zones: ["CN"], sentiment: -0.8 }); notify(s, "critique", "Crise de change en Chine", undefined, "/play/actualites"); }
      else if (c.phase === 1 && age >= 10) { c.resolved = true; addLog(c, s.t, "Stabilisation de la devise."); }
      break;
    case "immobilier":
      if (c.phase === 0 && age >= 6) { advance(c, s, "Défauts de foncières."); s.quotes["SKYL"].stress = 0.7; s.quotes["FONC"].stress = 0.4; applyShock(s, { kind: "sector", id: "Immobilier" }, -0.15, 1.2, "Crise immobilière"); applyShock(s, { kind: "sector", id: "Banque" }, -0.03, 0.4); pushNews(s, { category: "crises", title: "Immobilier commercial : une foncière américaine suspend le paiement de ses coupons", body: "Les banques exposées à l'immobilier de bureau reculent.", impact: "fort", tickers: ["SKYL", "FONC"], zones: ["US"], sentiment: -0.8 }); }
      else if (c.phase === 1 && age >= 15) { c.resolved = true; addLog(c, s.t, "Restructuration des dettes immobilières."); }
      break;
    default: c.resolved = true;
  }
}

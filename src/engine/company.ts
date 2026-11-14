/** Entrepreneuriat : création et gestion de la société du joueur, états financiers, faillite. */
import type { Company, GameState } from "./types";
import { Rng } from "./rng";
import { cashAcc, cashOf, post } from "./ledger";
import { toCents, fromCents } from "./money";
import { accountEquity } from "./portfolio";
import { avgRep, careerLog, changeRep, clamp, gainXp, nextId, notify, logDecision } from "./core";
import { newAccount } from "./clients";
import { REGIMES } from "./regimes";
import { monthIndex } from "./time";

export const COMPANY_TYPES: Record<Company["kind"], { label: string; minCapital: number; minRep: number; feeBps: number; perf: number; description: string; regulatory: string }> = {
  conseil: { label: "Société de conseil financier", minCapital: 20000, minRep: 35, feeBps: 0, perf: 0, description: "Missions de conseil facturées (valorisation, stratégie financière).", regulatory: "Statut de conseiller en investissements financiers simulé." },
  fintech: { label: "Fintech", minCapital: 50000, minRep: 40, feeBps: 40, perf: 0, description: "Plateforme technologique d'investissement : coûts de développement élevés, croissance rapide possible.", regulatory: "Agrément de prestataire simulé." },
  gestion: { label: "Société de gestion", minCapital: 150000, minRep: 50, feeBps: 90, perf: 0.1, description: "Gestion de portefeuilles et de fonds pour le compte de clients.", regulatory: "Agrément de société de gestion simulé, fonds propres minimaux 125 000 €." },
  fonds: { label: "Fonds d'investissement", minCapital: 250000, minRep: 55, feeBps: 150, perf: 0.15, description: "Fonds thématique ouvert aux investisseurs professionnels.", regulatory: "Dépositaire et commissaire aux comptes obligatoires (simulés)." },
  hedge_fund: { label: "Hedge fund", minCapital: 500000, minRep: 62, feeBps: 200, perf: 0.2, description: "Stratégies alternatives, investisseurs qualifiés, structure « 2 et 20 ».", regulatory: "Investisseurs professionnels uniquement (simulé)." },
  banque_affaires: { label: "Banque d'affaires boutique", minCapital: 1000000, minRep: 70, feeBps: 0, perf: 0, description: "Conseil en fusions-acquisitions : honoraires de succès importants mais irréguliers.", regulatory: "Agrément simulé de prestataire de services d'investissement." },
};
const OFFICES = { coworking: { label: "Espace de coworking", rent: 1500, capacity: 4, image: 0 }, bureau: { label: "Bureaux à La Défense", rent: 9000, capacity: 15, image: 5 }, siege: { label: "Siège avenue de l'Opéra", rent: 35000, capacity: 60, image: 12 } } as const;
const TOOLS: Record<string, { label: string; monthly: number; effect: string }> = {
  terminal: { label: "Terminal de données de marché", monthly: 2500, effect: "+10 % de performance des équipes de gestion" },
  crm: { label: "CRM et marketing automation", monthly: 1200, effect: "+30 % d'efficacité du marketing" },
  risque: { label: "Système de gestion des risques", monthly: 1800, effect: "Réduit le risque de sanction et de drawdown" },
  conformite: { label: "Outil de conformité réglementaire", monthly: 1000, effect: "Améliore le score de conformité" },
};
export { OFFICES, TOOLS };
const ROLES = ["Gérant", "Analyste", "Commercial", "Responsable conformité", "Développeur", "Banquier conseil"];
const NAMES = ["Alice Martin", "Bruno Lefèvre", "Chen Wei", "Diane Roche", "Emre Kaya", "Fatou Diallo", "Gabriel Petit", "Hélène Brun", "Ismaël Ortega", "Julia Novak", "Kenji Mori", "Laura Bianchi"];

export function canFound(s: GameState, kind: Company["kind"], capital: number) {
  const t = COMPANY_TYPES[kind];
  if (s.company && !s.company.bankrupt) return "Vous dirigez déjà une société.";
  if (capital < t.minCapital) return `Capital minimum : ${t.minCapital.toLocaleString("fr-FR")} €.`;
  if (cashOf(s, "perso", "EUR") / 100 < capital) return "Liquidités personnelles en euros insuffisantes.";
  const rep = avgRep(s) + (s.career.track === "entrepreneur" ? 8 : 0);
  if (s.mode !== "bac_a_sable" && rep < t.minRep) return `Réputation insuffisante (${Math.round(rep)}/${t.minRep}).`;
  return null;
}

export function foundCompany(s: GameState, name: string, kind: Company["kind"], capital: number, strategy: string) {
  const err = canFound(s, kind, capital);
  if (err) return { ok: false as const, error: err };
  const accId = "societe";
  if (!s.accounts[accId]) s.accounts[accId] = newAccount(accId, "societe", `Trésorerie — ${name}`, false, capital);
  post(s, cashAcc(accId), cashAcc("perso"), toCents(capital), "EUR", `Apport en capital à ${name}`);
  s.company = { name: name.slice(0, 60) || "Ma Société", kind, foundedT: s.t, accountId: accId, strategy: strategy.slice(0, 200), employees: [], office: "coworking", tools: [], aum: 0, clientsCount: 0, feeBps: COMPANY_TYPES[kind].feeBps, perfFeePct: COMPANY_TYPES[kind].perf, reputation: clamp(avgRep(s), 10, 80), marketingBudget: toCents(1000), monthly: [], equityRaised: toCents(capital), debt: 0, bankrupt: false, negativeMonths: 0, complianceScore: 70, products: [], retainedEarnings: 0 };
  if (s.career.employed && s.mode === "carriere") { s.career.employed = false; careerLog(s, `Démission pour fonder ${name}`); }
  s.career.track = "entrepreneur";
  careerLog(s, `Création de ${name} (${COMPANY_TYPES[kind].label}) avec ${capital.toLocaleString("fr-FR")} €`);
  logDecision(s, "entreprise", `Création de ${name}`);
  gainXp(s, "entrepreneuriat", 120, "Création d'entreprise");
  notify(s, "succes", `${name} est créée !`, COMPANY_TYPES[kind].regulatory, "/play/entreprise");
  return { ok: true as const };
}

export function hireCandidates(s: GameState) {
  const rng = new Rng({ ...s.rng });
  return [0, 1, 2, 3].map((i) => { const skill = Math.round(rng.range(35, 90)); return { id: `cand${monthIndex(s.t)}_${i}`, name: NAMES[(monthIndex(s.t) * 3 + i * 5) % NAMES.length], role: ROLES[(monthIndex(s.t) + i) % ROLES.length], skill, salary: Math.round((38000 + skill * 900) / 1000) * 1000 }; });
}

export function companyAction(s: GameState, action: string, p: Record<string, string | number>) {
  const c = s.company;
  if (!c || c.bankrupt) return { ok: false as const, error: "Aucune société active." };
  switch (action) {
    case "hire": {
      const cand = hireCandidates(s).find((x) => x.id === p.id);
      if (!cand) return { ok: false as const, error: "Candidat indisponible." };
      if (c.employees.length >= OFFICES[c.office].capacity) return { ok: false as const, error: "Bureaux pleins : changez de locaux." };
      if (c.employees.some((e) => e.id === cand.id)) return { ok: false as const, error: "Déjà recruté." };
      c.employees.push({ id: cand.id, name: cand.name, role: cand.role, salary: toCents(cand.salary), skill: cand.skill, morale: 70 });
      gainXp(s, "management", 20, "Recrutement");
      return { ok: true as const, message: `${cand.name} rejoint l'équipe (${cand.role}).` };
    }
    case "fire": { const e = c.employees.find((x) => x.id === p.id); if (!e) return { ok: false as const, error: "Employé introuvable." }; c.employees = c.employees.filter((x) => x.id !== p.id); const sev = Math.round(e.salary / 12 * 2); post(s, "ext:salaries_societe", cashAcc(c.accountId), sev, "EUR", `Indemnité de départ ${e.name}`); for (const x of c.employees) x.morale = clamp(x.morale - 8, 0, 100); return { ok: true as const, message: `${e.name} quitte la société (indemnité ${fromCents(sev).toLocaleString("fr-FR")} €).` }; }
    case "office": { const o = String(p.office) as keyof typeof OFFICES; if (!OFFICES[o]) return { ok: false as const, error: "Bureaux inconnus." }; c.office = o; return { ok: true as const, message: `Déménagement : ${OFFICES[o].label}.` }; }
    case "tool": { const t = String(p.tool); if (!TOOLS[t]) return { ok: false as const, error: "Outil inconnu." }; if (c.tools.includes(t)) c.tools = c.tools.filter((x) => x !== t); else c.tools.push(t); return { ok: true as const, message: c.tools.includes(t) ? `Abonnement souscrit : ${TOOLS[t].label}.` : `Abonnement résilié : ${TOOLS[t].label}.` }; }
    case "fees": { const f = Number(p.feeBps); if (!(f >= 0 && f <= 300)) return { ok: false as const, error: "Frais entre 0 et 300 pb." }; c.feeBps = Math.round(f); return { ok: true as const, message: `Frais de gestion fixés à ${c.feeBps} pb.` }; }
    case "marketing": { const m = Number(p.amount); if (!(m >= 0 && m <= 500000)) return { ok: false as const, error: "Budget entre 0 et 500 000 €." }; c.marketingBudget = toCents(m); return { ok: true as const, message: `Budget marketing mensuel : ${m.toLocaleString("fr-FR")} €.` }; }
    case "raise": {
      const amt = Number(p.amount);
      const track = c.monthly.length;
      if (track < 3) return { ok: false as const, error: "Les investisseurs exigent au moins 3 mois d'historique." };
      const maxRaise = (c.aum / 100) * 0.02 + c.reputation * 20000;
      if (!(amt > 0) || amt > maxRaise) return { ok: false as const, error: `Montant maximum que les investisseurs accepteraient : ${Math.round(maxRaise).toLocaleString("fr-FR")} €.` };
      post(s, cashAcc(c.accountId), "ext:investisseurs", toCents(amt), "EUR", `Levée de fonds de ${amt.toLocaleString("fr-FR")} €`);
      c.equityRaised += toCents(amt);
      s.flags["dilution"] = ((s.flags["dilution"] as number) ?? 0) + amt / Math.max(1, accountEquity(s, c.accountId) + amt) * 0.5;
      return { ok: true as const, message: `Levée réalisée. Dilution cumulée : ${(((s.flags["dilution"] as number) ?? 0) * 100).toFixed(1)} %.` };
    }
    case "loan": { const amt = Number(p.amount); if (!(amt > 0) || amt > 2_000_000 || c.debt / 100 + amt > Math.max(50000, accountEquity(s, c.accountId) * 2)) return { ok: false as const, error: "Montant refusé par la banque." }; post(s, cashAcc(c.accountId), "ext:preteurs", toCents(amt), "EUR", "Emprunt bancaire"); c.debt += toCents(amt); return { ok: true as const, message: `Emprunt de ${amt.toLocaleString("fr-FR")} € accordé (taux = taux directeur + 3 %).` }; }
    case "repay": { const amt = Math.min(Number(p.amount), c.debt / 100); if (!(amt > 0) || cashOf(s, c.accountId, "EUR") / 100 < amt) return { ok: false as const, error: "Remboursement impossible." }; post(s, "ext:preteurs", cashAcc(c.accountId), toCents(amt), "EUR", "Remboursement d'emprunt"); c.debt -= toCents(amt); return { ok: true as const, message: "Emprunt remboursé." }; }
    case "dividend": { const amt = Number(p.amount); if (!(amt > 0) || amt > c.retainedEarnings / 100 || cashOf(s, c.accountId, "EUR") / 100 < amt) return { ok: false as const, error: "Dividende limité aux bénéfices accumulés et à la trésorerie." }; const own = 1 - ((s.flags["dilution"] as number) ?? 0); post(s, cashAcc("perso"), cashAcc(c.accountId), toCents(amt * own * 0.7), "EUR", `Dividende net perçu de ${c.name}`); post(s, "ext:fisc", cashAcc(c.accountId), toCents(amt * own * 0.3), "EUR", "Prélèvement forfaitaire sur dividende"); if (own < 1) post(s, "ext:investisseurs", cashAcc(c.accountId), toCents(amt * (1 - own)), "EUR", "Dividendes aux autres actionnaires"); c.retainedEarnings -= toCents(amt); return { ok: true as const, message: `Dividende versé. Vous percevez ${Math.round(amt * own * 0.7).toLocaleString("fr-FR")} € nets.` }; }
    case "product": { const name = String(p.name || "Fonds"); if (c.products.length >= 5) return { ok: false as const, error: "Maximum 5 produits." }; const cost = 40000; if (cashOf(s, c.accountId, "EUR") / 100 < cost) return { ok: false as const, error: "Lancer un produit coûte 40 000 € (juridique, dépositaire)." }; post(s, "ext:prestataires", cashAcc(c.accountId), toCents(cost), "EUR", `Lancement du produit ${name}`); c.products.push(name.slice(0, 50)); c.reputation = clamp(c.reputation + 3, 0, 100); return { ok: true as const, message: `Produit lancé : ${name}.` }; }
    default: return { ok: false as const, error: "Action inconnue." };
  }
}

/** Clôture mensuelle de la société : revenus, charges, impôts, croissance des encours, faillite */
export function monthlyCompany(s: GameState, rng: Rng) {
  const c = s.company;
  if (!c || c.bankrupt) return;
  const acc = c.accountId;
  const reg = REGIMES[s.macro.regime];
  const team = c.employees;
  const avgSkill = team.length ? team.reduce((a, e) => a + e.skill * e.morale / 70, 0) / team.length : 30;
  const gestionnaires = team.filter((e) => e.role === "Gérant" || e.role === "Analyste").length;
  const commerciaux = team.filter((e) => e.role === "Commercial").length + 0.5; // le fondateur prospecte
  const conseil = team.filter((e) => e.role === "Banquier conseil" || e.role === "Analyste").length + 1;
  // Performance des encours gérés (modèle : dérive du régime + alpha selon compétences)
  const alpha = (avgSkill - 55) / 100 * 0.04 * (c.tools.includes("terminal") ? 1.1 : 1) * (gestionnaires > 0 ? 1 : 0.3);
  const ret = (reg.drift * 0.6 + alpha) / 12 + rng.normal() * 0.025 * reg.volMult;
  const aumBefore = c.aum / 100;
  let aum = aumBefore * (1 + ret);
  // Flux : marketing, réputation, performance
  const mkt = c.marketingBudget / 100 * (c.tools.includes("crm") ? 1.3 : 1);
  const inflow = (c.kind === "conseil" || c.kind === "banque_affaires") ? 0 : (mkt * 12 * (0.5 + c.reputation / 100) + commerciaux * 150000 * (c.reputation / 60)) * (1 + ret * 5) * (c.feeBps > 150 ? 0.7 : 1) * (s.macro.riskAversion > 0.7 ? 0.5 : 1);
  const outflow = aum * Math.max(0, 0.01 + (ret < -0.03 ? 0.04 : 0) - c.reputation / 5000);
  aum = Math.max(0, aum + inflow - outflow);
  c.aum = toCents(aum);
  c.clientsCount = Math.max(0, Math.round(c.clientsCount + inflow / 250000 - outflow / 400000));
  // Revenus
  let revenue = aum * c.feeBps / 10000 / 12;
  if (ret > 0) revenue += aum * ret * c.perfFeePct;
  if (c.kind === "conseil") revenue += conseil * (8000 + avgSkill * 120) * (0.6 + c.reputation / 100) * (reg.drift > -0.1 ? 1 : 0.6);
  if (c.kind === "banque_affaires" && rng.chance(0.12 * conseil * (c.reputation / 60))) { const fee = rng.range(300000, 2500000); revenue += fee; notify(s, "succes", `${c.name} conseille une fusion : honoraires de succès`, `${Math.round(fee).toLocaleString("fr-FR")} €`, "/play/entreprise"); }
  if (c.kind === "fintech") revenue += c.clientsCount * 15;
  // Charges
  const salaries = team.reduce((a, e) => a + e.salary / 100, 0) / 12 * 1.45;
  const rent = OFFICES[c.office].rent;
  const tools = c.tools.reduce((a, t) => a + TOOLS[t].monthly, 0) + (c.kind === "fintech" ? 15000 : 0);
  const interest = c.debt / 100 * (s.macro.zones.EZ.policyRate + 3) / 100 / 12;
  const compliance = c.kind === "conseil" ? 500 : 3000;
  const expenses = salaries + rent + tools + mkt + interest + compliance;
  const pre = revenue - expenses;
  const tax = pre > 0 ? pre * 0.25 : 0;
  const net = pre - tax;
  if (revenue > 0) post(s, cashAcc(acc), "ext:clients_societe", toCents(revenue), "EUR", `Chiffre d'affaires mensuel ${c.name}`);
  post(s, "ext:salaries_societe", cashAcc(acc), toCents(salaries), "EUR", "Salaires et charges sociales");
  post(s, "ext:bailleur", cashAcc(acc), toCents(rent), "EUR", `Loyer ${OFFICES[c.office].label}`);
  post(s, "ext:prestataires", cashAcc(acc), toCents(tools + compliance), "EUR", "Outils, données et conformité");
  if (mkt > 0) post(s, "ext:prestataires", cashAcc(acc), toCents(mkt), "EUR", "Marketing");
  if (interest > 0) post(s, "ext:preteurs", cashAcc(acc), toCents(interest), "EUR", "Intérêts d'emprunt");
  if (tax > 0) post(s, "ext:fisc", cashAcc(acc), toCents(tax), "EUR", "Impôt sur les sociétés (25 %)");
  c.retainedEarnings += toCents(net);
  c.reputation = clamp(c.reputation + (ret > 0.01 ? 1 : ret < -0.03 ? -2 : 0) + (team.length >= 3 ? 0.3 : 0) - (c.tools.includes("conformite") ? 0 : rng.chance(0.05) ? 3 : 0), 0, 100);
  c.complianceScore = clamp(c.complianceScore + (c.tools.includes("conformite") ? 2 : -1) + (team.some((e) => e.role === "Responsable conformité") ? 2 : 0), 0, 100);
  for (const e of team) e.morale = clamp(e.morale + (net > 0 ? 1 : -2) + rng.normal(), 10, 100);
  const cash = cashOf(s, acc, "EUR");
  c.monthly.push({ month: monthIndex(s.t), revenue: toCents(revenue), expenses: toCents(expenses + tax), net: toCents(net), cash, aum: c.aum });
  if (c.monthly.length > 120) c.monthly.shift();
  gainXp(s, "entrepreneuriat", net > 0 ? 25 : 10, "Gestion mensuelle de la société");
  if (c.complianceScore < 30 && rng.chance(0.3)) { const fine = Math.round(20000 + aum * 0.0005); post(s, "ext:regulateur", cashAcc(acc), toCents(fine), "EUR", "Sanction du régulateur (défaut de conformité)"); notify(s, "critique", "Sanction du régulateur", `Amende de ${fine.toLocaleString("fr-FR")} €.`, "/play/entreprise"); changeRep(s, "conformite", -8); }
  if (cash < 0) {
    c.negativeMonths++;
    notify(s, "critique", `${c.name} : trésorerie négative`, `Mois ${c.negativeMonths}/3 avant la cessation de paiements. Levez des fonds, empruntez ou réduisez les coûts.`, "/play/entreprise");
    if (c.negativeMonths >= 3) {
      c.bankrupt = true;
      post(s, cashAcc(acc), "ext:liquidateur", -cash, "EUR", "Apurement du passif par le liquidateur");
      careerLog(s, `Faillite de ${c.name}`);
      changeRep(s, "professionnelle", -15); changeRep(s, "leadership", -10);
      notify(s, "critique", `FAILLITE de ${c.name}`, "La société est placée en liquidation judiciaire.", "/play/entreprise");
    }
  } else c.negativeMonths = 0;
}

export function companyStatements(s: GameState) {
  const c = s.company;
  if (!c) return null;
  const cash = cashOf(s, c.accountId, "EUR") / 100;
  const investments = accountEquity(s, c.accountId) - cash;
  const last12 = c.monthly.slice(-12);
  const sum = (k: "revenue" | "expenses" | "net") => last12.reduce((a, m) => a + m[k], 0) / 100;
  const totalActif = cash + investments;
  const reserves = totalActif - c.equityRaised / 100 - c.debt / 100; // report à nouveau (bilan équilibré par construction)
  return {
    bilan: { actif: [["Trésorerie", cash], ["Placements", investments]] as [string, number][], passif: [["Capital social et primes", c.equityRaised / 100], ["Réserves et report à nouveau", reserves], ["Dettes financières", c.debt / 100]] as [string, number][], totalActif, totalPassif: totalActif },
    resultat: { chiffreAffaires: sum("revenue"), charges: sum("expenses"), resultatNet: sum("net"), mois: last12.length },
    flux: { exploitation: sum("net"), financement: (c.equityRaised + c.debt) / 100, tresorerieFin: cash },
    historique: c.monthly.map((m) => ({ month: m.month, revenue: m.revenue / 100, expenses: m.expenses / 100, net: m.net / 100, cash: m.cash / 100, aum: m.aum / 100 })),
  };
}

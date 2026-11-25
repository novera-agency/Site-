/**
 * Missions « de situation » : elles naissent de ce qui se passe réellement dans la partie (crise en cours, résultats à venir, décision de banque
 * centrale, plus gros mouvement de la veille, actualité du jour, votre propre portefeuille) et se corrigent sur les chiffres du moment.
 * Chaque modèle renvoie `null` tant que la situation n'existe pas : il n'est alors tout simplement pas proposé.
 */
import type { GameState, Mission, ZoneId } from "./types";
import type { BankTpl } from "./missionBank";
import { accountEquity, exposures, positionViews, valueAtRisk } from "./portfolio";
import { dayIndex } from "./time";

const f0 = (x: number) => Math.round(x).toLocaleString("fr-FR");
const fd = (x: number, d = 2) => x.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
const ZN: Record<string, string> = { US: "États-Unis", EZ: "zone euro", UK: "Royaume-Uni", JP: "Japon", CN: "Chine", EM: "pays émergents" };
const CB: Record<string, string> = { US: "la Fed", EZ: "la BCE", UK: "la Banque d'Angleterre", JP: "la Banque du Japon", CN: "la banque centrale de Chine", EM: "les banques centrales émergentes" };
const KINDS: Record<string, string> = { liquidite_bancaire: "une crise de liquidité bancaire", krach: "un krach boursier", hausse_taux: "un choc de hausse des taux", bulle_tech: "l'éclatement d'une bulle technologique", crise_energie: "une crise de l'énergie", defaut_souverain: "un défaut souverain", crise_change: "une crise de change", faillite_entreprise: "une faillite d'entreprise", recession: "une récession", inflation: "un emballement de l'inflation" };
const chg = (s: GameState, id: string, n: number) => { const d = s.quotes[id]?.daily ?? []; return d.length > n ? d[d.length - 1].c / d[d.length - 1 - n].c - 1 : 0; };
const big = (s: GameState) => Object.values(s.instruments).filter((d) => d.cls === "action" && !d.lite && !s.quotes[d.id].halted && !s.quotes[d.id].defaulted);
const zones = (s: GameState) => (Object.keys(s.macro.zones) as ZoneId[]);
const crisis = (s: GameState) => s.crises.find((c) => !c.resolved && c.phase > 0);
const manualBuys = (s: GameState, m: Mission) => s.fills.filter((f) => f.t >= m.startT && f.side === "buy" && (f.account === "perso" || f.account === "desk") && !s.orders.find((o) => o.id === f.orderId)?.tag);

type Ctx = Omit<BankTpl, "kind" | "rep" | "days" | "category" | "xp"> & Partial<Pick<BankTpl, "kind" | "rep" | "days" | "category" | "xp">>;
const T = (t: Ctx): BankTpl => ({ kind: "calc", rep: { professionnelle: 1 }, days: 1, category: "macro", xp: 30, ...t } as BankTpl);
const G = (steps: string[], link: string, linkLabel: string, tip?: string) => () => ({ steps, link, linkLabel, tip });
const numeric = (id: string, cat: BankTpl["category"], xp: number, make: BankTpl["make"], quiz: NonNullable<BankTpl["quiz"]>, guide: ReturnType<typeof G>): BankTpl => T({ id, family: `ctx_${id}`, category: cat, xp, make, check: () => 0, quiz, guide });

export const CONTEXT: BankTpl[] = [
  // ───── la crise du moment ─────
  T({ id: "c_crise_var", family: "ctx_crise", category: "risque", xp: 55, kind: "action", days: 3,
    make: (s) => { const c = crisis(s); if (!c || !s.accounts.desk) return null; return { title: "Crise en cours : protéger le book", description: `Le marché traverse ${KINDS[c.kind] ?? "une crise"}. Le risk manager exige que la VaR du desk repasse sous 70 % de la limite, avec au moins 3 positions ouvertes.`, criteria: ["VaR ≤ 70 % de la limite", "≥ 3 positions"], params: { c: c.id } }; },
    check: (s) => { if (Object.keys(s.accounts.desk?.positions ?? {}).length < 3) return 0; const v = valueAtRisk(s, "desk").var, lim = s.career.deskLimitVaR / 100; return v <= 0.7 * lim ? 1 : Math.max(0, Math.min(0.9, 1.7 - v / lim)); },
    guide: G(["Ouvrez Risques : repérez les lignes qui pèsent le plus sur la VaR.", "Réduisez-les, sans tomber sous 3 positions."], "/play/risques", "Voir la VaR du desk", "En crise, les corrélations montent : la diversification protège moins que d'habitude.") }),
  T({ id: "c_crise_expo", family: "ctx_crise", category: "risque", xp: 50, kind: "action", days: 3,
    make: (s) => { const c = crisis(s); if (!c) return null; return { title: "Crise en cours : alléger les actions", description: `Avec ${KINDS[c.kind] ?? "une crise"} en toile de fond, votre responsable veut voir vos actions et ETF actions sous 40 % de votre compte personnel (au moins 2 positions détenues).`, criteria: ["Exposition actions ≤ 40 %", "≥ 2 positions"], params: { c: c.id } }; },
    check: (s) => { const v = positionViews(s, "perso"); if (v.length < 2) return 0; const eq = exposures(s, "perso"); return (eq.cls["action"] ?? 0) + (eq.cls["etf"] ?? 0) <= 40 ? 1 : 0.4; },
    guide: G(["Dans Portefeuille, vendez une partie des actions pour passer sous 40 %.", "Gardez au moins 2 lignes (obligations, or…)."], "/play/portefeuille", "Mon portefeuille") }),
  T({ id: "c_crise_choix", family: "ctx_crise", category: "risque", xp: 35,
    make: (s) => { const c = crisis(s); if (!c) return null; return { title: "Réflexe de crise", description: `Face à ${KINDS[c.kind] ?? "une crise"}, le comité demande la décision la plus prudente pour un portefeuille déjà très exposé.`, criteria: ["Bonne réponse"], params: { c: c.id } }; },
    check: () => 0,
    choiceQuiz: () => ({ question: "Que faire en premier ?", options: ["Réduire l'exposition aux actifs les plus risqués et vérifier la liquidité", "Emprunter pour racheter ce qui baisse", "Ne rien changer et attendre sans regarder"], correct: 0, explain: "En crise, on protège d'abord le capital et la liquidité : on réduit le risque avant de chercher à profiter du rebond." }),
    guide: G(["Pensez d'abord à limiter la perte maximale."], "/play/risques", "Voir les risques") }),
  // ───── résultats d'entreprise à venir ─────
  numeric("c_resultats_per", "analyse", 35,
    (s, _p, rng) => { const day = dayIndex(s.t); const pool = big(s).filter((d) => { const q = s.quotes[d.id]; return (q.nextEarningsDay ?? 0) > day && (q.nextEarningsDay ?? 0) <= day + 10 && (q.eps ?? 0) > 0; }); if (!pool.length) return null; const d = rng.pick(pool); return { title: `Avant les résultats de ${d.name}`, description: `${d.name} (${d.id}) publie ses résultats dans les jours qui viennent. Avant de vous prononcer, votre responsable veut son PER actuel (cours ÷ bénéfice par action, sur la fiche).`, criteria: ["Réponse à 0,2 près"], params: { i: d.id } }; },
    (s, m) => { const q = s.quotes[String(m.params.i)]; const a = q.price / (q.eps ?? 1); return { answer: Math.round(a * 100) / 100, tolerance: 0.2, unit: "fois", question: `PER actuel de ${s.instruments[String(m.params.i)].name} ?`, explain: `${fd(q.price)} ÷ ${fd(q.eps ?? 1)} = ${fd(a, 1)} fois.` }; },
    G(["Ouvrez la fiche du titre : le cours et le bénéfice par action y figurent.", "Divisez le cours par le bénéfice par action."], "/play/recherche", "Rechercher le titre")),
  T({ id: "c_resultats_pos", family: "ctx_resultats", category: "trading", xp: 45, kind: "action", days: 4,
    make: (s, _p, rng) => { const day = dayIndex(s.t); const pool = big(s).filter((d) => { const q = s.quotes[d.id]; return (q.nextEarningsDay ?? 0) > day + 1 && (q.nextEarningsDay ?? 0) <= day + 12; }); if (!pool.length) return null; const d = rng.pick(pool); return { title: `Prendre une position avant les résultats de ${d.name}`, description: `${d.name} publie bientôt. Si votre analyse est favorable, prenez une position acheteuse avant la publication (au moins une ligne achetée).`, criteria: [`Un achat de ${d.id}`], params: { i: d.id } }; },
    check: (s, m) => (manualBuys(s, m).some((f) => f.instrumentId === m.params.i) ? 1 : 0),
    guide: G(["Ouvrez la fiche : valorisation, croissance, actualités.", "Achetez si votre analyse est positive (un petit montant suffit)."], "/play/recherche", "Rechercher le titre", "Les résultats peuvent faire bouger le cours de plusieurs pour cent dans les deux sens.") }),
  // ───── banques centrales et macro ─────
  numeric("c_bc_taux", "macro", 30,
    (s, _p, rng) => { const z = rng.pick(zones(s).filter((x) => ["US", "EZ", "UK", "JP"].includes(x))); return { title: `Taux directeur : ${CB[z]}`, description: `Pour la note du matin, il faut le taux directeur actuel de ${CB[z]} (page Macroéconomie).`, criteria: ["Réponse à 0,15 point près"], params: { z } }; },
    (s, m) => { const z = s.macro.zones[m.params.z as ZoneId]; return { answer: z.policyRate, tolerance: 0.15, unit: "%", question: `Taux directeur actuel (${ZN[String(m.params.z)]}) ?`, explain: `${fd(z.policyRate)} %.` }; },
    G(["Ouvrez la page Macroéconomie et repérez la zone demandée."], "/play/macro", "Voir la macroéconomie")),
  numeric("c_bc_reel", "macro", 40,
    (s, _p, rng) => { const z = rng.pick(zones(s).filter((x) => ["US", "EZ", "UK", "JP"].includes(x))); return { title: `Taux réel en ${ZN[z]}`, description: `Quel est le taux directeur réel (taux directeur − inflation) en ${ZN[z]} ? Lisez les deux chiffres sur la page Macroéconomie.`, criteria: ["Réponse à 0,2 point près"], params: { z } }; },
    (s, m) => { const z = s.macro.zones[m.params.z as ZoneId]; const a = z.policyRate - z.inflation; return { answer: a, tolerance: 0.2, unit: "%", question: `Taux directeur réel (${ZN[String(m.params.z)]}) ?`, explain: `${fd(z.policyRate)} % − ${fd(z.inflation)} % = ${fd(a)} %.` }; },
    G(["Relevez taux directeur et inflation de la zone, puis soustrayez."], "/play/macro", "Voir la macroéconomie", "Un taux réel positif signifie une politique monétaire restrictive.")),
  numeric("c_courbe", "macro", 40,
    (s, _p, rng) => { const z = rng.pick(zones(s).filter((x) => ["US", "EZ", "UK", "JP"].includes(x))); return { title: `Pente de la courbe des taux : ${ZN[z]}`, description: `Calculez la pente 2-10 ans (taux à 10 ans − taux à 2 ans) en points de base pour ${ZN[z]}. Une pente négative signale une courbe inversée.`, criteria: ["Réponse à 3 points de base près"], params: { z } }; },
    (s, m) => { const z = s.macro.zones[m.params.z as ZoneId]; const a = (z.y10 - z.y2) * 100; return { answer: Math.round(a), tolerance: 3, unit: "pb", question: `Pente 2-10 ans (${ZN[String(m.params.z)]}) en points de base ?`, explain: `(${fd(z.y10)} % − ${fd(z.y2)} %) × 100 = ${f0(a)} pb.` }; },
    G(["Sur la page Macroéconomie, relevez les taux à 2 ans et 10 ans.", "Soustrayez puis multipliez par 100."], "/play/macro", "Voir la macroéconomie")),
  numeric("c_ecart_zones", "macro", 40,
    (s) => (s.macro.zones.US && s.macro.zones.EZ ? { title: "Écart de taux États-Unis / zone euro", description: "Pour un client qui hésite entre emprunter en dollars ou en euros, donnez l'écart de rendement à 10 ans États-Unis − zone euro, en points de base.", criteria: ["Réponse à 3 points de base près"], params: {} } : null),
    (s) => { const a = (s.macro.zones.US.y10 - s.macro.zones.EZ.y10) * 100; return { answer: Math.round(a), tolerance: 3, unit: "pb", question: "Écart 10 ans États-Unis − zone euro (pb) ?", explain: `(${fd(s.macro.zones.US.y10)} % − ${fd(s.macro.zones.EZ.y10)} %) × 100 = ${f0(a)} pb.` }; },
    G(["Relevez le taux à 10 ans de chaque zone, soustrayez, multipliez par 100."], "/play/macro", "Voir la macroéconomie")),
  numeric("c_inflation", "macro", 30,
    (s, _p, rng) => { const z = rng.pick(zones(s).filter((x) => ["US", "EZ", "UK", "JP", "CN"].includes(x))); return { title: `Inflation : ${ZN[z]}`, description: `Quel est le taux d'inflation actuel en ${ZN[z]} ? (page Macroéconomie)`, criteria: ["Réponse à 0,15 point près"], params: { z } }; },
    (s, m) => ({ answer: s.macro.zones[m.params.z as ZoneId].inflation, tolerance: 0.15, unit: "%", question: `Inflation actuelle (${ZN[String(m.params.z)]}) ?`, explain: `${fd(s.macro.zones[m.params.z as ZoneId].inflation)} %.` }),
    G(["Ouvrez la page Macroéconomie."], "/play/macro", "Voir la macroéconomie")),
  T({ id: "c_croissance", family: "ctx_zones", category: "macro", xp: 35,
    make: (s, _p, rng) => { const z = zones(s).filter((x) => ["US", "EZ", "UK", "JP", "CN"].includes(x)); if (z.length < 3) return null; const pick: ZoneId[] = []; const a = [...z]; while (pick.length < 3) pick.push(a.splice(rng.int(0, a.length - 1), 1)[0]); return { title: "Quelle économie croît le plus vite ?", description: "Pour la lettre aux clients, comparez la croissance annuelle de trois zones (page Macroéconomie).", criteria: ["Bonne réponse"], params: { z: pick.join(",") } }; },
    check: () => 0,
    choiceQuiz: (s, m) => { const z = String(m.params.z).split(",") as ZoneId[]; const g = z.map((x) => s.macro.zones[x].growth); return { question: "Quelle zone a la plus forte croissance annuelle ?", options: z.map((x) => ZN[x]), correct: g.indexOf(Math.max(...g)), explain: z.map((x, i) => `${ZN[x]} ${fd(g[i], 1)} %`).join(", ") + "." }; },
    guide: G(["Comparez la croissance des trois zones sur la page Macroéconomie."], "/play/macro", "Voir la macroéconomie") }),
  // ───── marchés d'hier et d'aujourd'hui ─────
  numeric("c_mouvement", "marches", 35,
    (s) => { const l = big(s); if (l.length < 5) return null; const best = l.map((d) => ({ d, c: Math.abs(chg(s, d.id, 1)) })).sort((a, b) => b.c - a.c)[0]; if (!best || best.c < 0.001) return null; return { title: `Le titre qui a le plus bougé : ${best.d.name}`, description: `${best.d.name} (${best.d.id}) a été la valeur la plus agitée de la dernière séance. Votre responsable veut sa variation exacte (en %, signe compris).`, criteria: ["Réponse à 0,2 point près"], params: { i: best.d.id } }; },
    (s, m) => { const a = chg(s, String(m.params.i), 1) * 100; return { answer: Math.round(a * 100) / 100, tolerance: 0.2, unit: "%", question: `Variation de ${s.instruments[String(m.params.i)].name} sur la dernière séance ?`, explain: `${fd(a)} % (clôture ÷ clôture précédente − 1).` }; },
    G(["Ouvrez la fiche du titre : la variation du jour et le graphique y sont."], "/play/recherche", "Rechercher le titre")),
  numeric("c_indice_semaine", "marches", 30,
    (s, _p, rng) => { const ids = ["IDX-US5", "IDX-FR", "IDX-DE", "IDX-UK", "IDX-JP", "IDX-EU"].filter((x) => s.instruments[x]); if (!ids.length) return null; const id = rng.pick(ids); return { title: `Bilan de la semaine : ${s.instruments[id].name}`, description: `Donnez la performance de ${s.instruments[id].name} sur cinq séances, en pourcentage.`, criteria: ["Réponse à 0,25 point près"], params: { i: id } }; },
    (s, m) => { const a = chg(s, String(m.params.i), 5) * 100; return { answer: Math.round(a * 100) / 100, tolerance: 0.25, unit: "%", question: `Performance sur 5 séances de ${s.instruments[String(m.params.i)].name} ?`, explain: `${fd(a)} %.` }; },
    G(["Ouvrez la fiche de l'indice, graphique « 1 semaine »."], "/play/terminal", "Salle des marchés")),
  numeric("c_eurusd", "macro", 30,
    (s) => (s.quotes["EURUSD"] ? { title: "L'euro face au dollar cette semaine", description: "De combien l'EURUSD a-t-il varié sur cinq séances (en %) ? Un client importateur veut savoir si l'euro s'est apprécié.", criteria: ["Réponse à 0,2 point près"], params: {} } : null),
    (s) => { const a = chg(s, "EURUSD", 5) * 100; return { answer: Math.round(a * 100) / 100, tolerance: 0.2, unit: "%", question: "Variation de l'EURUSD sur 5 séances ?", explain: `${fd(a)} % (positif : l'euro s'apprécie).` }; },
    G(["Ouvrez la fiche EURUSD, graphique « 1 semaine »."], "/play/actif?id=EURUSD", "Ouvrir EURUSD")),
  T({ id: "c_volatil", family: "ctx_marches", category: "marches", xp: 35,
    make: (s, _p, rng) => { const ids = ["IDX-US5", "IDX-FR", "IDX-DE", "IDX-UK", "IDX-JP", "IDX-EU"].filter((x) => s.instruments[x]); if (ids.length < 3) return null; const a = [...ids]; const pick: string[] = []; while (pick.length < 3) pick.push(a.splice(rng.int(0, a.length - 1), 1)[0]); return { title: "Quel indice a le plus bougé ?", description: "Parmi trois indices, lequel a connu le plus gros mouvement (à la hausse ou à la baisse) sur cinq séances ?", criteria: ["Bonne réponse"], params: { o: pick.join(",") } }; },
    check: () => 0,
    choiceQuiz: (s, m) => { const o = String(m.params.o).split(","); const v = o.map((x) => Math.abs(chg(s, x, 5))); return { question: "Quel indice a eu le plus fort mouvement sur 5 séances (en valeur absolue) ?", options: o.map((x) => s.instruments[x]?.name ?? x), correct: v.indexOf(Math.max(...v)), explain: o.map((x, i) => `${s.instruments[x]?.name ?? x} ${fd(v[i] * 100, 1)} %`).join(", ") + " (valeur absolue)." }; },
    guide: G(["Comparez les graphiques « 1 semaine » des trois indices."], "/play/terminal", "Salle des marchés") }),
  T({ id: "c_news_signe", family: "ctx_news", category: "analyse", xp: 35,
    make: (s, _p, rng) => { const day = s.t - 5 * 1440; const pool = s.news.filter((n) => n.t >= day && n.tickers.length && Math.abs(n.sentiment) >= 0.3 && s.instruments[n.tickers[0]]); if (!pool.length) return null; const n = rng.pick(pool); return { title: "Lire l'actualité", description: `Un titre de presse tombe : « ${n.title} ». Dites si, pour ${s.instruments[n.tickers[0]].name}, c'est une nouvelle plutôt favorable ou défavorable.`, criteria: ["Bonne réponse"], params: { n: n.id } }; },
    check: () => 0,
    choiceQuiz: (s, m) => { const n = s.news.find((x) => x.id === m.params.n); const sent = n?.sentiment ?? 0; return { question: `Cette actualité est-elle favorable à ${n ? s.instruments[n.tickers[0]]?.name : "ce titre"} ?`, options: ["Plutôt favorable", "Plutôt défavorable", "Sans effet notable"], correct: sent > 0 ? 0 : 1, explain: `Le ton de l'information est ${sent > 0 ? "positif" : "négatif"} pour ce titre${n ? ` (${n.body.slice(0, 120)}…)` : ""}.` }; },
    guide: G(["Lisez le titre et l'article dans l'onglet Actualités."], "/play/actualites", "Actualités") }),
  // ───── votre propre portefeuille ─────
  numeric("c_ptf_valeur", "trading", 30,
    (s) => (positionViews(s, "perso").length ? { title: "Combien vaut mon portefeuille ?", description: "Faites le point : indiquez la valeur totale de votre compte personnel (titres + liquidités), en euros, à 1 % près.", criteria: ["Réponse à 1 % près"], params: {} } : null),
    (s) => { const a = accountEquity(s, "perso"); return { answer: Math.round(a), tolerance: Math.max(10, a * 0.01), unit: "€", question: "Valeur totale du compte personnel ?", explain: `${f0(a)} € (titres + liquidités).` }; },
    G(["Ouvrez Portefeuille : la valeur totale s'affiche en haut."], "/play/portefeuille", "Mon portefeuille")),
  numeric("c_ptf_poids", "risque", 35,
    (s) => (positionViews(s, "perso").length >= 2 ? { title: "Ma plus grosse ligne", description: "Quel pourcentage de votre compte personnel pèse votre plus grosse ligne ? (colonne « Poids » du portefeuille)", criteria: ["Réponse à 1 point près"], params: {} } : null),
    (s) => { const a = exposures(s, "perso").largestWeight; return { answer: Math.round(a * 10) / 10, tolerance: 1, unit: "%", question: "Poids de la plus grosse ligne ?", explain: `${fd(a, 1)} % du compte.` }; },
    G(["Ouvrez Portefeuille et repérez la colonne « Poids »."], "/play/portefeuille", "Mon portefeuille", "Au-delà de 25-30 % sur une seule ligne, la diversification est faible.")),
  T({ id: "c_ptf_gagnant", family: "ctx_ptf", category: "trading", xp: 40, kind: "action", days: 3,
    make: (s) => (positionViews(s, "perso").some((v) => v.unrealizedEur > 0) ? { title: "Sécuriser un gain latent", description: "Vous avez une ligne en gain latent : vendez-en une partie pour sécuriser un profit réalisé (au moins une vente avec gain).", criteria: ["Une vente avec P&L réalisé > 0"], params: {} } : null),
    check: (s, m) => (s.fills.some((f) => f.t >= m.startT && f.side === "sell" && f.realized > 0 && (f.account === "perso" || f.account === "desk")) ? 1 : 0),
    guide: G(["Dans Portefeuille, repérez une ligne en gain.", "Vendez-en une partie : le gain devient réalisé."], "/play/portefeuille", "Mon portefeuille") }),
];

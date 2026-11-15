/**
 * Événements mondiaux simulés (monde imaginaire 2027 et mode historique après 2025) : la suite de l'histoire n'étant
 * pas connue, ces événements sont fictifs et présentés comme tels. Ils font bouger les marchés de façon plausible.
 */
import type { GameState, ZoneId } from "./types";
import { Rng } from "./rng";
import { pushNews, notify } from "./core";
import { applyShock, shockFx } from "./market";
import { dayIndex } from "./time";

type Ev = { id: string; title: string; body: string; impact: "faible" | "moyen" | "fort"; apply: (s: GameState, rng: Rng) => void; cat: "macro" | "geopolitique" | "entreprises" | "matieres" | "marches" | "reglementation" };
const z = (s: GameState, id: ZoneId, r: number, v = 0.4, label = "") => applyShock(s, { kind: "zone", id }, r, v, label);
const sec = (s: GameState, id: string, r: number, v = 0.4, label = "") => applyShock(s, { kind: "sector", id }, r, v, label);
const EVENTS: Ev[] = [
  { id: "ia", cat: "entreprises", impact: "fort", title: "Percée majeure en intelligence artificielle", body: "Un laboratoire annonce un modèle capable d'automatiser une large part du travail de bureau. Les valeurs technologiques s'envolent, les sociétés de services informatiques chutent.", apply: (s) => sec(s, "Technologie", 0.06, 0.8, "Percée de l'IA") },
  { id: "tarifs", cat: "geopolitique", impact: "fort", title: "Nouvelle escalade des droits de douane", body: "Washington et Pékin relèvent leurs droits de douane réciproques. Les exportateurs et l'automobile reculent.", apply: (s) => { z(s, "CN", -0.05, 0.8, "Guerre commerciale"); sec(s, "Automobile", -0.04, 0.5); z(s, "EZ", -0.015, 0.3); } },
  { id: "canicule", cat: "matieres", impact: "moyen", title: "Canicule record en Europe et sécheresse", body: "Les récoltes de blé sont menacées, la production hydroélectrique et nucléaire ralentit : le blé et l'électricité flambent.", apply: (s) => { applyShock(s, { kind: "instrument", id: "WHEA" }, 0.12, 0.6); applyShock(s, { kind: "instrument", id: "NGAS" }, 0.1, 0.6); } },
  { id: "opep", cat: "matieres", impact: "moyen", title: "L'OPEP+ réduit fortement sa production", body: "Le cartel annonce une baisse surprise de sa production. Le pétrole bondit, les compagnies aériennes et l'automobile reculent.", apply: (s) => { applyShock(s, { kind: "instrument", id: "BRENT" }, 0.09, 0.6); applyShock(s, { kind: "instrument", id: "WTI" }, 0.09, 0.6); sec(s, "Énergie", 0.03, 0.3); } },
  { id: "fusion", cat: "entreprises", impact: "moyen", title: "Méga-fusion dans la banque européenne", body: "Deux grands groupes bancaires européens annoncent leur rapprochement. Le secteur bancaire se réveille.", apply: (s) => sec(s, "Banque", 0.035, 0.4, "Consolidation bancaire") },
  { id: "dette_em", cat: "macro", impact: "fort", title: "Crise de la dette dans un grand pays émergent", body: "Un grand pays émergent suspend le paiement de sa dette extérieure. Les devises émergentes plongent, l'or progresse.", apply: (s) => { z(s, "EM", -0.07, 1, "Crise de la dette émergente"); applyShock(s, { kind: "instrument", id: "GOLD" }, 0.03, 0.3); } },
  { id: "cyber", cat: "entreprises", impact: "moyen", title: "Cyberattaque géante contre des banques", body: "Plusieurs établissements subissent une panne de plusieurs heures après une cyberattaque coordonnée. Les valeurs de cybersécurité grimpent.", apply: (s) => { sec(s, "Banque", -0.025, 0.5); sec(s, "Technologie", 0.01, 0.2); } },
  { id: "pandemie", cat: "geopolitique", impact: "fort", title: "Nouvelle épidémie : l'OMS appelle à la vigilance", body: "Un nouveau virus respiratoire se propage en Asie. Les marchés craignent de nouvelles restrictions ; la santé résiste, le tourisme chute.", apply: (s) => { z(s, "US", -0.03, 0.8); z(s, "EZ", -0.035, 0.8); sec(s, "Santé", 0.03, 0.3); } },
  { id: "stimulus", cat: "macro", impact: "moyen", title: "Plan de relance massif en Chine", body: "Pékin annonce un vaste plan d'infrastructures. Les métaux industriels et le luxe profitent de l'annonce.", apply: (s) => { z(s, "CN", 0.05, 0.6, "Relance chinoise"); applyShock(s, { kind: "instrument", id: "COPR" }, 0.06, 0.5); sec(s, "Luxe", 0.03, 0.3); } },
  { id: "inflation", cat: "macro", impact: "moyen", title: "L'inflation repart à la hausse", body: "Les prix accélèrent à nouveau des deux côtés de l'Atlantique. Les marchés anticipent des taux plus élevés plus longtemps.", apply: (s) => { for (const k of ["US", "EZ"] as const) s.macro.factors[`ypend_${k}`] = (s.macro.factors[`ypend_${k}`] ?? 0) + 0.25; sec(s, "Immobilier", -0.03, 0.4); } },
  { id: "green", cat: "reglementation", impact: "moyen", title: "L'Europe accélère la transition énergétique", body: "Un nouveau paquet réglementaire impose une sortie plus rapide des énergies fossiles. Les renouvelables bondissent, les pétrolières reculent.", apply: (s) => sec(s, "Énergie", -0.02, 0.4) },
  { id: "election", cat: "geopolitique", impact: "moyen", title: "Élection serrée : les marchés hésitent", body: "Une grande élection nationale se joue à quelques voix. L'incertitude fait monter la volatilité le temps du dépouillement.", apply: (s) => { for (const q of Object.values(s.quotes)) q.ivBump = Math.min(2, q.ivBump + 0.3); } },
  { id: "yen", cat: "macro", impact: "moyen", title: "Le yen s'envole après un virage de la Banque du Japon", body: "La Banque du Japon relève ses taux plus vite que prévu. Le yen bondit, la bourse de Tokyo recule.", apply: (s) => { shockFx(s, "JPY", 0.04); z(s, "JP", -0.04, 0.6); } },
  { id: "spatial", cat: "entreprises", impact: "faible", title: "Course à l'espace : contrats géants pour l'industrie", body: "Les agences spatiales attribuent des contrats record. L'aéronautique et l'industrie progressent.", apply: (s) => sec(s, "Industrie", 0.025, 0.3) },
];

export function maybeWorldEvent(s: GameState, rng: Rng) {
  const day = dayIndex(s.t);
  const last = Number(s.flags["worldEvDay"] ?? -999);
  if (day - last < 25 || !rng.chance(0.03)) return;
  const recent = String(s.flags["worldEvRecent"] ?? "").split(",");
  const pool = EVENTS.filter((e) => !recent.includes(e.id));
  const e = rng.pick(pool.length ? pool : EVENTS);
  s.flags["worldEvDay"] = day;
  s.flags["worldEvRecent"] = [e.id, ...recent].slice(0, 6).join(",");
  e.apply(s, rng);
  pushNews(s, { category: e.cat, title: e.title, body: `${e.body} (Événement simulé.)`, impact: e.impact, tickers: [], zones: [], sentiment: 0 });
  if (e.impact === "fort") notify(s, "alerte", e.title, "Événement simulé — consultez les actualités.", "/play/actualites");
}

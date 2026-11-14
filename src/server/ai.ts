/**
 * Couche conversationnelle IA des PNJ (facultative).
 * - Clé lue uniquement côté serveur (ANTHROPIC_API_KEY), jamais exposée au navigateur.
 * - Le modèle ne modifie JAMAIS l'état : il PROPOSE des actions structurées, validées et bornées par le moteur.
 * - Sans clé (ou en cas d'erreur), un moteur de dialogue déterministe à base de règles prend le relais.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { GameState, Npc } from "@/engine/types";
import { REGIMES } from "@/engine/regimes";
import { accountEquity, valueAtRisk } from "@/engine/portfolio";
import { avgRep, changeTrust, gainXp, clamp } from "@/engine/core";
import { rankTitle } from "@/engine/career";
import { BANK_BY_ID } from "@/engine/data/banks";

export function aiAvailable() { return !!process.env.ANTHROPIC_API_KEY; }
const MODEL = () => process.env.AI_MODEL || "claude-opus-5-5";

export interface NpcReply { reply: string; source: "ia" | "scenarise"; applied: string[]; }

function context(s: GameState, npc: Npc) {
  const desk = s.accounts.desk;
  return [
    `Simulation financière fictive (monnaie virtuelle). Date simulée : jour ${Math.floor(s.t / 1440)}.`,
    `Régime de marché : ${REGIMES[s.macro.regime].label}. Taux directeur US ${s.macro.zones.US.policyRate} %, zone euro ${s.macro.zones.EZ.policyRate} %. Inflation US ${s.macro.zones.US.inflation.toFixed(1)} %.`,
    `Joueur : ${s.profile.firstName} ${s.profile.lastName}, ${s.career.employed ? `${rankTitle(s)} chez ${BANK_BY_ID[s.career.bankId]?.name}` : "sans poste en banque"}. Réputation moyenne ${Math.round(avgRep(s))}/100, conformité ${Math.round(s.reputation.conformite)}/100, dépassements de limites : ${s.career.breaches}.`,
    desk && s.career.employed ? `Book du desk : ${Math.round(accountEquity(s, "desk")).toLocaleString("fr-FR")} €, VaR ${Math.round(valueAtRisk(s, "desk").var).toLocaleString("fr-FR")} € (limite ${Math.round(s.career.deskLimitVaR / 100).toLocaleString("fr-FR")} €).` : "",
    `Vous êtes ${npc.name}, ${npc.role}. Personnalité : ${npc.personality}. Confiance envers le joueur : ${Math.round(npc.trust)}/100 (${npc.opinion}). Objectifs : ${npc.goals.join(" ; ")}.`,
    npc.memory.length ? `Souvenirs marquants : ${npc.memory.slice(0, 6).map((m) => m.text).join(" | ")}.` : "",
    `Dernières actualités : ${s.news.slice(0, 3).map((n) => n.title).join(" | ")}.`,
  ].filter(Boolean).join("\n");
}

const SYSTEM = `Tu joues un personnage non joueur d'un jeu de simulation de carrière en finance de marché, en français, avec un vocabulaire professionnel précis.
Reste dans ton personnage, sois concis (3 à 6 phrases), conteste les raisonnements faibles, valorise la gestion responsable du risque et l'intérêt du client.
Tu ne donnes jamais de conseil d'investissement réel : tout est fictif.
Tu ne peux PAS modifier les comptes, positions ou soldes. Tu peux seulement proposer un ajustement de ta confiance envers le joueur.
Réponds UNIQUEMENT en JSON : {"reply": "...", "trust_delta": entier entre -3 et 3, "assessment": "faible" | "correct" | "solide"}`;

export async function npcChat(s: GameState, npcId: string, message: string): Promise<NpcReply> {
  const npc = s.npcs[npcId];
  if (!npc) return { reply: "Interlocuteur introuvable.", source: "scenarise", applied: [] };
  const msg = message.slice(0, 1200);
  const key = `chat:${npcId}:${Math.floor(s.t / 60)}`;
  const count = (s.eventCooldowns[key] ?? 0) + 1;
  s.eventCooldowns[key] = count;
  if (aiAvailable() && s.settings.aiEnabled) {
    try {
      const client = new Anthropic();
      const res = await client.beta.messages.create({
        model: MODEL(), max_tokens: 1024,
        betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
        output_config: { effort: "low" },
        system: SYSTEM,
        messages: [{ role: "user", content: `${context(s, npc)}\n\nLe joueur vous dit : « ${msg} »` }],
      } as Anthropic.Beta.MessageCreateParamsNonStreaming);
      if (res.stop_reason !== "refusal") {
        const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
        const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
        const parsed = JSON.parse(json) as { reply?: string; trust_delta?: number; assessment?: string };
        const applied: string[] = [];
        // Validation par le moteur : bornes, une seule modification par heure simulée
        const delta = count === 1 ? clamp(Math.round(Number(parsed.trust_delta) || 0), -3, 3) : 0;
        if (delta) { changeTrust(s, npcId, delta, `Échange : « ${msg.slice(0, 60)} »`); applied.push(`Confiance ${delta > 0 ? "+" : ""}${delta}`); }
        if (parsed.assessment === "solide") { gainXp(s, "client", 8, "Argumentation face à un PNJ"); applied.push("Argumentation jugée solide"); }
        if (parsed.reply) return { reply: String(parsed.reply).slice(0, 2000), source: "ia", applied };
      }
    } catch (e) {
      if (e instanceof Anthropic.APIError) console.error(`IA indisponible (${e.status}) : repli scénarisé`);
      else console.error("IA : réponse invalide, repli scénarisé");
    }
  }
  return scriptedReply(s, npc, msg, count);
}

/** Dialogue déterministe hors ligne : règles par mots-clés, rôle et état de la partie */
function scriptedReply(s: GameState, npc: Npc, msg: string, count: number): NpcReply {
  const m = msg.toLowerCase();
  const applied: string[] = [];
  const has = (...w: string[]) => w.some((x) => m.includes(x));
  const reg = REGIMES[s.macro.regime];
  let reply: string;
  if (has("promotion", "promu", "augmentation", "salaire", "bonus")) {
    reply = npc.relation === "hierarchie"
      ? (npc.trust >= 65 ? "Vos résultats parlent pour vous. Continuez à respecter vos limites et nous en reparlerons à la revue trimestrielle." : "Une promotion se mérite : résultats réguliers, zéro incident de risque, clients satisfaits. Nous n'y sommes pas encore.")
      : "Ce n'est pas à moi qu'il faut poser la question. Mais la rumeur dit que la direction regarde surtout la gestion du risque.";
  } else if (has("taux", "banque centrale", "inflation", "fed", "bce")) {
    reply = `Avec une inflation américaine à ${s.macro.zones.US.inflation.toFixed(1)} % et un taux directeur à ${s.macro.zones.US.policyRate.toFixed(2)} %, ${s.macro.zones.US.inflation > 3 ? "le biais reste restrictif : attention à la duration." : "le marché anticipe plutôt un assouplissement progressif."} Surveillez le calendrier.`;
  } else if (has("risque", "var", "limite", "couverture", "hedge")) {
    const v = s.accounts.desk ? valueAtRisk(s, "desk").var : 0;
    reply = npc.relation === "risque" || npc.relation === "hierarchie" ? `La VaR du book est à ${Math.round(v).toLocaleString("fr-FR")} € pour une limite de ${Math.round(s.career.deskLimitVaR / 100).toLocaleString("fr-FR")} €. ${v > s.career.deskLimitVaR / 100 * 0.8 ? "C'est trop près de la limite : réduisez ou couvrez." : "Vous avez de la marge, mais ne la consommez pas sans conviction."}` : "Le risque, c'est ce qui reste quand on croit avoir tout prévu. Couvre ce que tu ne comprends pas.";
    if (count === 1) { changeTrust(s, npc.id, 1, "Question pertinente sur le risque"); applied.push("Confiance +1"); }
  } else if (has("marché", "marche", "achat", "acheter", "vendre", "idée", "idee")) {
    reply = `Nous sommes en régime « ${reg.label.toLowerCase()} ». ${reg.drift > 0.05 ? "La tendance est porteuse, mais ne confondez pas marché haussier et talent." : reg.drift < -0.05 ? "Protégez le capital avant de chercher le rendement." : "Peu de tendance : la sélection de titres et la discipline font la différence."} ${npc.relation === "conformite" ? "Et rappelez-vous : aucune opération sur la base d'une information privilégiée." : ""}`;
  } else if (has("merci", "bravo", "félicitations")) {
    reply = "Merci. Gardez ce niveau d'exigence.";
  } else if (has("initié", "tuyau", "information privilégiée", "cacher")) {
    reply = npc.relation === "conformite" ? "Je vous remercie d'en parler. Ne faites aucune opération et transmettez-moi les détails : c'est la seule bonne réponse." : "Ne joue pas avec ça. C'est la fin d'une carrière, et la prison parfois.";
    if (count === 1) { changeTrust(s, npc.id, 2, "A abordé un sujet de conformité avec transparence"); applied.push("Confiance +2"); }
  } else {
    const lines: Record<string, string> = {
      hierarchie: "Soyez précis. Qu'attendez-vous de moi exactement, et avec quels chiffres ?",
      collegue: "Franchement, la journée est chargée. Reviens avec une question précise et je t'aide.",
      client: "Je vous fais confiance, mais j'ai besoin de comprendre ce que vous faites de mon argent.",
      conformite: "En cas de doute, posez la question avant d'agir. C'est toujours moins coûteux après.",
      risque: "Montrez-moi les chiffres : exposition, sensibilités, scénarios.",
      externe: "Intéressant. On en reparle autour d'un café ?",
    };
    reply = lines[npc.relation] ?? "Je vous écoute.";
  }
  return { reply: `${reply}${s.difficulty === "debutant" ? " (Mode hors ligne : dialogues scénarisés. Configurez une clé API côté serveur pour des échanges libres.)" : ""}`, source: "scenarise", applied };
}

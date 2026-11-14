/** Dialogues scénarisés déterministes des PNJ (mode hors ligne, sans IA). */
import type { GameState, Npc } from "./types";
import { REGIMES } from "./regimes";
import { valueAtRisk } from "./portfolio";
import { changeTrust } from "./core";

export interface NpcReply { reply: string; source: "ia" | "scenarise"; applied: string[]; }

/** Dialogue déterministe hors ligne : règles par mots-clés, rôle et état de la partie */
export function scriptedReply(s: GameState, npc: Npc, msg: string, count: number): NpcReply {
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

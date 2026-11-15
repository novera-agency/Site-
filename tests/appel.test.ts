import { describe, it, expect } from "vitest";
import { game, atEuOpen } from "./helpers";
import { startMeeting, answerMeeting } from "@/engine/meetingEngine";
import { accountEquity } from "@/engine/portfolio";
import { isBalanced } from "@/engine/ledger";
import { tOfDay, dayIndex } from "@/engine/time";

const pick = (s: ReturnType<typeof game>, m: { id: string }, id: string) => expect(answerMeeting(s, m.id, { choiceId: id }).ok).toBe(true);

describe("Appel commercial", () => {
  it("appel sans faute : le client verse tout l'objectif, investi selon son mandat", () => {
    const s = atEuOpen(game("carriere", "call-ok"));
    const c = s.clients[0];
    const aum0 = accountEquity(s, c.accountId);
    const m = startMeeting(s, "appel_client", { client: c.id, callback: "1", rq: "heritage", obj: "0" })!;
    const obj = Number(m.vars.objInit);
    expect(obj).toBeGreaterThan(0);
    for (const id of ["a", "r0", "a", "a", "o0", "a"]) pick(s, m, id);
    expect(m.done).toBe(true);
    expect(Number(m.vars.obtained)).toBe(obj);
    expect(accountEquity(s, c.accountId)).toBeGreaterThan(aum0 + obj * 0.95);
    expect(s.flags["salesYtd"]).toBe(obj);
    expect(isBalanced(s)).toBe(true);
  });
  it("chaque faute fait baisser l'objectif ; sous 30 %, le client raccroche", () => {
    const s = atEuOpen(game("carriere", "call-ko"));
    const c = s.clients[0]; // profil prudent
    const m = startMeeting(s, "appel_client", { client: c.id, callback: "1", rq: "heritage", obj: "0" })!;
    const obj = Number(m.vars.objInit);
    pick(s, m, "b"); // démarchage agressif : −15 %
    expect(Number(m.vars.objective)).toBe(Math.round(obj * 0.85));
    pick(s, m, "r2"); // précipitation : −20 %
    expect(Number(m.vars.objective)).toBe(Math.round(obj * 0.65));
    pick(s, m, "a");
    expect(m.done).toBe(false);
    pick(s, m, "b"); // tout en technologie pour un client prudent : −30 %
    expect(Number(m.vars.objective)).toBe(Math.round(obj * 0.35));
    pick(s, m, "o1"); // « je vous garantis » : −30 % → sous le seuil
    expect(m.done).toBe(true);
    expect(m.vars.failed).toBe(1);
    expect(m.vars.obtained).toBeUndefined();
    expect(m.log.some((l) => l.text.includes("je n'ai plus le temps"))).toBe(true);
  });
  it("hors des heures ouvrées : messagerie, et un message laissé déclenche un rappel du client", () => {
    const s = game("carriere", "call-vm");
    s.t = tOfDay(dayIndex(s.t), 22, 0);
    const c = s.clients[1];
    const m = startMeeting(s, "appel_client", { client: c.id })!;
    expect(m.nodeId).toBe("repondeur");
    expect(m.vars.objInit).toBeUndefined(); // pas d'objectif de vente sur une messagerie
    answerMeeting(s, m.id, { offtopic: true, spoken: "Bonjour, c'est votre conseiller, rappelez-moi" }); // tout propos est un message laissé
    expect(m.vars.penalites).toBeUndefined();
    expect(m.done).toBe(true);
    expect(s.agenda.some((a) => a.meetingTemplate === "appel_client" && a.params?.callback === "1" && a.params?.client === c.id)).toBe(true);
  });

  it("les demandes changent d'un appel à l'autre, avec des formulations variées", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 12; i++) { const s = atEuOpen(game("carriere", `call-var-${i}`)); const m = startMeeting(s, "appel_client", { client: s.clients[0].id, callback: "1" })!; seen.add(`${m.vars.rq}:${m.vars.rqv}`); }
    expect(seen.size).toBeGreaterThanOrEqual(5);
  });
  it("demande de service (frais) : pas d'objectif de vente, satisfaction selon la réponse", () => {
    const s = atEuOpen(game("carriere", "call-fees"));
    const c = s.clients[0]; const sat0 = c.satisfaction; const fee0 = c.feeBps;
    const m = startMeeting(s, "appel_client", { client: c.id, callback: "1", rq: "frais" })!;
    expect(m.vars.objInit).toBeUndefined();
    for (const id of ["a", "r0", "a"]) pick(s, m, id);
    expect(m.done).toBe(true);
    expect(c.satisfaction).toBeGreaterThan(sat0);
    expect(c.feeBps).toBeLessThan(fee0);
  });
  it("une recommandation d'un client satisfait crée un prospect", () => {
    const s = atEuOpen(game("carriere", "call-reco"));
    const m = startMeeting(s, "appel_client", { client: s.clients[0].id, callback: "1", rq: "recommandation" })!;
    for (const id of ["a", "r0", "a"]) pick(s, m, id);
    expect(s.prospects?.some((p) => p.warm && p.source.startsWith("Recommandé"))).toBe(true);
  });
});

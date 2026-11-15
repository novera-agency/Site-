import { z } from "zod";
import { NextResponse } from "next/server";
import { requireSession, json, err } from "@/server/http";
import { createGame } from "@/engine/engine";
import { registerGame } from "@/server/store";
import { BANK_BY_ID } from "@/engine/data/banks";

const Body = z.object({
  mode: z.enum(["carriere", "bac_a_sable", "defi"]), difficulty: z.enum(["debutant", "normal", "expert", "simulation"]),
  bankId: z.string().max(30), track: z.enum(["trader", "sales", "structurer", "analyste", "gerant", "risk", "ib", "entrepreneur"]),
  startingCapital: z.number().min(100).max(100_000_000), seed: z.string().max(40).optional(), challengeId: z.string().max(40).optional(),
  profile: z.object({ firstName: z.string().min(1).max(40), lastName: z.string().min(1).max(40), nationality: z.string().max(40), age: z.number().int().min(18).max(80), education: z.string().max(80), knowledge: z.enum(["debutant", "etudiant", "analyste", "trader", "entrepreneur", "expert"]), goal: z.string().max(120), specialization: z.string().max(80), riskProfile: z.enum(["prudent", "equilibre", "dynamique", "agressif"]) }),
  minutesPerSecond: z.number().min(0.25).max(60).optional(),
  historical: z.boolean().optional(),
});
export async function POST(req: Request) {
  const s = await requireSession();
  if (s instanceof NextResponse) return s;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return err("Paramètres de partie invalides : " + parsed.error.issues.map((i) => i.path.join(".")).join(", "));
  const b = parsed.data;
  const bank = BANK_BY_ID[b.bankId];
  if (!bank) return err("Banque inconnue.");
  if (b.mode === "carriere" && !bank.tracks.includes(b.track)) return err(`${bank.name} ne recrute pas ce métier.`);
  const capital = b.mode === "carriere" ? (b.startingCapital === 10000 || b.difficulty === "debutant" ? 10000 : b.startingCapital) : b.startingCapital;
  const game = createGame({ ownerId: s.uid, mode: b.mode, difficulty: b.difficulty, profile: b.profile, bankId: bank.id, track: b.track, startingCapital: capital, seed: b.seed, challengeId: b.challengeId, settings: b.minutesPerSecond ? { minutesPerSecond: b.minutesPerSecond } : undefined, historical: !!b.historical });
  const id = registerGame(game);
  return json({ ok: true, gameId: id });
}

import { withGame, json } from "@/server/http";
import { advance } from "@/engine/engine";
import { snapshot } from "@/server/views";
import { aiAvailable } from "@/server/ai";
import { STEP_MIN } from "@/engine/time";

/** Horloge de simulation : le serveur mesure le temps réel écoulé (plafonné à 3 s) et avance le temps simulé en pas fixes. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withGame(id, (rt) => {
    const s = rt.state;
    const now = Date.now();
    const elapsed = Math.min(3000, Math.max(0, now - rt.lastTickReal));
    rt.lastTickReal = now;
    if (!s.paused && s.speed > 0) {
      rt.accMinutes += (elapsed / 1000) * s.speed * s.settings.minutesPerSecond;
      const steps = Math.min(600, Math.floor(rt.accMinutes / STEP_MIN));
      if (steps > 0) { advance(s, steps * STEP_MIN); rt.accMinutes -= steps * STEP_MIN; }
      if (s.paused) rt.accMinutes = 0;
    } else rt.accMinutes = 0;
    return json(snapshot(s, aiAvailable()));
  });
}

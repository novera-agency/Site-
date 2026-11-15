import { withGame, json } from "@/server/http";
import { advanceBudget } from "@/engine/engine";
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
      let lag = false;
      if (steps > 0) { const done = advanceBudget(s, steps * STEP_MIN, 250); rt.accMinutes -= done * STEP_MIN; lag = done < steps && !s.paused; rt.accMinutes = Math.min(rt.accMinutes, 36 * STEP_MIN); }
      if (s.paused) rt.accMinutes = 0;
      return json({ ...snapshot(s, aiAvailable()), lag });
    } else rt.accMinutes = 0;
    return json(snapshot(s, aiAvailable()));
  });
}

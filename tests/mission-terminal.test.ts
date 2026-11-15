import { describe, it, expect } from "vitest";
import { game } from "./helpers";
import { createMission } from "@/engine/missions";
import { applyAction } from "@/server/actions";

describe("mission « Configurer votre terminal »", () => {
  it("passe à 100 % dès l'alerte créée, même en pause", () => {
    const s = game("carriere", "terminal");
    s.alerts = [];
    s.paused = true;
    const m = s.missions.find((x) => x.templateId === "watchlist" && x.status === "active") ?? createMission(s, "watchlist")!;
    expect(m).toBeTruthy();
    const r = applyAction(s, { type: "alert", instrumentId: "XWLD", level: 999, above: true } as never);
    expect(r.ok).toBe(true);
    expect(m.status).toBe("reussie");
    expect(m.progress).toBe(1);
  });
  it("« Passer votre premier ordre » ne se valide pas tout seul avec le book initial du desk", () => {
    const s = game("carriere", "premier");
    applyAction(s, { type: "pause", paused: true } as never);
    const m = s.missions.find((x) => x.templateId === "premier_ordre");
    expect(m?.status).toBe("active");
    expect(m?.progress).toBe(0);
  });
});

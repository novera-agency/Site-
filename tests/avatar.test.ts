import { describe, it, expect } from "vitest";
import { game } from "./helpers";
import { applyAction } from "@/server/actions";
import { defaultAvatar, parseAvatar, lockedParts, clampToRank, normalizeForModel, SUITS, TIES } from "@/engine/avatar";
import { snapshot } from "@/server/views";

const act = (s: ReturnType<typeof game>, a: object) => applyAction(s, a as never);

describe("Avatar du joueur", () => {
  it("validation : indices entiers dans les bornes uniquement", () => {
    expect(parseAvatar(defaultAvatar())).toEqual(defaultAvatar());
    expect(parseAvatar({ ...defaultAvatar(), skin: 99 })).toBeNull();
    expect(parseAvatar({ ...defaultAvatar(), hair: 1.5 })).toBeNull();
    expect(parseAvatar({ ...defaultAvatar(), pocket: "oui" })).toBeNull();
    expect(parseAvatar(null)).toBeNull();
  });
  it("une partie a toujours un avatar, repris dans le snapshot ; les parties anciennes reçoivent l'avatar par défaut", () => {
    const s = game("carriere", "avatar-1");
    expect(parseAvatar(s.profile.avatar)).not.toBeNull();
    delete (s.profile as { avatar?: unknown }).avatar;
    expect(snapshot(s).player.avatar).toEqual(defaultAvatar());
  });
  it("garde-robe : les costumes et accessoires prestigieux se débloquent avec le grade", () => {
    const s = game("carriere", "avatar-2");
    const rich = { ...defaultAvatar(), suit: SUITS.findIndex((x) => x.label === "Bordeaux profond"), watch: 2, cufflinks: true };
    expect(lockedParts(rich, 0).length).toBeGreaterThan(0);
    s.career.rank = 0;
    expect(act(s, { type: "set_avatar", avatar: rich }).ok).toBe(false);
    expect(clampToRank(rich, 0)).toMatchObject({ suit: 0, watch: 0, cufflinks: false });
    expect(act(s, { type: "set_avatar", avatar: { ...defaultAvatar(), tie: TIES.findIndex((x) => x.label === "Bleu royal"), skin: 4 } }).ok).toBe(true);
    expect(s.profile.avatar!.skin).toBe(4);
    s.career.rank = 5;
    expect(act(s, { type: "set_avatar", avatar: rich }).ok).toBe(true);
    expect(act(s, { type: "set_avatar", avatar: { ...rich, skin: 40 } }).ok).toBe(false);
  });
  it("le modèle 3D ne gère que quelques coiffures et la moustache : les anciens choix sont ramenés à une valeur prise en charge", () => {
    expect(normalizeForModel({ ...defaultAvatar(), hair: 2, beard: 4 })).toMatchObject({ hair: 3, beard: 0 });
    expect(normalizeForModel({ ...defaultAvatar(), hair: 5, beard: 3 })).toMatchObject({ hair: 5, beard: 3 });
    expect(normalizeForModel({ ...defaultAvatar(), hair: 0 }).hair).toBe(0);
  });
});

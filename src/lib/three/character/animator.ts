import * as THREE from "three";
import { CharacterRig, FINGERS, qx, qy, qz, type Side } from "./rig";
import type { Dressed } from "./customize";

/**
 * Animation du personnage : machine à états (IDLE, WALK, RUN, TURN, SIT, STAND_UP, INTERACT, GESTURE, CUSTOM),
 * marche et course par cinématique inverse des jambes (pieds plantés, sans glissement), gestes professionnels par directions de bras,
 * couche additive pour le regard, la respiration et le visage. Tout est calculé en direct pour s'adapter à la vitesse et à la direction.
 */
export type CharState = "IDLE" | "WALK" | "RUN" | "TURN" | "SIT" | "STAND_UP" | "INTERACT" | "GESTURE" | "CUSTOM";
export type GestureId = "salut" | "cravate" | "veste" | "bras_croises" | "poches" | "montre" | "presenter" | "pointer" | "acquiescer" | "reflechir" | "assurance" | "bienvenue" | "refus";

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).normalize();
const smooth = (t: number) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
const lerp = THREE.MathUtils.lerp;
const clamp = THREE.MathUtils.clamp;

/* ───────── gestes : directions de l'épaule→coude (up) et du coude→poignet (fore), côté droit ; le gauche est le miroir ───────── */
interface ArmKey { up: THREE.Vector3; fore: THREE.Vector3; curl?: number; point?: boolean }
interface Keyframe { t: number; r?: ArmKey; l?: ArmKey; head?: [number, number, number]; chest?: [number, number, number]; face?: string }
interface Gesture { dur: number; priority: number; keys: Keyframe[]; loop?: number; hold?: boolean; sideSwap?: boolean }
const mirror = (k: ArmKey): ArmKey => ({ ...k, up: new THREE.Vector3(-k.up.x, k.up.y, k.up.z), fore: new THREE.Vector3(-k.fore.x, k.fore.y, k.fore.z) });
const REST_R: ArmKey = { up: V(-0.1, -1, 0.02), fore: V(-0.06, -1, 0.14), curl: 0.3 };
const GESTURES: Record<GestureId, Gesture> = {
  salut: { dur: 2.6, priority: 2, keys: [
    { t: 0, r: REST_R }, { t: 0.18, r: { up: V(-0.55, 0.12, 0.2), fore: V(-0.35, 0.9, 0.2), curl: 0.0 }, face: "smile", head: [0, -0.1, 0.05] },
    { t: 0.3, r: { up: V(-0.55, 0.12, 0.2), fore: V(-0.65, 0.75, 0.15), curl: 0.0 } }, { t: 0.42, r: { up: V(-0.55, 0.12, 0.2), fore: V(-0.15, 0.95, 0.2), curl: 0.0 } },
    { t: 0.54, r: { up: V(-0.55, 0.12, 0.2), fore: V(-0.65, 0.75, 0.15), curl: 0.0 } }, { t: 0.66, r: { up: V(-0.55, 0.12, 0.2), fore: V(-0.15, 0.95, 0.2), curl: 0.0 } },
    { t: 0.82, r: { up: V(-0.55, 0.12, 0.2), fore: V(-0.35, 0.9, 0.2), curl: 0.0 } }, { t: 1, r: REST_R }] },
  cravate: { dur: 3.2, priority: 2, keys: [
    { t: 0, r: REST_R }, { t: 0.25, r: { up: V(-0.45, -0.7, 0.55), fore: V(0.55, 0.62, 0.6), curl: 0.9 }, head: [0.08, 0, 0] },
    { t: 0.45, r: { up: V(-0.45, -0.7, 0.55), fore: V(0.5, 0.45, 0.72), curl: 0.9 } }, { t: 0.65, r: { up: V(-0.45, -0.7, 0.55), fore: V(0.58, 0.7, 0.5), curl: 0.9 } },
    { t: 0.8, r: { up: V(-0.45, -0.7, 0.55), fore: V(0.55, 0.55, 0.65), curl: 0.9 }, face: "smile" }, { t: 1, r: REST_R }] },
  veste: { dur: 2.8, priority: 2, keys: [
    { t: 0, r: REST_R, l: mirror(REST_R) },
    { t: 0.3, r: { up: V(-0.3, -0.92, 0.28), fore: V(0.28, -0.4, 0.88), curl: 0.8 }, l: mirror({ up: V(-0.3, -0.92, 0.28), fore: V(0.28, -0.4, 0.88), curl: 0.8 }) },
    { t: 0.55, r: { up: V(-0.3, -0.92, 0.28), fore: V(0.28, -0.6, 0.78), curl: 0.8 }, l: mirror({ up: V(-0.3, -0.92, 0.28), fore: V(0.28, -0.6, 0.78), curl: 0.8 }) },
    { t: 0.72, r: { up: V(-0.3, -0.92, 0.28), fore: V(0.28, -0.35, 0.9), curl: 0.8 }, l: mirror({ up: V(-0.3, -0.92, 0.28), fore: V(0.28, -0.35, 0.9), curl: 0.8 }) },
    { t: 1, r: REST_R, l: mirror(REST_R) }] },
  bras_croises: { dur: 4, priority: 1, hold: true, keys: [
    { t: 0, r: REST_R, l: mirror(REST_R) },
    { t: 0.22, r: { up: V(-0.18, -0.88, 0.42), fore: V(0.88, 0.1, 0.42), curl: 0.9 }, l: mirror({ up: V(-0.18, -0.88, 0.5), fore: V(0.78, 0.18, 0.62), curl: 0.9 }), chest: [-0.02, 0, 0] },
    { t: 1, r: { up: V(-0.18, -0.88, 0.42), fore: V(0.88, 0.1, 0.42), curl: 0.9 }, l: mirror({ up: V(-0.18, -0.88, 0.5), fore: V(0.78, 0.18, 0.62), curl: 0.9 }) }] },
  poches: { dur: 4, priority: 1, hold: true, keys: [
    { t: 0, r: REST_R, l: mirror(REST_R) },
    { t: 0.25, r: { up: V(-0.34, -0.9, -0.12), fore: V(0.3, -0.7, 0.62), curl: 0.6 }, l: mirror({ up: V(-0.34, -0.9, -0.12), fore: V(0.3, -0.7, 0.62), curl: 0.6 }) },
    { t: 1, r: { up: V(-0.34, -0.9, -0.12), fore: V(0.3, -0.7, 0.62), curl: 0.6 }, l: mirror({ up: V(-0.34, -0.9, -0.12), fore: V(0.3, -0.7, 0.62), curl: 0.6 }) }] },
  montre: { dur: 3.4, priority: 2, keys: [
    { t: 0, l: mirror(REST_R) },
    { t: 0.3, l: mirror({ up: V(-0.2, -0.8, 0.42), fore: V(0.55, 0.3, 0.8), curl: 0.5 }), head: [0.3, 0.35, 0.05] },
    { t: 0.75, l: mirror({ up: V(-0.2, -0.8, 0.42), fore: V(0.55, 0.3, 0.8), curl: 0.5 }), head: [0.3, 0.35, 0.05] }, { t: 1, l: mirror(REST_R) }] },
  presenter: { dur: 3.4, priority: 2, keys: [
    { t: 0, r: REST_R }, { t: 0.3, r: { up: V(-0.6, -0.5, 0.55), fore: V(-0.32, -0.05, 0.94), curl: 0.2 }, head: [0, -0.08, 0], face: "smile" },
    { t: 0.7, r: { up: V(-0.65, -0.42, 0.5), fore: V(-0.55, -0.02, 0.84), curl: 0.2 }, head: [0, -0.1, 0] }, { t: 1, r: REST_R }] },
  pointer: { dur: 3, priority: 2, keys: [
    { t: 0, r: REST_R }, { t: 0.25, r: { up: V(-0.3, -0.12, 0.95), fore: V(-0.24, 0.02, 0.97), curl: 0.9, point: true }, head: [0, -0.15, 0] },
    { t: 0.75, r: { up: V(-0.3, -0.12, 0.95), fore: V(-0.24, 0.02, 0.97), curl: 0.9, point: true } }, { t: 1, r: REST_R }] },
  acquiescer: { dur: 1.6, priority: 1, keys: [
    { t: 0, head: [0, 0, 0] }, { t: 0.2, head: [0.22, 0, 0], face: "smile" }, { t: 0.4, head: [-0.02, 0, 0] }, { t: 0.6, head: [0.2, 0, 0] }, { t: 0.8, head: [0, 0, 0] }, { t: 1, head: [0, 0, 0] }] },
  refus: { dur: 1.8, priority: 1, keys: [
    { t: 0, head: [0, 0, 0] }, { t: 0.2, head: [0, 0.3, 0], face: "displeased" }, { t: 0.4, head: [0, -0.3, 0] }, { t: 0.6, head: [0, 0.25, 0] }, { t: 0.8, head: [0, -0.2, 0] }, { t: 1, head: [0, 0, 0] }] },
  reflechir: { dur: 4.2, priority: 2, hold: true, keys: [
    { t: 0, r: REST_R, l: mirror(REST_R) },
    { t: 0.3, r: { up: V(-0.3, -0.62, 0.5), fore: V(0.18, 0.88, 0.45), curl: 0.8 }, l: mirror({ up: V(-0.1, -0.85, 0.42), fore: V(0.85, 0.05, 0.5), curl: 0.6 }), head: [0.1, 0.12, -0.12], face: "focus" },
    { t: 1, r: { up: V(-0.3, -0.62, 0.5), fore: V(0.18, 0.88, 0.45), curl: 0.8 }, l: mirror({ up: V(-0.1, -0.85, 0.42), fore: V(0.85, 0.05, 0.5), curl: 0.6 }), head: [0.1, 0.12, -0.12] }] },
  assurance: { dur: 4, priority: 1, hold: true, keys: [
    { t: 0, r: REST_R, l: mirror(REST_R) },
    { t: 0.3, r: { up: V(-0.28, -0.92, -0.2), fore: V(0.42, -0.52, -0.74), curl: 0.6 }, l: mirror({ up: V(-0.28, -0.92, -0.2), fore: V(0.42, -0.52, -0.74), curl: 0.6 }), chest: [-0.06, 0, 0], head: [-0.05, 0, 0] },
    { t: 1, r: { up: V(-0.28, -0.92, -0.2), fore: V(0.42, -0.52, -0.74), curl: 0.6 }, l: mirror({ up: V(-0.28, -0.92, -0.2), fore: V(0.42, -0.52, -0.74), curl: 0.6 }), chest: [-0.06, 0, 0], head: [-0.05, 0, 0] }] },
  bienvenue: { dur: 3.6, priority: 2, keys: [
    { t: 0, r: REST_R, l: mirror(REST_R) },
    { t: 0.3, r: { up: V(-0.78, -0.25, 0.4), fore: V(-0.62, 0.05, 0.78), curl: 0.1 }, l: mirror({ up: V(-0.78, -0.25, 0.4), fore: V(-0.62, 0.05, 0.78), curl: 0.1 }), head: [-0.02, 0.0, 0.07], face: "smile" },
    { t: 0.8, r: { up: V(-0.78, -0.25, 0.4), fore: V(-0.62, 0.05, 0.78), curl: 0.1 }, l: mirror({ up: V(-0.78, -0.25, 0.4), fore: V(-0.62, 0.05, 0.78), curl: 0.1 }), head: [-0.02, 0.0, 0.07] }, { t: 1, r: REST_R, l: mirror(REST_R) }] },
};

/* ───────── visage : expressions par cibles de morphing, clignements ───────── */
type Expr = "neutral" | "smile" | "surprise" | "focus" | "displeased";
const EXPR: Record<Expr, Record<string, number>> = {
  neutral: { mouthSmile: 0, mouthOpen: 0 }, smile: { mouthSmile: 0.85, mouthOpen: 0.08 }, surprise: { mouthSmile: 0, mouthOpen: 0.55 },
  focus: { mouthSmile: 0.12, mouthOpen: 0 }, displeased: { mouthSmile: -0.5, mouthOpen: 0 },
};
export class FaceController {
  private cur: Record<string, number> = { mouthSmile: 0, mouthOpen: 0 };
  private target: Expr = "neutral";
  private hold = 0;
  private blinkT = 2.5 + Math.random() * 3; private blinkP = -1;
  constructor(private dressed: Dressed) {}
  set(e: Expr, hold = 0) { this.target = e; this.hold = hold; }
  update(dt: number) {
    if (this.hold > 0) { this.hold -= dt; if (this.hold <= 0) this.target = "neutral"; }
    const tgt = EXPR[this.target], k = 1 - Math.exp(-dt * 6);
    for (const name of Object.keys(this.cur)) {
      this.cur[name] += ((tgt[name] ?? 0) - this.cur[name]) * k;
      for (const m of this.dressed.morphMeshes) { const i = m.morphTargetDictionary?.[name]; if (i !== undefined && m.morphTargetInfluences) m.morphTargetInfluences[i] = this.cur[name]; }
    }
    // clignement irrégulier : paupières qui s'abaissent puis remontent en ~0,16 s
    this.blinkT -= dt;
    if (this.blinkT <= 0 && this.blinkP < 0) { this.blinkP = 0; this.blinkT = 2 + Math.random() * 4.5; if (Math.random() < 0.15) this.blinkT = 0.35; }
    let close = 0;
    if (this.blinkP >= 0) { this.blinkP += dt / 0.16; close = Math.sin(Math.min(1, this.blinkP) * Math.PI); if (this.blinkP >= 1) this.blinkP = -1; }
    for (const l of this.dressed.lids) { const open = l.pivot.userData.open as number; l.pivot.rotation.x = lerp(open, 0.02, close); }
  }
}

/* ───────── animateur ───────── */
const SIDES: Side[] = ["Left", "Right"];
const ARM_BONES = (s: Side) => [`${s}Arm`, `${s}ForeArm`, `${s}Hand`];

export class CharacterAnimator {
  state: CharState = "IDLE";
  readonly face: FaceController;
  private rel = new Map<string, THREE.Quaternion>();
  private time = 0;
  private phase = 0;
  private vSm = 0;
  private yawLag = 0; private turnSm = 0;
  private sitW = 0; private wantSit = false;
  private gesture: { id: GestureId; t: number; w: number } | null = null; private gestureOut = false;
  private gazeTarget: THREE.Vector3 | null = null;
  private gaze = { yaw: 0, pitch: 0, wy: 0, wp: 0, next: 1 };
  private armDir = { Left: { up: new THREE.Vector3(), fore: new THREE.Vector3() }, Right: { up: new THREE.Vector3(), fore: new THREE.Vector3() } };
  private armRestAngle = { Left: 0, Right: 0 };
  private hips = new THREE.Vector3();
  private footRestY = 0.08;
  private hipsRestY = 0.95;
  private legL = 0.9;
  private model: THREE.Object3D;
  constructor(private rig: CharacterRig, dressed: Dressed, model: THREE.Object3D) {
    this.model = model;
    this.face = new FaceController(dressed);
    for (const name of Object.keys(rig.bones)) this.rel.set(name, new THREE.Quaternion());
    this.hipsRestY = rig.restPos("Hips").y;
    this.footRestY = rig.restPos("LeftFoot").y;
    this.legL = rig.length("LeftUpLeg", "LeftLeg") + rig.length("LeftLeg", "LeftFoot");
    for (const s of SIDES) { const d = rig.restDir(`${s}Arm`, `${s}ForeArm`); this.armRestAngle[s] = Math.atan2(Math.abs(d.x), -d.y); }
    this.eyes = { l: dressed.eyeBones.left, r: dressed.eyeBones.right };
  }
  private eyes: { l: THREE.Object3D | null; r: THREE.Object3D | null };
  lookAt(t: THREE.Vector3 | null) { this.gazeTarget = t ? t.clone() : null; }
  sit(on: boolean) { if (on && (this.state === "SIT" || this.sitW > 0.99)) return; this.wantSit = on; if (on) this.gesture = null; }
  get sitting() { return this.sitW > 0.5; }
  canPlay(id: GestureId) { const g = GESTURES[id]; return !this.wantSit && this.sitW < 0.05 && (!this.gesture || GESTURES[this.gesture.id].priority <= g.priority); }
  playGesture(id: GestureId) { if (!this.canPlay(id)) return; this.gesture = { id, t: 0, w: 0 }; this.gestureOut = false; this.state = "GESTURE"; }
  stopGesture() { if (this.gesture) this.gestureOut = true; }

  /* — éléments de pose — */
  private q(name: string) { return this.rel.get(name)!; }
  private setArm(side: Side, up: THREE.Vector3, fore: THREE.Vector3, w: number, totalParent: THREE.Quaternion) {
    const arm = `${side}Arm`, fa = `${side}ForeArm`, hand = `${side}Hand`;
    const dArm = new THREE.Quaternion().setFromUnitVectors(this.rig.restDir(arm, fa), up);
    const dFore = new THREE.Quaternion().setFromUnitVectors(this.rig.restDir(fa, hand), fore);
    const relArm = totalParent.clone().invert().multiply(dArm), relFore = dArm.clone().invert().multiply(dFore);
    this.q(arm).slerp(relArm, w); this.q(fa).slerp(relFore, w);
  }
  private chainTotal(names: string[]) {
    const t = new THREE.Quaternion();
    for (const n of names) t.multiply(this.q(n));
    return t;
  }

  update(dt: number, walkFlag: number, speed: number, turnRate: number) {
    dt = Math.min(dt, 0.05); this.time += dt;
    for (const q of this.rel.values()) q.identity();
    const rel = this.rel; const rig = this.rig;
    // — vitesses lissées —
    this.vSm += (speed - this.vSm) * (1 - Math.exp(-dt * 8)); const v = this.vSm;
    this.turnSm += (turnRate - this.turnSm) * (1 - Math.exp(-dt * 6));
    const turning = Math.abs(this.turnSm) > 0.7 && v < 0.35;
    const vEff = turning ? 0.85 : v;
    const walkW = smooth((vEff - 0.12) / 0.5), runW = smooth((vEff - 2.7) / 1.0);
    // — état —
    if (this.sitW > 0.02 || this.wantSit) this.state = this.wantSit ? (this.sitW > 0.95 ? "SIT" : "INTERACT") : "STAND_UP";
    else if (this.gesture) this.state = "GESTURE";
    else this.state = runW > 0.5 ? "RUN" : turning ? "TURN" : walkW > 0.5 ? "WALK" : "IDLE";
    // — assise —
    this.sitW += ((this.wantSit ? 1 : 0) - this.sitW) * (1 - Math.exp(-dt * 4));
    if (!this.wantSit && this.sitW < 0.02) this.sitW = 0;
    const sw = smooth(this.sitW), standW = 1 - sw;

    // — cycle de marche : phase avancée selon la vitesse, longueur de pas selon la vitesse —
    const stepLen = turning ? 0.3 : clamp(0.38 + 0.3 * vEff, 0.38, 1.25);
    const cycle = 2 * stepLen;
    if (vEff > 0.05) this.phase = (this.phase + (vEff / cycle) * dt) % 1;
    const sf = lerp(0.62, 0.4, runW);
    const pL = this.phase, pR = (this.phase + 0.5) % 1;
    const swing = (p: number) => Math.cos(2 * Math.PI * p);

    // — bassin : hauteur, balancement, rotation —
    const idleSway = Math.sin(this.time * 0.9) * 0.012 * (1 - walkW);
    const bob = 0.014 * walkW * Math.cos(4 * Math.PI * (this.phase - sf / 2)) + 0.012 * runW * Math.cos(4 * Math.PI * (this.phase - sf / 2));
    const crouch = 0.018 * walkW + 0.05 * runW;
    this.hips.set(idleSway + 0.018 * walkW * Math.cos(2 * Math.PI * (this.phase - sf / 2)), -crouch + bob - 0.01 * Math.sin(this.time * 1.4) * (1 - walkW), 0);
    const ampY = (0.1 * walkW + 0.14 * runW) * clamp(vEff / 1.4, 0.4, 1.4);
    const pelvisYaw = -ampY * swing(pL);
    const pelvisRoll = 0.04 * walkW * Math.sin(2 * Math.PI * (this.phase - sf / 2)) + Math.sin(this.time * 0.9) * 0.012 * (1 - walkW);
    const lean = 0.05 * walkW + 0.16 * runW;
    this.q("Hips").copy(qy(pelvisYaw)).multiply(qz(pelvisRoll)).multiply(qx(lean * 0.3));
    // — assise : le bassin descend et recule —
    this.hips.y = lerp(this.hips.y, -(this.hipsRestY - 0.54), sw);
    this.hips.z = lerp(this.hips.z, -0.14, sw);
    const hipsTotalNow = this.chainTotal(["Hips"]);
    // — jambes par cinématique inverse —
    const hipsPos = rig.hipsRest.clone().add(this.hips);
    const footTarget = (side: Side, p: number): { pos: THREE.Vector3; pitch: number; toe: number } => {
      const sx = side === "Left" ? 1 : -1, x = sx * 0.09;
      // pose debout au repos
      const idle = new THREE.Vector3(sx * 0.1, this.footRestY, 0.02);
      let walk = idle.clone(); let pitch = 0, toe = 0;
      const zF = (sf * cycle) / 2, zB = -zF + 0.02;
      if (p < sf) { const t = p / sf; walk = new THREE.Vector3(x, this.footRestY, lerp(zF, zB, t)); pitch = lerp(0.18, -0.12, smooth(t * 1.2)); toe = t > 0.85 ? (t - 0.85) * 3 : 0; }
      else { const t = (p - sf) / (1 - sf), s = smooth(t); const lift = (0.05 + 0.035 * clamp(vEff, 0, 3.4)) * Math.sin(Math.PI * Math.pow(t, 0.85)); walk = new THREE.Vector3(x, this.footRestY + lift, lerp(zB, zF, s)); pitch = lerp(-0.25, 0.2, smooth(t)); toe = (1 - t) * 0.5; }
      // sur les tours sur place, les pieds se rapprochent ; en mouvement lent, ils restent proches du repos
      const pos = idle.clone().lerp(walk, walkW);
      // posture assise : pied à plat devant les genoux
      const seat = new THREE.Vector3(sx * 0.11, this.footRestY, 0.34);
      return { pos: pos.lerp(seat, sw), pitch: lerp(pitch * walkW, 0, sw), toe: toe * walkW * standW };
    };
    for (const s of SIDES) { const ft = footTarget(s, s === "Left" ? pL : pR); rig.solveLeg(s, hipsTotalNow, hipsPos, ft.pos, rel, ft.pitch, ft.toe); }

    // — buste : contre-rotation, inclinaison, respiration —
    const torsoYaw = -pelvisYaw * 0.9 + clamp(-this.turnSm * 0.1, -0.2, 0.2);
    const breath = Math.sin(this.time * 1.45) * 0.012 * (1 - 0.5 * walkW);
    this.q("Spine").copy(qx(lean * 0.4 + breath * 0.5)).multiply(qy(torsoYaw * 0.3));
    this.q("Spine1").copy(qx(lean * 0.35 + breath * 0.8 - 0.02 * sw)).multiply(qy(torsoYaw * 0.35)).multiply(qz(-pelvisRoll * 0.6));
    this.q("Spine2").copy(qx(lean * 0.25 + breath + 0.012)).multiply(qy(torsoYaw * 0.35)).multiply(qz(-pelvisRoll * 0.4));
    // — bras : balancement opposé aux jambes (marche, course) ou position relâchée —
    const chestTotal = this.chainTotal(["Hips", "Spine", "Spine1", "Spine2"]);
    for (const s of SIDES) {
      const sx = s === "Left" ? 1 : -1, p = s === "Left" ? pL : pR;
      const rest = this.armRestAngle[s];
      const adduct = Math.max(0.06, rest - 0.1 * (1 - sw));            // bras plus près du corps qu'en pose de repos
      const swingA = (0.3 * walkW + 0.35 * runW) * swing(p) * clamp(vEff / 1.4, 0.5, 1.5);
      const elbow = 0.22 + 0.15 * (1 - walkW) * 0 + 0.3 * walkW * Math.max(0, -swing(p)) + 1.1 * runW + 0.25 * sw;
      const up = new THREE.Vector3(sx * Math.sin(adduct) * (1 - Math.abs(swingA)), -Math.cos(swingA), Math.sin(swingA)).normalize();
      const fore = new THREE.Vector3(sx * Math.sin(adduct) * 0.4, -Math.cos(swingA - elbow), Math.sin(swingA - elbow)).normalize();
      // assis : mains posées sur les cuisses
      const upSit = V(sx * 0.1, -0.85, 0.3), foreSit = V(-sx * 0.1, -0.35, 0.92);
      up.lerp(upSit, sw).normalize(); fore.lerp(foreSit, sw).normalize();
      const shoulderTotal = chestTotal.clone();
      this.setArm(s, up, fore, 1, shoulderTotal);
      this.armDir[s].up.copy(up); this.armDir[s].fore.copy(fore);
    }
    // — doigts : main détendue —
    this.curlHands(0.3 + 0.1 * Math.sin(this.time * 0.8) + 0.2 * runW, null);

    // — tête : stabilisation, regard, mouvements discrets —
    let headYaw = -torsoYaw * 0.6 - pelvisYaw * 0.4 + clamp(this.turnSm * 0.12, -0.35, 0.35), headPitch = -lean * 0.8 - 0.01 * Math.sin(this.time * 0.7);
    let headRoll = 0;

    // — geste en cours : superposé aux bras (et à la tête / au buste) —
    if (this.gesture) {
      const g = GESTURES[this.gesture.id];
      this.gesture.t += dt; const prog = this.gesture.t / g.dur;
      const target = this.gestureOut || (!g.hold && prog >= 1) ? 0 : 1;
      this.gesture.w += (target - this.gesture.w) * (1 - Math.exp(-dt * 7));
      if (target === 0 && this.gesture.w < 0.02) { this.gesture = null; this.gestureOut = false; }
      else {
        const w = this.gesture.w, p = g.hold ? Math.min(prog, 1) : Math.min(prog, 1);
        const k = sampleGesture(g, p);
        for (const s of SIDES) {
          const key = s === "Right" ? k.r : k.l; if (!key) continue;
          this.setArm(s, key.up, key.fore, w, chestTotal);
          this.curlHands(key.curl ?? 0.3, key.point ? s : null, w, s);
        }
        if (k.head) { headPitch = lerp(headPitch, headPitch + k.head[0], w); headYaw = lerp(headYaw, headYaw + k.head[1], w); headRoll = lerp(headRoll, k.head[2], w); }
        if (k.chest) { this.q("Spine1").multiply(qx(k.chest[0] * w)); this.q("Spine2").multiply(qx(k.chest[0] * w)); }
        if (k.face && !this.faceHeld) { this.face.set(k.face as Expr, 1.4); this.faceHeld = true; }
      }
    } else this.faceHeld = false;

    // — regard : yeux et tête vers la cible, ou saccades discrètes —
    this.updateGaze(dt, hipsPos);
    headYaw += this.gaze.wy * 0.35; headPitch += this.gaze.wp * 0.3;
    this.q("Neck").copy(qx(headPitch * 0.45)).multiply(qy(headYaw * 0.5)).multiply(qz(headRoll * 0.4));
    this.q("Head").copy(qx(headPitch * 0.55)).multiply(qy(headYaw * 0.5)).multiply(qz(headRoll * 0.6));
    if (this.eyes.l && this.eyes.r) {
      this.q("LeftEye").copy(qy(this.gaze.yaw)).multiply(qx(this.gaze.pitch)); this.q("RightEye").copy(qy(this.gaze.yaw)).multiply(qx(this.gaze.pitch));
    }
    this.face.update(dt);
    rig.apply(rel, this.hips);
  }
  private faceHeld = false;

  /** Courbure des doigts : `curl` (0 = ouverts, 1 = fermés) ; `point` : index tendu */
  private curlHands(curl: number, point: Side | null, w = 1, only?: Side) {
    for (const s of only ? [only] : SIDES) {
      const sx = s === "Left" ? 1 : -1;
      for (const f of FINGERS) {
        const base = f === "Thumb" ? 0.3 : curl;
        const c = point === s && f === "Index" ? 0.05 : point === s ? 0.95 : base;
        for (let j = 1; j <= 3; j++) {
          const name = `${s}Hand${f}${j}`; if (!this.rel.has(name)) continue;
          const a = (f === "Thumb" ? 0.5 : 0.62) * c * (j === 1 ? 0.8 : 1);
          const q = f === "Thumb" ? qz(-sx * a * 0.6).multiply(qx(-a * 0.35)) : qz(-sx * a);
          if (w >= 1) this.q(name).copy(q); else this.q(name).slerp(q, w);
        }
      }
    }
  }

  private updateGaze(dt: number, hipsPos: THREE.Vector3) {
    const g = this.gaze;
    let ty = g.wy, tp = g.wp;
    if (this.gazeTarget) {
      const head = this.rig.restPos("Head").clone().add(this.hips); head.y += 0.1;
      const local = this.model.worldToLocal(this.gazeTarget.clone());
      const d = local.sub(head);
      ty = clamp(Math.atan2(d.x, d.z), -1.1, 1.1); tp = clamp(-Math.atan2(d.y, Math.hypot(d.x, d.z)), -0.5, 0.5);
    } else {
      g.next -= dt;
      if (g.next <= 0) { g.next = 1.2 + Math.random() * 3.2; ty = (Math.random() - 0.5) * 0.4; tp = (Math.random() - 0.5) * 0.18; }
    }
    g.wy += (ty - g.wy) * (1 - Math.exp(-dt * 3)); g.wp += (tp - g.wp) * (1 - Math.exp(-dt * 3));
    // les yeux partent plus vite et plus loin que la tête (limites anatomiques)
    const ey = clamp(ty - g.wy * 0.35, -0.5, 0.5), ep = clamp(tp - g.wp * 0.3, -0.3, 0.3);
    g.yaw += (ey - g.yaw) * (1 - Math.exp(-dt * 14)); g.pitch += (ep - g.pitch) * (1 - Math.exp(-dt * 14));
    void hipsPos;
  }
}

function sampleGesture(g: Gesture, p: number) {
  const keys = g.keys; let i = 0; while (i < keys.length - 2 && p > keys[i + 1].t) i++;
  const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)];
  const t = a === b ? 0 : smooth((p - a.t) / (b.t - a.t));
  const arm = (ka: ArmKey | undefined, kb: ArmKey | undefined): ArmKey | undefined => {
    if (!ka && !kb) return undefined; const x = ka ?? kb!, y = kb ?? ka!;
    return { up: x.up.clone().lerp(y.up, t).normalize(), fore: x.fore.clone().lerp(y.fore, t).normalize(), curl: lerp(x.curl ?? 0.3, y.curl ?? 0.3, t), point: (t < 0.5 ? x.point : y.point) };
  };
  const trio = (x?: [number, number, number], y?: [number, number, number]): [number, number, number] | undefined => (x || y) ? [lerp(x?.[0] ?? 0, y?.[0] ?? 0, t), lerp(x?.[1] ?? 0, y?.[1] ?? 0, t), lerp(x?.[2] ?? 0, y?.[2] ?? 0, t)] : undefined;
  return { r: arm(a.r, b.r), l: arm(a.l, b.l), head: trio(a.head, b.head), chest: trio(a.chest, b.chest), face: a.face ?? b.face };
}
void ARM_BONES;

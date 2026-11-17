import * as THREE from "three";

/** Un os de chaque côté : préfixe « Left » ou « Right » */
export type Side = "Left" | "Right";
export const FINGERS = ["Thumb", "Index", "Middle", "Ring", "Pinky"] as const;

interface BoneRest { bone: THREE.Bone; parent: string | null; local: THREE.Quaternion; wr: THREE.Quaternion; wrpInv: THREE.Quaternion; pos: THREE.Vector3 }

/**
 * Squelette humanoïde du personnage (noms Mixamo / Ready Player Me).
 * Toutes les poses sont exprimées comme des rotations « delta » dans le repère du personnage (x droite, y haut, z devant),
 * appliquées par-dessus la pose de repos : local = inv(Wr_parent) · delta · Wr_os. Les rotations restent donc indépendantes
 * de l'orientation locale des os, et se composent le long de la chaîne (hanche → cuisse → tibia…).
 */
export class CharacterRig {
  readonly bones: Record<string, THREE.Bone> = {};
  private rest: Record<string, BoneRest> = {};
  private order: string[] = [];
  /** Rotation totale (cumulée) de chaque os pour l'image en cours */
  readonly total: Record<string, THREE.Quaternion> = {};
  /** Position de repos des hanches (repère du personnage) */
  readonly hipsRest = new THREE.Vector3();
  private hipsLocal = new THREE.Vector3();
  constructor(model: THREE.Object3D) {
    model.updateMatrixWorld(true);
    const rootInv = model.getWorldQuaternion(new THREE.Quaternion()).invert();
    const rootPosInv = model.getWorldPosition(new THREE.Vector3()).negate();
    model.traverse((o) => { if ((o as THREE.Bone).isBone) this.bones[o.name] = o as THREE.Bone; });
    const visit = (b: THREE.Bone, parent: string | null) => {
      const wq = b.getWorldQuaternion(new THREE.Quaternion()).premultiply(rootInv);
      const parentWq = parent ? this.rest[parent].wr : (b.parent ? b.parent.getWorldQuaternion(new THREE.Quaternion()).premultiply(rootInv) : new THREE.Quaternion());
      this.rest[b.name] = { bone: b, parent, local: b.quaternion.clone(), wr: wq, wrpInv: parentWq.clone().invert(), pos: b.getWorldPosition(new THREE.Vector3()).add(rootPosInv) };
      this.total[b.name] = new THREE.Quaternion();
      this.order.push(b.name);
      for (const c of b.children) if ((c as THREE.Bone).isBone) visit(c as THREE.Bone, b.name);
    };
    const hips = this.bones["Hips"]; if (!hips) throw new Error("Squelette sans os « Hips »");
    visit(hips, null);
    this.hipsRest.copy(this.rest["Hips"].pos); this.hipsLocal.copy(hips.position);
  }
  has(name: string) { return !!this.bones[name]; }
  restPos(name: string) { return this.rest[name].pos; }
  restDir(from: string, to: string) { return this.rest[to].pos.clone().sub(this.rest[from].pos).normalize(); }
  length(from: string, to: string) { return this.rest[to].pos.distanceTo(this.rest[from].pos); }
  /** Applique la pose : `rel` = delta de chaque os par rapport à son parent ; `hipsOffset` = déplacement des hanches */
  apply(rel: Map<string, THREE.Quaternion>, hipsOffset: THREE.Vector3) {
    for (const name of this.order) {
      const r = this.rest[name], d = rel.get(name), total = this.total[name];
      const pt = r.parent ? this.total[r.parent] : null;
      if (pt) total.copy(pt); else total.identity();
      if (d) { total.multiply(d); r.bone.quaternion.copy(r.wrpInv).multiply(d).multiply(r.wr); }
      else r.bone.quaternion.copy(r.local);
    }
    this.bones["Hips"].position.copy(this.hipsLocal).add(hipsOffset);
  }
  /**
   * Cinématique inverse à deux os (cuisse + tibia) : place le pied sur `foot` (repère du personnage).
   * `hipsTotal` = rotation totale des hanches, `hipsPos` = position courante du bassin.
   */
  solveLeg(side: Side, hipsTotal: THREE.Quaternion, hipsPos: THREE.Vector3, foot: THREE.Vector3, rel: Map<string, THREE.Quaternion>, footPitch = 0, toePitch = 0) {
    const up = `${side}UpLeg`, kn = `${side}Leg`, ft = `${side}Foot`, toe = `${side}ToeBase`;
    const L1 = this.length(up, kn), L2 = this.length(kn, ft);
    const hipJoint = this.restPos(up).clone().sub(this.hipsRest).applyQuaternion(hipsTotal).add(hipsPos);
    const d = foot.clone().sub(hipJoint); let D = d.length(); const dn = d.clone().divideScalar(D || 1);
    D = Math.min(Math.max(D, Math.abs(L1 - L2) + 0.01), L1 + L2 - 0.002);
    const cosA = THREE.MathUtils.clamp((L1 * L1 + D * D - L2 * L2) / (2 * L1 * D), -1, 1);
    const A = Math.acos(cosA);
    const axis = new THREE.Vector3().crossVectors(dn, new THREE.Vector3(0, 0, 1)); if (axis.lengthSq() < 1e-6) axis.set(1, 0, 0); axis.normalize();
    const t = dn.clone().applyAxisAngle(axis, A);
    const knee = hipJoint.clone().addScaledVector(t, L1);
    const s = foot.clone().sub(knee).normalize();
    const thighTotal = new THREE.Quaternion().setFromUnitVectors(this.restDir(up, kn), t);
    const shinTotal = new THREE.Quaternion().setFromUnitVectors(this.restDir(kn, ft), s);
    rel.set(up, this.relFromTotalWith(hipsTotal, thighTotal));
    rel.set(kn, this.relFromTotalWith(thighTotal, shinTotal));
    const footTotal = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), footPitch);
    rel.set(ft, this.relFromTotalWith(shinTotal, footTotal));
    if (this.has(toe)) rel.set(toe, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), toePitch));
  }
  private relFromTotalWith(parentTotal: THREE.Quaternion, target: THREE.Quaternion) { return parentTotal.clone().invert().multiply(target); }
}

const AX = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };
const _q = new THREE.Quaternion();
/** Quaternion à partir d'angles (radians) autour des axes du personnage : x = tangage, y = lacet, z = roulis */
export function qx(a: number, out = new THREE.Quaternion()) { return out.setFromAxisAngle(AX.x, a); }
export function qy(a: number, out = new THREE.Quaternion()) { return out.setFromAxisAngle(AX.y, a); }
export function qz(a: number, out = new THREE.Quaternion()) { return out.setFromAxisAngle(AX.z, a); }
export function qxyz(x: number, y: number, z: number, out = new THREE.Quaternion()) { out.setFromAxisAngle(AX.y, y); _q.setFromAxisAngle(AX.x, x); out.multiply(_q); _q.setFromAxisAngle(AX.z, z); out.multiply(_q); return out; }

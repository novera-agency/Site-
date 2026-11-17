import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { Avatar } from "@/engine/avatar";
import { loadAvatarGltf } from "./assets";
import { CharacterRig } from "./rig";
import { dressCharacter, prepareTemplate, type Dressed } from "./customize";
import { CharacterAnimator, type GestureId } from "./animator";

/** Personnage 3D complet (modèle riggé, habillage, animation) ; même interface que l'ancien avatar procédural */
export interface Character {
  root: THREE.Group;
  head: THREE.Object3D;
  /** `speed` : vitesse de déplacement en m/s ; `turnRate` : vitesse de rotation en rad/s */
  update(dt: number, walk: number, ctx?: { speed?: number; turnRate?: number }): void;
  dispose(): void;
  readonly animator: CharacterAnimator;
  gesture(id: GestureId): void;
  sit(on: boolean): void;
  lookAt(target: THREE.Vector3 | null): void;
  setExpression(name: "neutral" | "smile" | "surprise" | "focus" | "displeased"): void;
}

export async function buildCharacter(a: Avatar): Promise<Character> {
  const gltf = await loadAvatarGltf();
  gltf.scene.updateMatrixWorld(true);
  let neckY = 1.55; gltf.scene.traverse((o) => { if (o.name === "Neck" && (o as THREE.Bone).isBone) neckY = o.getWorldPosition(new THREE.Vector3()).y; });
  prepareTemplate(gltf.scene, neckY);
  const model = cloneSkinned(gltf.scene) as THREE.Group;
  const root = new THREE.Group(); root.add(model);
  root.updateMatrixWorld(true);
  const rig = new CharacterRig(model);
  const dressed: Dressed = dressCharacter(model, rig, a);
  const k = 0.97 + 0.03 * a.height, w = [0.96, 1, 1.06][a.build];
  root.scale.set(k * w, k, k * w);
  const animator = new CharacterAnimator(rig, dressed, model);
  return {
    root, head: rig.bones["Head"], animator,
    update(dt, walk, ctx) { animator.update(dt, walk, ctx?.speed ?? 0, ctx?.turnRate ?? 0); },
    gesture: (id) => animator.playGesture(id),
    sit: (on) => animator.sit(on),
    lookAt: (t) => animator.lookAt(t),
    setExpression: (n) => animator.face.set(n),
    dispose() { dressed.dispose(); root.removeFromParent(); },
  };
}

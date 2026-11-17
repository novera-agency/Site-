import * as THREE from "three";
import type { Avatar } from "@/engine/avatar";
import { buildAvatar, type AvatarRig } from "./avatar3d";
import { buildCharacter, type Character } from "./character/character";

/**
 * Emplacement d'un personnage dans la scène : affiche tout de suite l'avatar procédural de secours,
 * puis le remplace par le personnage riggé (modèle GLB) dès qu'il est chargé. Si le chargement échoue, le secours reste.
 */
export class RigSlot {
  readonly root = new THREE.Group();
  private proc: AvatarRig | null = null;
  character: Character | null = null;
  private token = 0;
  private dead = false;
  constructor(avatar: Avatar, private useModel = true) { this.setAvatar(avatar); }
  get head(): THREE.Object3D | null { return this.character?.head ?? this.proc?.head ?? null; }
  setAvatar(a: Avatar) {
    const my = ++this.token;
    if (!this.character && !this.proc) { this.proc = buildAvatar(a); this.root.add(this.proc.root); }
    if (!this.useModel) { if (this.proc) { this.root.remove(this.proc.root); this.proc.dispose(); } this.proc = buildAvatar(a); this.root.add(this.proc.root); return; }
    buildCharacter(a).then((c) => {
      if (this.dead || my !== this.token) { c.dispose(); return; }
      const prev = this.character; if (prev) prev.dispose();
      if (this.proc) { this.root.remove(this.proc.root); this.proc.dispose(); this.proc = null; }
      this.character = c; this.root.add(c.root);
    }).catch(() => { /* modèle indisponible : l'avatar de secours reste affiché */ });
  }
  update(dt: number, walk: number, ctx?: { speed?: number; turnRate?: number }) {
    if (this.character) this.character.update(dt, walk, ctx); else this.proc?.update(dt, walk);
  }
  dispose() { this.dead = true; this.character?.dispose(); this.proc?.dispose(); this.root.removeFromParent(); }
}

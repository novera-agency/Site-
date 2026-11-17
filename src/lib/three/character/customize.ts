import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { type Avatar, SKINS, HAIR_COLORS, SUITS, SHIRTS, TIES, GLASSES, WATCHES } from "@/engine/avatar";
import type { CharacterRig } from "./rig";

/**
 * Habillage du modèle : matériaux PBR distincts (laine, coton, soie, cuir, peau), teintes du costume, cheveux en mèches,
 * cravate modélisée, accessoires et paupières. Les géométries du modèle sont partagées entre personnages ; les matériaux sont clonés.
 */
export interface Dressed {
  /** Maillages avec cibles de morphing (visage) */
  morphMeshes: THREE.Mesh[];
  /** Paupières (clignement) : calottes de peau qui s'abaissent devant chaque œil */
  lids: { pivot: THREE.Object3D }[];
  eyeBones: { left: THREE.Object3D | null; right: THREE.Object3D | null };
  dispose(): void;
}

const mix = (a: string, b: string, k: number) => `#${new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString()}`;

/* ───── préparation unique du modèle (partagée par tous les personnages) ───── */
const prepared = new WeakSet<THREE.Object3D>();
function pixelReader(tex: THREE.Texture) {
  const img = tex.image as ImageBitmap | HTMLImageElement | undefined; if (!img) return null;
  const w = (img as ImageBitmap).width, h = (img as ImageBitmap).height;
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h; const c = cv.getContext("2d", { willReadFrequently: true })!;
  c.drawImage(img as CanvasImageSource, 0, 0); const data = c.getImageData(0, 0, w, h).data;
  return (u: number, v: number) => { const x = Math.min(w - 1, Math.max(0, Math.floor((u % 1 + 1) % 1 * w))), y = Math.min(h - 1, Math.max(0, Math.floor(((v % 1 + 1) % 1) * h))); const i = (y * w + x) * 4; return [data[i] / 255, data[i + 1] / 255, data[i + 2] / 255] as const; };
}
/** Retire du costume d'origine la fleur à la boutonnière, le nœud papillon (remplacé par une vraie cravate) et le chapeau */
export function prepareTemplate(scene: THREE.Object3D, neckY: number) {
  if (prepared.has(scene)) return; prepared.add(scene);
  scene.traverse((o) => {
    const m = o as THREE.SkinnedMesh; if (!m.isSkinnedMesh) return;
    if (m.name === "Wolf3D_Headwear") { m.visible = false; return; }
    if (m.name !== "Wolf3D_Outfit_Top") return;
    const map = (m.material as THREE.MeshStandardMaterial).map; const read = map ? pixelReader(map) : null; if (!read) return;
    const geo = m.geometry, idx = geo.index!, uv = geo.attributes.uv, pos = geo.attributes.position;
    const keep: number[] = [], v = new THREE.Vector3();
    for (let i = 0; i < idx.count; i += 3) {
      const a = idx.getX(i), b = idx.getX(i + 1), c = idx.getX(i + 2);
      const u = (uv.getX(a) + uv.getX(b) + uv.getX(c)) / 3, w = (uv.getY(a) + uv.getY(b) + uv.getY(c)) / 3;
      const [r, g, bl] = read(u, w);
      const green = g > r * 1.12 && g > bl * 1.12, rose = r > 0.62 && g < 0.42 && r - g > 0.3 && r - bl > 0.15;
      const purple = Math.min(r, bl) > g + 0.04 && r < 0.75;
      m.getVertexPosition(a, v); const ya = v.y; m.getVertexPosition(b, v); const yb = v.y; m.getVertexPosition(c, v); const yc = v.y;
      const y = (ya + yb + yc) / 3;
      const bow = purple && y > neckY - 0.12;
      if (green || rose || bow) continue;
      keep.push(a, b, c);
    }
    geo.setIndex(keep);
  });
}

/* ───── matériaux ───── */
const base = { skin: new THREE.Color("#e6c3ae") };
function tintSkin(m: THREE.MeshStandardMaterial, hex: string) {
  const t = new THREE.Color(hex);
  m.color.setRGB(Math.min(1.25, t.r / base.skin.r), Math.min(1.25, t.g / base.skin.g), Math.min(1.25, t.b / base.skin.b));
  m.roughness = 0.62;
}
/** Teinte le costume en conservant le relief du tissu : la luminance de la texture d'origine module la couleur choisie */
function tintOutfit(m: THREE.MeshStandardMaterial, suit: THREE.Color, vest: THREE.Color, shirt: THREE.Color, trousers: boolean) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uSuit = { value: suit }; sh.uniforms.uVest = { value: vest }; sh.uniforms.uShirt = { value: shirt };
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform vec3 uSuit; uniform vec3 uVest; uniform vec3 uShirt;")
      .replace("#include <map_fragment>", `#include <map_fragment>
      {
        vec3 c0 = diffuseColor.rgb;
        float mx = max(c0.r, max(c0.g, c0.b)), mn = min(c0.r, min(c0.g, c0.b));
        float sat = (mx - mn) / max(mx, 1e-4);
        float lum = dot(c0, vec3(0.2126, 0.7152, 0.0722));
        float wSat = smoothstep(0.2, 0.32, sat);
        float purple = step(c0.g + 0.015, min(c0.r, c0.b));
        vec3 cloth = uSuit * (0.38 + 1.15 * lum);
        vec3 vest = uVest * (0.4 + 1.1 * lum);
        vec3 shirt = c0 * uShirt;
        ${trousers ? "vec3 colored = cloth;" : "vec3 colored = mix(cloth, vest, purple);"}
        diffuseColor.rgb = mix(shirt, colored, wSat);
      }`);
  };
  m.customProgramCacheKey = () => `outfit-${trousers ? "b" : "t"}`;
}

export function dressCharacter(model: THREE.Object3D, rig: CharacterRig, a: Avatar): Dressed {
  const disposables: { dispose(): void }[] = [];
  const reg = <T extends { dispose(): void }>(x: T) => { disposables.push(x); return x; };
  const skinHex = SKINS[a.skin].color!, hairHex = HAIR_COLORS[a.hairColor].color!;
  const suitC = new THREE.Color(SUITS[a.suit].color!), shirtC = new THREE.Color(SHIRTS[a.shirt].color!);
  const tieHex = a.tie > 0 ? TIES[a.tie].color! : SUITS[a.suit].color!;
  const vestC = new THREE.Color(a.tie > 0 ? mix(SUITS[a.suit].color!, "#000000", 0.25) : mix(SUITS[a.suit].color!, "#ffffff", 0.04));
  const morphMeshes: THREE.Mesh[] = [];
  const skinMats: THREE.MeshStandardMaterial[] = [];
  model.traverse((o) => {
    const mesh = o as THREE.SkinnedMesh; if (!mesh.isSkinnedMesh) return;
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
    const orig = mesh.material as THREE.MeshStandardMaterial;
    const mat = reg(orig.clone()) as THREE.MeshStandardMaterial; mesh.material = mat;
    if (mesh.morphTargetDictionary) morphMeshes.push(mesh);
    switch (mesh.name) {
      case "Wolf3D_Head": case "Wolf3D_Body": tintSkin(mat, skinHex); skinMats.push(mat); break;
      case "Wolf3D_Outfit_Top": tintOutfit(mat, suitC, vestC, shirtC, false); mat.roughness = 0.82; break;
      case "Wolf3D_Outfit_Bottom": tintOutfit(mat, suitC, vestC, shirtC, true); mat.roughness = 0.84; break;
      case "Wolf3D_Outfit_Footwear": mat.color.set("#1b1210"); mat.roughness = 0.32; break;
      case "Wolf3D_Beard": mesh.visible = a.beard === 3; mat.map = null; mat.color.set(hairHex).multiplyScalar(0.9); break;
      case "Wolf3D_Headwear": mesh.visible = false; break;
      default: break;
    }
  });

  /* ───── repères tête : chaque accessoire vit dans un groupe aligné sur le personnage et rattaché à l'os ───── */
  const aligned = (bone: THREE.Object3D, boneName: string) => {
    const g = new THREE.Group();
    const wr = new THREE.Quaternion(); bone.getWorldQuaternion(wr); const root = model.getWorldQuaternion(new THREE.Quaternion());
    g.quaternion.copy(wr).premultiply(root.invert()).invert(); // annule l'orientation de l'os : axes du groupe = axes du personnage
    g.userData.boneName = boneName; bone.add(g); return g;
  };
  const head = rig.bones["Head"], headG = aligned(head, "Head");
  const eyeL = rig.bones["LeftEye"] ?? null, eyeR = rig.bones["RightEye"] ?? null;
  const geom = <T extends THREE.BufferGeometry>(g: T) => reg(g);
  const stdMat = (p: THREE.MeshStandardMaterialParameters) => reg(new THREE.MeshStandardMaterial(p));
  const add = (parent: THREE.Object3D, g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o; };

  /* ───── cheveux : coque au plus près du crâne + mèches ───── */
  buildHair(model, rig, headG, a, hairHex, reg);

  /* ───── paupières ───── */
  const lids: Dressed["lids"] = [];
  const skinMat = skinMats[0];
  const lidMat = reg(new THREE.MeshStandardMaterial({ color: new THREE.Color(skinHex).multiplyScalar(0.93), roughness: 0.6 }));
  const eyeMeshes: THREE.Mesh[] = []; model.traverse((o) => { if ((o.name === "EyeLeft" || o.name === "EyeRight") && (o as THREE.Mesh).isMesh) eyeMeshes.push(o as THREE.Mesh); });
  for (const em of eyeMeshes) {
    em.geometry.computeBoundingSphere(); const bs = em.geometry.boundingSphere!;
    const bone = em.name === "EyeLeft" ? eyeL : eyeR; if (!bone || !skinMat) continue;
    const eg = aligned(bone, em.name); model.updateMatrixWorld(true);
    const pivot = new THREE.Group(); pivot.position.copy(eg.worldToLocal(em.localToWorld(bs.center.clone()))); eg.add(pivot);
    const lid = new THREE.Mesh(geom(new THREE.SphereGeometry(bs.radius * 1.04, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.42)), lidMat); lid.scale.set(1, 0.85, 0.8);
    lid.rotation.x = Math.PI / 2; lid.castShadow = false; pivot.add(lid); pivot.rotation.x = -1.2; pivot.userData.open = -1.2;
    lids.push({ pivot });
  }

  /* ───── accessoires ───── */
  if (a.glasses > 0) {
    const fm = stdMat({ color: GLASSES[a.glasses].color!, roughness: 0.25, metalness: 0.7 });
    const lensM = reg(new THREE.MeshPhysicalMaterial({ color: "#cfe8ff", roughness: 0.02, transparent: true, opacity: 0.1, clearcoat: 1 }));
    const gg = new THREE.Group(); headG.add(gg);
    for (const sx of [-1, 1]) {
      const x = sx * 0.031, y = 0.092, z = 0.103;
      if (a.glasses === 2) add(gg, geom(rectFrame(0.05, 0.034, 0.004, 0.007)), fm, x, y, z);
      else add(gg, geom(new THREE.TorusGeometry(0.0235, 0.0028, 10, 36)), fm, x, y, z);
      add(gg, geom(new THREE.CircleGeometry(0.023, 24)), lensM, x, y, z + 0.002).castShadow = false;
      add(gg, geom(new THREE.BoxGeometry(0.003, 0.003, 0.1)), fm, sx * 0.068, y + 0.004, z - 0.05).castShadow = false;
    }
    add(gg, geom(new THREE.BoxGeometry(0.018, 0.004, 0.004)), fm, 0, 0.098, z0()).castShadow = false;
  }
  if (a.watch > 0 && rig.bones["LeftHand"]) {
    const wm = stdMat({ color: WATCHES[a.watch].color!, roughness: 0.2, metalness: 1 });
    const hand = rig.bones["LeftHand"], wg = aligned(hand, "LeftHand");
    const pos = hand.position.clone().multiplyScalar(0).add(new THREE.Vector3(0, 0, 0));
    wg.position.copy(pos);
    const strap = add(wg, geom(new THREE.TorusGeometry(0.031, 0.006, 10, 28)), wm, 0.0, 0.0, 0.0); strap.rotation.y = Math.PI / 2; strap.position.set(0, -0.012, 0);
    add(wg, geom(new THREE.CylinderGeometry(0.016, 0.016, 0.008, 28)), wm, 0, -0.012, 0.034).rotation.x = Math.PI / 2;
  }
  const spine2 = rig.bones["Spine2"], chestG = aligned(spine2, "Spine2");
  /* ───── cravate : nœud et lame en soie ───── */
  if (a.tie > 0) buildTie(model, chestG, tieHex, a.tie === 6, reg);
  void SHIRTS;
  return {
    morphMeshes, lids, eyeBones: { left: eyeL, right: eyeR },
    dispose() { disposables.forEach((d) => d.dispose()); headG.removeFromParent(); chestG.removeFromParent(); for (const l of lids) l.pivot.parent?.removeFromParent(); },
  };
}
const z0 = () => 0.105;

function rectFrame(w: number, h: number, t: number, r: number) {
  const rr = (p: THREE.Path, x: number, y: number, ww: number, hh: number, k: number) => { p.moveTo(x + k, y); p.lineTo(x + ww - k, y); p.quadraticCurveTo(x + ww, y, x + ww, y + k); p.lineTo(x + ww, y + hh - k); p.quadraticCurveTo(x + ww, y + hh, x + ww - k, y + hh); p.lineTo(x + k, y + hh); p.quadraticCurveTo(x, y + hh, x, y + hh - k); p.lineTo(x, y + k); p.quadraticCurveTo(x, y, x + k, y); };
  const s = new THREE.Shape(); rr(s, -w / 2, -h / 2, w, h, r);
  const hole = new THREE.Path(); rr(hole, -w / 2 + t, -h / 2 + t, w - 2 * t, h - 2 * t, r * 0.6); s.holes.push(hole);
  return new THREE.ExtrudeGeometry(s, { depth: 0.004, bevelEnabled: false });
}

/** Rayon de la surface du torse (axe z) à la hauteur donnée : sert à poser la cravate au contact du costume */
function chestFront(model: THREE.Object3D, y: number): number | null {
  let top: THREE.Mesh | null = null; model.traverse((o) => { if (o.name === "Wolf3D_Outfit_Top" && (o as THREE.Mesh).isMesh) top = o as THREE.Mesh; });
  if (!top) return null;
  const ray = new THREE.Raycaster(new THREE.Vector3(0, y, 1.5), new THREE.Vector3(0, 0, -1), 0, 3);
  const hit = ray.intersectObject(top, false)[0]; return hit ? 1.5 - hit.distance : null;
}
function buildTie(model: THREE.Object3D, chestG: THREE.Object3D, hex: string, bow: boolean, reg: <T extends { dispose(): void }>(x: T) => T) {
  // coordonnées dans le repère du personnage ; le groupe suit l'os Spine2 (origine à l'os) : on convertit via la position de repos
  const sp = chestG.parent!.getWorldPosition(new THREE.Vector3()).sub(model.getWorldPosition(new THREE.Vector3())); const spine2Y = sp.y, spine2Z = sp.z;
  const mat = reg(new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.34, sheen: 1, sheenRoughness: 0.28, sheenColor: new THREE.Color(hex).lerp(new THREE.Color("#ffffff"), 0.45), clearcoat: 0.25, clearcoatRoughness: 0.3 }));
  const yNeck = spine2Y + 0.19, yEnd = spine2Y - 0.2;
  const frontAt = (yy: number) => (chestFront(model, yy) ?? 0.11) + 0.004;
 
  const g = new THREE.Group(); chestG.add(g);
  const place = (o: THREE.Object3D, yy: number, z: number) => { o.position.set(0, yy - spine2Y, z - spine2Z); };
  if (bow) {
    for (const sx of [-1, 1]) { const w = new THREE.Mesh(reg(new THREE.ConeGeometry(0.034, 0.07, 6)), mat); w.rotation.z = sx * Math.PI / 2; w.scale.z = 0.45; w.castShadow = true; place(w, yNeck, frontAt(yNeck) + 0.01); w.position.x = sx * 0.04; g.add(w); }
    const k = new THREE.Mesh(reg(new THREE.SphereGeometry(0.016, 14, 10)), mat); place(k, yNeck, frontAt(yNeck) + 0.012); g.add(k);
    return;
  }
  // lame effilée, légèrement bombée, qui épouse le buste
  const blade = new THREE.Shape(); const w0 = 0.0175, w1 = 0.034;
  blade.moveTo(-w0, 0); blade.lineTo(w0, 0); blade.lineTo(w1, -(yNeck - yEnd - 0.04)); blade.lineTo(0, -(yNeck - yEnd)); blade.lineTo(-w1, -(yNeck - yEnd - 0.04)); blade.closePath();
  const geo = reg(new THREE.ExtrudeGeometry(blade, { depth: 0.004, bevelEnabled: true, bevelSize: 0.0025, bevelThickness: 0.002, bevelSegments: 2, curveSegments: 4 }));
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) { const yy = yNeck + p.getY(i) - 0.0; p.setZ(i, p.getZ(i) + frontAt(yy) - frontAt(yNeck)); }
  geo.computeVertexNormals();
  const b = new THREE.Mesh(geo, mat); b.castShadow = true; b.position.set(0, yNeck - spine2Y - 0.015, frontAt(yNeck) - spine2Z + 0.003); g.add(b);
  const knot = new THREE.Mesh(reg(new THREE.SphereGeometry(1, 20, 14)), mat); knot.scale.set(0.024, 0.021, 0.016); knot.castShadow = true; place(knot, yNeck - 0.004, frontAt(yNeck) + 0.008); g.add(knot);
  const clip = new THREE.Mesh(reg(new THREE.BoxGeometry(0.04, 0.004, 0.003)), reg(new THREE.MeshStandardMaterial({ color: "#d8b14c", roughness: 0.22, metalness: 1 }))); place(clip, yNeck - 0.12, frontAt(yNeck - 0.12) + 0.005); g.add(clip);
}

/* ───── cheveux : sous-couche + mèches rubanées qui suivent le crâne ───── */
function buildHair(model: THREE.Object3D, rig: CharacterRig, headG: THREE.Object3D, a: Avatar, hairHex: string, reg: <T extends { dispose(): void }>(x: T) => T) {
  if (a.hair === 0) return;
  let headMesh: THREE.SkinnedMesh | null = null; model.traverse((o) => { if (o.name === "Wolf3D_Head" && (o as THREE.SkinnedMesh).isSkinnedMesh) headMesh = o as THREE.SkinnedMesh; });
  if (!headMesh) return;
  const hm: THREE.SkinnedMesh = headMesh;
  const headPos = rig.restPos("Head");
  const eyeY = (rig.has("LeftEye") ? rig.restPos("LeftEye").y : headPos.y + 0.09) - headPos.y;
  const center = new THREE.Vector3(0, eyeY, 0.0);
  // rayon du crâne par direction (relevé sur les sommets de la tête)
  const NT = 28, NP = 56; const R = new Float32Array(NT * NP);
  const v = new THREE.Vector3();
  for (let i = 0; i < hm.geometry.attributes.position.count; i++) {
    hm.getVertexPosition(i, v); v.sub(headPos).sub(center);
    const r = v.length(); if (r < 1e-4) continue;
    const th = Math.acos(THREE.MathUtils.clamp(v.y / r, -1, 1)), ph = Math.atan2(v.x, v.z);
    const ti = Math.min(NT - 1, Math.floor((th / Math.PI) * NT)), pi = (((Math.floor(((ph + Math.PI) / (2 * Math.PI)) * NP)) % NP) + NP) % NP;
    R[ti * NP + pi] = Math.max(R[ti * NP + pi], r);
  }
  for (let pass = 0; pass < 3; pass++) for (let ti = 0; ti < NT; ti++) for (let pi = 0; pi < NP; pi++) { // comble les cases vides
    if (R[ti * NP + pi] > 0) continue; let s = 0, n = 0;
    for (const [dt, dp] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { const tj = ti + dt, pj = (pi + dp + NP) % NP; if (tj >= 0 && tj < NT && R[tj * NP + pj] > 0) { s += R[tj * NP + pj]; n++; } }
    if (n) R[ti * NP + pi] = s / n;
  }
  const radius = (th: number, ph: number) => R[Math.min(NT - 1, Math.max(0, Math.floor((th / Math.PI) * NT))) * NP + ((((Math.floor(((ph + Math.PI) / (2 * Math.PI)) * NP)) % NP) + NP) % NP)] || 0.1;
  const dirOf = (th: number, ph: number) => new THREE.Vector3(Math.sin(th) * Math.sin(ph), Math.cos(th), Math.sin(th) * Math.cos(ph));
  const pointAt = (u: THREE.Vector3, lift: number) => {
    const th = Math.acos(THREE.MathUtils.clamp(u.y, -1, 1)), ph = Math.atan2(u.x, u.z);
    return u.clone().multiplyScalar(radius(th, ph) + lift).add(center);
  };
  // ligne des cheveux : angle polaire maximal selon l'azimut (front, tempes, côtés au-dessus des oreilles, nuque)
  const HL: [number, number][] = [[0, 0.9], [0.35, 0.98], [0.8, 1.14], [1.57, 1.34], [2.3, 1.7], [Math.PI, 1.95]];
  const hairline = (ph: number) => { const f = Math.abs(ph); for (let i = 0; i < HL.length - 1; i++) if (f <= HL[i + 1][0]) { const k = (f - HL[i][0]) / (HL[i + 1][0] - HL[i][0]); return HL[i][1] + (HL[i + 1][1] - HL[i][1]) * k; } return HL[HL.length - 1][1]; };
  const hairM = reg(new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.38, metalness: 0.12, side: THREE.DoubleSide, vertexColors: true }));
  const group = new THREE.Group(); headG.add(group);
  const rand = (() => { let s = 4242; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  const base = new THREE.Color(hairHex);
  const style = a.hair === 1 ? "short" : a.hair === 5 ? "long" : "back";
  // 1) sous-couche : couvre le cuir chevelu jusqu'à la ligne des cheveux
  const pos: number[] = [], col: number[] = [], idx: number[] = [];
  const tn = 16, pn = 56; const dark = base.clone().multiplyScalar(0.5);
  for (let i = 0; i <= tn; i++) for (let j = 0; j <= pn; j++) {
    const ph = -Math.PI + (2 * Math.PI * j) / pn; const maxT = hairline(ph);
    const th = (i / tn) * maxT; const p = pointAt(dirOf(th, ph), 0.0025 + 0.003 * Math.sin((th / maxT) * Math.PI * 0.5));
    pos.push(p.x, p.y, p.z); col.push(dark.r, dark.g, dark.b);
  }
  for (let i = 0; i < tn; i++) for (let j = 0; j < pn; j++) { const a0 = i * (pn + 1) + j, b0 = a0 + 1, c0 = a0 + pn + 1, d0 = c0 + 1; idx.push(a0, c0, b0, b0, c0, d0); }
  const under = new THREE.BufferGeometry(); under.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); under.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); under.setIndex(idx); under.computeVertexNormals(); reg(under);
  const underMesh = new THREE.Mesh(under, hairM); underMesh.castShadow = true; group.add(underMesh);
  // 2) mèches : on avance sur la surface du crâne en suivant un champ de direction (en arrière, puis vers le bas pour les cheveux longs)
  const strands = style === "short" ? 900 : 1200;
  const len = style === "short" ? 0.055 : style === "long" ? 0.2 : 0.13;
  const steps = 7;
  const sp: number[] = [], sc: number[] = [], si: number[] = [];
  const flow = (u: THREE.Vector3, t: number) => {
    const side = u.x;
    if (style === "short") return new THREE.Vector3(side * 0.7, 0.1, -0.2 + (u.z > 0.3 ? 0.9 : 0));          // plus court, légèrement ébouriffé vers l'avant et les côtés
    if (style === "long") return new THREE.Vector3(side * 0.8, -0.35 - 0.9 * Math.max(0, -u.z + t * 0.2), -1);   // coiffé en arrière, retombe sur la nuque
    return new THREE.Vector3(side * 0.55, -0.12 - 0.5 * Math.max(0, -u.z), -1);                                    // coiffé vers l'arrière, légèrement dégagé sur les côtés
  };
  for (let s = 0; s < strands; s++) {
    const ph0 = -Math.PI + rand() * 2 * Math.PI; const th0 = Math.sqrt(rand()) * hairline(ph0) * 0.99;
    let u = dirOf(th0, ph0);
    const pts: THREE.Vector3[] = [];
    const lift0 = 0.004 + rand() * 0.004;
    for (let k = 0; k <= steps; k++) {
      const tt = k / steps;
      const volume = style === "back" ? 0.016 * Math.max(0, u.z + 0.15) * (1 - tt) * Math.min(1, u.y * 1.6 + 0.4) : 0.004;
      pts.push(pointAt(u, lift0 + 0.008 * Math.sin(tt * Math.PI) * Math.max(0, u.y) + volume));
      const f = flow(u, tt); const tan = f.clone().sub(u.clone().multiplyScalar(f.dot(u))); if (tan.lengthSq() < 1e-6) break; tan.normalize();
      const r = radius(Math.acos(THREE.MathUtils.clamp(u.y, -1, 1)), Math.atan2(u.x, u.z));
      u = u.clone().addScaledVector(tan, (len / steps) / r * (0.75 + rand() * 0.5)).normalize();
    }
    const shade = 0.62 + rand() * 0.38, c = base.clone().multiplyScalar(shade);
    const w0 = 0.0062 + rand() * 0.004; const b0 = sp.length / 3;
    for (let k = 0; k < pts.length; k++) {
      const pk = pts[k], nk = pts[Math.min(pts.length - 1, k + 1)], pk0 = pts[Math.max(0, k - 1)];
      const tan = nk.clone().sub(pk0); if (tan.lengthSq() < 1e-10) tan.set(0, 0, -1); tan.normalize();
      const nrm = pk.clone().sub(center).normalize();
      const wd = tan.clone().cross(nrm).normalize().multiplyScalar(w0 * (1 - 0.85 * (k / (pts.length - 1))));
      const a1 = pk.clone().add(wd), a2 = pk.clone().sub(wd);
      sp.push(a1.x, a1.y, a1.z, a2.x, a2.y, a2.z); const cc = c.clone().multiplyScalar(0.9 + 0.2 * (k / pts.length)); sc.push(cc.r, cc.g, cc.b, cc.r, cc.g, cc.b);
      if (k > 0) { const i0 = b0 + (k - 1) * 2, i1 = b0 + k * 2; si.push(i0, i0 + 1, i1, i1, i0 + 1, i1 + 1); }
    }
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3)); sg.setAttribute("color", new THREE.Float32BufferAttribute(sc, 3)); sg.setIndex(si); sg.computeVertexNormals(); reg(sg);
  const sm = new THREE.Mesh(sg, hairM); sm.castShadow = true; group.add(sm);
  void RoundedBoxGeometry;
}

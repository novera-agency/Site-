import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { type Avatar, SKINS, EYES, HAIR_COLORS, SUITS, SHIRTS, TIES, GLASSES, WATCHES } from "@/engine/avatar";

/**
 * Modèle 3D de l'avatar : un homme en costume parfaitement ajusté, entièrement construit par code
 * (aucun fichier externe). Unités : mètres, regarde vers +z, pieds à y = 0.
 */
export interface AvatarRig {
  root: THREE.Group;
  head: THREE.Group;
  /** Fait avancer l'animation : `walk` entre 0 (à l'arrêt) et 1 (marche) */
  update(dt: number, walk: number): void;
  dispose(): void;
}

const mat = (color: string | number, rough = 0.8, metal = 0, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
/** Monture rectangulaire évidée (le verre reste transparent) */
function rectFrame(w: number, h: number, t: number, r: number) {
  const rr = (p: THREE.Path, x: number, y: number, ww: number, hh: number, k: number) => { p.moveTo(x + k, y); p.lineTo(x + ww - k, y); p.quadraticCurveTo(x + ww, y, x + ww, y + k); p.lineTo(x + ww, y + hh - k); p.quadraticCurveTo(x + ww, y + hh, x + ww - k, y + hh); p.lineTo(x + k, y + hh); p.quadraticCurveTo(x, y + hh, x, y + hh - k); p.lineTo(x, y + k); p.quadraticCurveTo(x, y, x + k, y); };
  const s = new THREE.Shape(); rr(s, -w / 2, -h / 2, w, h, r);
  const hole = new THREE.Path(); rr(hole, -w / 2 + t, -h / 2 + t, w - 2 * t, h - 2 * t, r * 0.6); s.holes.push(hole);
  return new THREE.ExtrudeGeometry(s, { depth: 0.004, bevelEnabled: false });
}
const lighten = (hex: string, k: number) => `#${new THREE.Color(hex).lerp(new THREE.Color("#ffffff"), k).getHexString()}`;
const mix = (a: string, b: string, k: number) => `#${new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString()}`;

export function buildAvatar(a: Avatar): AvatarRig {
  const root = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [], mats: THREE.Material[] = [];
  const g = <T extends THREE.BufferGeometry>(x: T) => { geos.push(x); return x; };
  const m = <T extends THREE.Material>(x: T) => { mats.push(x); return x; };
  const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, material); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o; };

  const k = 0.96 + 0.035 * a.height;                       // grandeur
  const w = [0.92, 1, 1.13][a.build];                   // carrure
  const skinHex = SKINS[a.skin].color!;
  const suitHex = SUITS[a.suit].color!;
  const shirtHex = SHIRTS[a.shirt].color!;
  let hairHex = HAIR_COLORS[a.hairColor].color!;
  if (a.age === 2 && a.hairColor < 5) hairHex = mix(hairHex, "#9a9a9c", 0.3);
  const skin = m(mat(skinHex, 0.62, 0, { roughness: 0.6 }));
  const suit = m(mat(suitHex, 0.82, 0));
  const suitDark = m(mat(mix(suitHex, "#000000", 0.25), 0.85, 0));
  const lapel = m(mat(mix(suitHex, "#ffffff", 0.07), 0.55, 0.05));
  const shirt = m(mat(shirtHex, 0.7, 0));
  const hairM = m(mat(hairHex, 0.45, 0.05));
  const shoe = m(mat("#0b0b0d", 0.22, 0.2));
  const gold = m(mat("#e0b84a", 0.25, 0.9));

  const body = new THREE.Group(); root.add(body); body.scale.setScalar(k);

  /* ───── jambes ───── */
  const legs: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(sx * 0.098 * w, 0.93, 0); body.add(leg); legs.push(leg);
    add(leg, g(new THREE.CylinderGeometry(0.092 * w, 0.066 * w, 0.84, 18)), suitDark, 0, -0.45, 0);
    add(leg, g(new RoundedBoxGeometry(0.105, 0.07, 0.27, 3, 0.03)), shoe, 0, -0.9, 0.05);
    add(leg, g(new THREE.CylinderGeometry(0.073 * w, 0.073 * w, 0.02, 16)), shoe, 0, -0.87, 0);
  }

  /* ───── torse : veste ajustée (taille cintrée, épaules marquées) ───── */
  const torso = new THREE.Group(); torso.position.y = 0.93; body.add(torso);
  // profil (rayon, hauteur) : bas de veste, taille cintrée, poitrine, épaules, col
  const prof: [number, number][] = [[0.17, -0.2], [0.178, -0.1], [0.162, 0.1], [0.152, 0.24], [0.172, 0.4], [0.188, 0.52], [0.178, 0.58], [0.1, 0.62], [0.06, 0.63]];
  const jacketGeo = g(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 40));
  const jx = 1.3 * w, jz = 0.8;                         // section elliptique : large, peu profonde
  jacketGeo.scale(jx, 1, jz); jacketGeo.computeVertexNormals();
  add(torso, jacketGeo, suit, 0, 0, 0);
  const zAt = (y: number) => { let r = prof[0][0]; for (let i = 0; i < prof.length - 1; i++) { const [r0, y0] = prof[i], [r1, y1] = prof[i + 1]; if (y >= y0 && y <= y1) { r = r0 + ((r1 - r0) * (y - y0)) / (y1 - y0); break; } } return r * jz; };
  // épaules arrondies
  for (const sx of [-1, 1]) add(torso, g(new THREE.SphereGeometry(0.058 * w + 0.012, 18, 14)), suit, sx * 0.236 * w, 0.545, 0);
  // chemise en V + col
  const chest = new THREE.Group(); chest.position.set(0, 0, zAt(0.3) + 0.004 - 0.3 * Math.sin(0.1)); chest.rotation.x = 0.1; torso.add(chest);
  const vShape = new THREE.Shape(); vShape.moveTo(-0.068, 0.52); vShape.lineTo(0.068, 0.52); vShape.lineTo(0.0, 0.07); vShape.closePath();
  const vMesh = new THREE.Mesh(g(new THREE.ShapeGeometry(vShape)), shirt); vMesh.position.set(0, 0.02, 0.002); chest.add(vMesh);
  // revers : de part et d'autre de l'ouverture en V de la chemise
  for (const sx of [-1, 1]) {
    const s = new THREE.Shape(); s.moveTo(sx * 0.07, 0.52); s.lineTo(sx * 0.125, 0.5); s.lineTo(sx * 0.1, 0.34); s.lineTo(sx * 0.02, 0.1); s.lineTo(0, 0.12); s.closePath();
    const lp = new THREE.Mesh(g(new THREE.ShapeGeometry(s)), lapel); lp.position.set(0, 0.02, 0.006); chest.add(lp);
  }
  // boutons
  for (const y of [0.06, -0.06]) add(chest, g(new THREE.SphereGeometry(0.012, 10, 8)), m(mat(mix(suitHex, "#000", 0.4), 0.3, 0.2)), 0.0, y + 0.0, 0.012);
  // cravate / nœud papillon
  if (a.tie > 0) {
    const tieM = m(mat(TIES[a.tie].color!, 0.4, 0.1));
    if (a.tie === 6) {
      for (const sx of [-1, 1]) { const b = add(chest, g(new THREE.ConeGeometry(0.035, 0.07, 3)), tieM, sx * 0.04, 0.5, 0.014); b.rotation.z = sx * Math.PI / 2; }
      add(chest, g(new THREE.SphereGeometry(0.016, 10, 8)), tieM, 0, 0.5, 0.016);
    } else {
      add(chest, g(new THREE.BoxGeometry(0.034, 0.3, 0.008)), tieM, 0, 0.3, 0.012);
      const tip = new THREE.Shape(); tip.moveTo(-0.022, 0); tip.lineTo(0.022, 0); tip.lineTo(0, -0.04); tip.closePath();
      const tm = new THREE.Mesh(g(new THREE.ShapeGeometry(tip)), tieM); tm.position.set(0, 0.15, 0.0125); chest.add(tm);
      add(chest, g(new RoundedBoxGeometry(0.052, 0.045, 0.02, 2, 0.008)), tieM, 0, 0.47, 0.014);
    }
  }
  // pochette
  if (a.pocket) { const p = add(chest, g(new THREE.BoxGeometry(0.05, 0.028, 0.012)), m(mat("#f6f3ec", 0.7)), -0.12 * w, 0.27, 0.01); p.rotation.z = 0.15; }

  /* ───── cou, tête ───── */
  const neck = add(torso, g(new THREE.CylinderGeometry(0.05, 0.057, 0.12, 16)), skin, 0, 0.63, 0);
  neck.castShadow = false;
  add(torso, g(new THREE.TorusGeometry(0.058, 0.012, 8, 20)), shirt, 0, 0.585, 0).rotation.x = Math.PI / 2;

  const head = new THREE.Group(); head.position.set(0, 0.79, 0.004); head.scale.setScalar(1.06); torso.add(head);
  const fx = [0.93, 1.0, 0.88][a.face], fy = [1.12, 1.04, 1.26][a.face], fz = [1.0, 0.98, 0.94][a.face];
  const skull = add(head, g(new THREE.SphereGeometry(0.105, 32, 24)), skin); skull.scale.set(fx, fy, fz);
  if (a.face === 1) { const jaw = add(head, g(new RoundedBoxGeometry(0.15, 0.085, 0.15, 3, 0.035)), skin, 0, -0.07, 0.015); jaw.castShadow = false; }
  if (a.face === 2) { const chin = add(head, g(new THREE.SphereGeometry(0.05, 16, 12)), skin, 0, -0.1, 0.035); chin.scale.set(0.85, 0.9, 0.85); }
  for (const sx of [-1, 1]) { const ear = add(head, g(new THREE.SphereGeometry(0.026, 12, 10)), skin, sx * 0.105 * fx, -0.005, -0.005); ear.scale.set(0.45, 1, 0.8); }
  // nez
  const nz = [{ s: [0.017, 0.032, 0.026], y: -0.02 }, { s: [0.013, 0.03, 0.02], y: -0.022 }, { s: [0.02, 0.036, 0.034], y: -0.02 }][a.nose];
  const nose = add(head, g(new THREE.SphereGeometry(1, 12, 10)), skin, 0, nz.y, 0.098 * fz); nose.scale.set(nz.s[0], nz.s[1], nz.s[2]);
  // yeux, sourcils, bouche
  const iris = m(mat(EYES[a.eyes].color!, 0.3)), white = m(mat("#f4f4f2", 0.35)), dark = m(mat("#0a0a0a", 0.3));
  for (const sx of [-1, 1]) {
    const ex = sx * 0.037 * fx, ey = 0.022, ez = 0.088 * fz;
    const eye = add(head, g(new THREE.SphereGeometry(0.0125, 12, 10)), white, ex, ey, ez); eye.scale.set(1.15, 0.8, 0.6); eye.castShadow = false;
    const ir = add(head, g(new THREE.SphereGeometry(0.0072, 12, 10)), iris, ex, ey, ez + 0.0045); ir.castShadow = false;
    add(head, g(new THREE.SphereGeometry(0.0035, 8, 6)), dark, ex, ey, ez + 0.0085).castShadow = false;
    const th = [0.0045, 0.0075, 0.011][a.brows];
    const brow = add(head, g(new THREE.BoxGeometry(0.034, th, 0.008)), hairM, sx * 0.039 * fx, 0.052, 0.088 * fz); brow.rotation.z = sx * -0.12; brow.castShadow = false;
  }
  const mouth = add(head, g(new THREE.BoxGeometry(0.042, 0.006, 0.008)), m(mat(mix(skinHex, "#7a2b2b", 0.45), 0.5)), 0, -0.058, 0.093 * fz); mouth.castShadow = false;
  if (a.age === 2) for (const sx of [-1, 1]) { const l = add(head, g(new THREE.BoxGeometry(0.004, 0.032, 0.004)), m(mat(mix(skinHex, "#000", 0.3), 0.9, 0, { transparent: true, opacity: 0.5 })), sx * 0.03, -0.035, 0.093 * fz); l.rotation.z = sx * 0.4; l.castShadow = false; }

  // cheveux : calotte jusqu'à la ligne du front + coque arrière qui descend sur la nuque
  const cap = (r: number, thetaLen: number, y = 0.003, z = -0.004) => { const s = add(head, g(new THREE.SphereGeometry(r, 32, 20, 0, Math.PI * 2, 0, thetaLen)), hairM, 0, y, z); s.scale.set(fx, fy, fz); return s; };
  const back = (r: number, th0: number, thLen: number, y = 0, z = -0.002) => { const s = add(head, g(new THREE.SphereGeometry(r, 28, 16, 2.47, Math.PI * 2 - 1.8, th0, thLen)), hairM, 0, y, z); s.scale.set(fx, fy, fz); return s; };
  switch (a.hair) {
    case 1: cap(0.111, 1.12); back(0.111, 1.1, 0.55); break;
    case 2: { cap(0.112, 1.14); back(0.112, 1.1, 0.55); const q = add(head, g(new RoundedBoxGeometry(0.1, 0.022, 0.09, 3, 0.01)), hairM, -0.03, 0.088 * fy, 0.03); q.rotation.z = 0.2; break; }
    case 3: { cap(0.115, 1.05, 0.006, -0.008); back(0.115, 1.0, 0.75); break; }
    case 4: { cap(0.112, 1.1); back(0.112, 1.1, 0.5); const q = add(head, g(new RoundedBoxGeometry(0.095, 0.04, 0.06, 3, 0.016)), hairM, 0, 0.09 * fy, 0.07); q.rotation.x = -0.4; break; }
    case 5: { cap(0.114, 1.18); back(0.114, 1.1, 0.95); for (const sx of [-1, 1]) add(head, g(new THREE.BoxGeometry(0.016, 0.08, 0.09)), hairM, sx * 0.104 * fx, 0.0, -0.015); break; }
    case 6: { const s = add(head, g(new THREE.SphereGeometry(0.109, 28, 14, 2.47, Math.PI * 2 - 1.8, 0.8, 0.8)), hairM, 0, 0.0, -0.002); s.scale.set(fx, fy, fz); break; }
    default: break; // rasé
  }
  // barbe
  if (a.beard > 0) {
    const bm = m(mat(hairHex, 0.55, 0, a.beard === 1 ? { transparent: true, opacity: 0.5 } : {}));
    const shell = (r: number, ph0: number, phLen: number, th0: number, thLen: number) => { const s = add(head, g(new THREE.SphereGeometry(r, 28, 16, ph0, phLen, th0, thLen)), bm, 0, 0, 0.002); s.scale.set(fx, fy, fz); s.castShadow = false; };
    if (a.beard === 1) shell(0.1065, 0.25, Math.PI - 0.5, 1.5, 0.95);
    else if (a.beard === 2) { add(head, g(new THREE.SphereGeometry(0.03, 14, 10)), bm, 0, -0.098, 0.062 * fz).scale.set(0.9, 1.1, 0.8); add(head, g(new RoundedBoxGeometry(0.055, 0.011, 0.012, 2, 0.004)), bm, 0, -0.045, 0.097 * fz); }
    else if (a.beard === 3) { shell(0.109, 0.05, Math.PI - 0.1, 1.45, 1.0); add(head, g(new RoundedBoxGeometry(0.06, 0.013, 0.014, 2, 0.005)), bm, 0, -0.045, 0.1 * fz); }
    else { shell(0.118, 0.0, Math.PI * 2, 1.3, 1.3); add(head, g(new RoundedBoxGeometry(0.07, 0.016, 0.02, 2, 0.006)), bm, 0, -0.043, 0.108 * fz); }
  }
  // lunettes
  if (a.glasses > 0) {
    const fm = m(mat(GLASSES[a.glasses].color!, 0.3, 0.6));
    for (const sx of [-1, 1]) {
      const ring = a.glasses === 2 ? add(head, g(rectFrame(0.056, 0.036, 0.0045, 0.008)), fm, sx * 0.037 * fx, 0.022, 0.1 * fz) : add(head, g(new THREE.TorusGeometry(0.026, 0.0035, 8, 24)), fm, sx * 0.037 * fx, 0.022, 0.1 * fz);
      ring.castShadow = false;
      const lens = add(head, g(a.glasses === 2 ? new THREE.PlaneGeometry(0.05, 0.032) : new THREE.CircleGeometry(0.0255, 20)), m(mat("#bfe3ff", 0.1, 0, { transparent: true, opacity: 0.1 })), sx * 0.037 * fx, 0.022, 0.1 * fz + 0.002); lens.castShadow = false;
      add(head, g(new THREE.BoxGeometry(0.003, 0.003, 0.1)), fm, sx * 0.094 * fx, 0.026, 0.05 * fz).castShadow = false;
    }
    add(head, g(new THREE.BoxGeometry(0.02, 0.004, 0.004)), fm, 0, 0.028, 0.102 * fz).castShadow = false;
  }

  /* ───── bras ───── */
  const arms: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(sx * 0.255 * w, 0.585, 0); torso.add(arm); arms.push(arm);
    add(arm, g(new THREE.CylinderGeometry(0.053, 0.044, 0.55, 16)), suit, 0, -0.29, 0.0);
    add(arm, g(new THREE.CylinderGeometry(0.0425, 0.0425, 0.03, 16)), shirt, 0, -0.575, 0);
    add(arm, g(new THREE.SphereGeometry(0.04, 14, 10)), skin, 0, -0.65, 0.005).scale.set(0.9, 1.2, 0.8);
    if (a.cufflinks) add(arm, g(new THREE.SphereGeometry(0.009, 8, 6)), gold, sx * 0.04, -0.56, 0.0);
    if (a.watch > 0 && sx === -1) {
      const wm = m(mat(WATCHES[a.watch].color!, 0.25, 0.9));
      add(arm, g(new THREE.TorusGeometry(0.044, 0.007, 8, 20)), wm, 0, -0.6, 0).rotation.x = Math.PI / 2;
      add(arm, g(new THREE.CylinderGeometry(0.02, 0.02, 0.01, 18)), m(mat("#10131c", 0.3, 0.3)), 0.0, -0.6, 0.046).rotation.x = Math.PI / 2;
    }
    arm.rotation.z = sx * 0.07;
  }
  // ceinture invisible sous la veste : léger rembourrage des hanches
  add(body, g(new RoundedBoxGeometry(0.31 * w, 0.16, 0.19, 3, 0.05)), suitDark, 0, 0.87, 0);

  root.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = o.castShadow !== false; o.receiveShadow = true; } });

  let ph = 0, breath = 0;
  return {
    root, head,
    update(dt, walk) {
      ph += dt * (4.2 + 3.2 * walk) * (walk > 0.05 ? 1 : 0);
      breath += dt;
      const sw = Math.sin(ph) * 0.62 * walk;
      legs[0].rotation.x = sw; legs[1].rotation.x = -sw;
      arms[0].rotation.x = -sw * 0.8; arms[1].rotation.x = sw * 0.8;
      body.position.y = Math.abs(Math.cos(ph)) * 0.022 * walk;
      torso.rotation.y = Math.sin(ph) * 0.05 * walk;
      torso.scale.y = 1 + Math.sin(breath * 1.6) * 0.004 * (1 - walk);
      head.rotation.y = Math.sin(breath * 0.5) * 0.12 * (1 - walk);
    },
    dispose() { geos.forEach((x) => x.dispose()); mats.forEach((x) => x.dispose()); },
  };
}

export { lighten };

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { type Avatar, SKINS, EYES, HAIR_COLORS, SUITS, SHIRTS, TIES, GLASSES, WATCHES } from "@/engine/avatar";

/**
 * Modèle 3D de l'avatar : un homme en costume parfaitement ajusté, entièrement construit par code
 * (aucun fichier externe) : tête sculptée, tissus et peau texturés, mains, chaussures vernies.
 * Unités : mètres, regarde vers +z, pieds à y = 0.
 */
export interface AvatarRig {
  root: THREE.Group;
  head: THREE.Group;
  /** Fait avancer l'animation : `walk` entre 0 (à l'arrêt) et 1 (marche) */
  update(dt: number, walk: number): void;
  dispose(): void;
}

/* ───────── textures procédurales (partagées, mises en cache) ───────── */
const texCache = new Map<string, THREE.CanvasTexture>();
function tex(key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void, repeat?: [number, number], srgb = true) {
  let t = texCache.get(key);
  if (!t) {
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h; draw(cv.getContext("2d")!);
    t = new THREE.CanvasTexture(cv); t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; if (repeat) t.repeat.set(repeat[0], repeat[1]);
    texCache.set(key, t);
  }
  return t;
}
const rnd = (() => { let s = 987654; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
/** Tissu : sergé fin + éventuelles rayures tennis */
const fabric = (hex: string, stripe: boolean) => tex(`fab${hex}${stripe}`, 256, 256, (c) => {
  c.fillStyle = hex; c.fillRect(0, 0, 256, 256);
  for (let i = -256; i < 512; i += 3) { c.strokeStyle = `rgba(255,255,255,${0.03 + rnd() * 0.04})`; c.lineWidth = 1; c.beginPath(); c.moveTo(i, 0); c.lineTo(i + 256, 256); c.stroke(); }
  for (let i = 0; i < 2500; i++) { c.fillStyle = `rgba(${rnd() < 0.5 ? "0,0,0" : "255,255,255"},${rnd() * 0.06})`; c.fillRect(rnd() * 256, rnd() * 256, 1.5, 1.5); }
  if (stripe) for (let x = 6; x < 256; x += 16) { c.fillStyle = "rgba(220,225,240,0.5)"; c.fillRect(x, 0, 1.4, 256); }
}, [10, 5]);
const fabricBump = tex("fabbump", 128, 128, (c) => { c.fillStyle = "#808080"; c.fillRect(0, 0, 128, 128); for (let i = -128; i < 256; i += 2) { c.strokeStyle = `rgba(${rnd() < 0.5 ? 40 : 220},${rnd() < 0.5 ? 40 : 220},200,0.35)`; c.beginPath(); c.moveTo(i, 0); c.lineTo(i + 128, 128); c.stroke(); } }, [12, 6], false);
const poreBump = tex("pore", 128, 128, (c) => { c.fillStyle = "#909090"; c.fillRect(0, 0, 128, 128); for (let i = 0; i < 1800; i++) { c.fillStyle = `rgba(${rnd() < 0.5 ? 60 : 200},${rnd() < 0.5 ? 60 : 200},${rnd() < 0.5 ? 60 : 200},0.4)`; c.fillRect(rnd() * 128, rnd() * 128, 1.2, 1.2); } }, [10, 10], false);
/** Mèches de cheveux : traits fins le long de la coiffure */
const hairTex = (hex: string) => tex(`hair${hex}`, 256, 256, (c) => {
  c.fillStyle = hex; c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 700; i++) { const x = rnd() * 256, l = rnd() > 0.5; c.strokeStyle = `rgba(${l ? "255,255,255" : "0,0,0"},${0.05 + rnd() * 0.16})`; c.lineWidth = 0.6 + rnd() * 1.6; c.beginPath(); c.moveTo(x, 0); c.bezierCurveTo(x + (rnd() - 0.5) * 10, 80, x + (rnd() - 0.5) * 12, 170, x + (rnd() - 0.5) * 8, 256); c.stroke(); }
}, [3, 1]);
const stubbleAlpha = tex("stubble", 256, 256, (c) => { c.fillStyle = "#000"; c.fillRect(0, 0, 256, 256); for (let i = 0; i < 9000; i++) { c.fillStyle = `rgba(255,255,255,${0.5 + rnd() * 0.5})`; c.fillRect(rnd() * 256, rnd() * 256, 1.3, 1.3); } }, [4, 2], false);
const irisTex = (hex: string) => tex(`iris${hex}`, 128, 128, (c) => {
  const g = c.createRadialGradient(64, 64, 4, 64, 64, 62); g.addColorStop(0, "#000"); g.addColorStop(0.2, "#050505"); g.addColorStop(0.24, hex); g.addColorStop(0.7, hex); g.addColorStop(0.92, "#14100c"); g.addColorStop(1, "rgba(20,16,12,0)");
  c.fillStyle = g; c.beginPath(); c.arc(64, 64, 62, 0, 7); c.fill();
  for (let i = 0; i < 60; i++) { const a = rnd() * 6.283; c.strokeStyle = `rgba(255,255,255,${rnd() * 0.18})`; c.beginPath(); c.moveTo(64 + Math.cos(a) * 16, 64 + Math.sin(a) * 16); c.lineTo(64 + Math.cos(a) * 52, 64 + Math.sin(a) * 52); c.stroke(); }
  c.fillStyle = "rgba(255,255,255,0.9)"; c.beginPath(); c.arc(86, 44, 6, 0, 7); c.fill();
});

const mix = (a: string, b: string, k: number) => `#${new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString()}`;
const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Tête sculptée : sphère unité déformée (mâchoire, pommettes, arcades) ; couleurs de sommets pour les joues, les orbites, les lèvres */
function shapeHead(g: THREE.SphereGeometry, a: Avatar, off = 0, withColor = false) {
  const pos = g.attributes.position as THREE.BufferAttribute;
  const skin = new THREE.Color(SKINS[a.skin].color);
  const blush = skin.clone().lerp(new THREE.Color("#c4584f"), 0.28), shade = skin.clone().multiplyScalar(0.8), lip = skin.clone().lerp(new THREE.Color("#8c3a3a"), 0.5);
  const col = withColor ? new Float32Array(pos.count * 3) : null;
  const rx = 0.087 * [0.96, 1.05, 0.9][a.face], ry = 0.113 * [1, 0.97, 1.13][a.face], rz = 0.098;
  const sq = a.face === 1 ? 0.55 : 1;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const low = Math.max(0, -y);
    const sx = 1 - 0.3 * sq * low * low, sz = 1 - 0.14 * low * low;
    let px = x * rx * sx, py = y * ry, pz = z * rz * sz;
    if (z > 0.2) {
      pz += 0.006 * Math.exp(-(((y - 0.24) / 0.13) ** 2)) * smooth(0.2, 0.7, z);                         // arcades
      pz -= 0.004 * Math.exp(-(((y - 0.1) / 0.1) ** 2) - ((Math.abs(x) - 0.4) / 0.16) ** 2);              // orbites
      pz += 0.004 * Math.exp(-(((y + 0.22) / 0.14) ** 2) - ((Math.abs(x) - 0.55) / 0.2) ** 2);            // pommettes
      pz += 0.007 * Math.exp(-(((y + 0.78) / 0.13) ** 2) - (x / 0.28) ** 2);                              // menton
    }
    if (y > 0.35) px *= 1 - 0.04 * smooth(0.35, 1, y);
    pos.setXYZ(i, px, py, pz);
    if (col) {
      const c = skin.clone();
      c.lerp(blush, Math.exp(-(((y + 0.2) / 0.2) ** 2) - ((Math.abs(x) - 0.55) / 0.2) ** 2) * smooth(0.1, 0.5, z));
      c.lerp(shade, 0.55 * Math.exp(-(((y - 0.1) / 0.1) ** 2) - ((Math.abs(x) - 0.4) / 0.16) ** 2) * smooth(0.1, 0.6, z));
      c.lerp(shade, 0.3 * smooth(-0.3, -1, y) * (1 - smooth(0, 0.4, z)));
      c.lerp(lip, 0.8 * Math.exp(-(((y + 0.52) / 0.045) ** 2) - (x / 0.2) ** 2) * smooth(0.3, 0.8, z));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
  }
  g.computeVertexNormals();
  if (off) { const n = g.attributes.normal as THREE.BufferAttribute; for (let i = 0; i < pos.count; i++) pos.setXYZ(i, pos.getX(i) + n.getX(i) * off, pos.getY(i) + n.getY(i) * off, pos.getZ(i) + n.getZ(i) * off); }
  if (col) g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

/** Monture rectangulaire évidée (le verre reste transparent) */
function rectFrame(w: number, h: number, t: number, r: number) {
  const rr = (p: THREE.Path, x: number, y: number, ww: number, hh: number, k: number) => { p.moveTo(x + k, y); p.lineTo(x + ww - k, y); p.quadraticCurveTo(x + ww, y, x + ww, y + k); p.lineTo(x + ww, y + hh - k); p.quadraticCurveTo(x + ww, y + hh, x + ww - k, y + hh); p.lineTo(x + k, y + hh); p.quadraticCurveTo(x, y + hh, x, y + hh - k); p.lineTo(x, y + k); p.quadraticCurveTo(x, y, x + k, y); };
  const s = new THREE.Shape(); rr(s, -w / 2, -h / 2, w, h, r);
  const hole = new THREE.Path(); rr(hole, -w / 2 + t, -h / 2 + t, w - 2 * t, h - 2 * t, r * 0.6); s.holes.push(hole);
  return new THREE.ExtrudeGeometry(s, { depth: 0.004, bevelEnabled: false });
}

export function buildAvatar(a: Avatar): AvatarRig {
  const root = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [], mats: THREE.Material[] = [];
  const g = <T extends THREE.BufferGeometry>(x: T) => { geos.push(x); return x; };
  const m = <T extends THREE.Material>(x: T) => { mats.push(x); return x; };
  const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, material); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o; };

  const k = 0.96 + 0.035 * a.height;                       // grandeur
  const w = [0.93, 1, 1.12][a.build];                      // carrure
  const fw = [0.96, 1.05, 0.9][a.face];
  const skinHex = SKINS[a.skin].color!, suitHex = SUITS[a.suit].color!, shirtHex = SHIRTS[a.shirt].color!;
  let hairHex = HAIR_COLORS[a.hairColor].color!;
  if (a.age === 2 && a.hairColor < 5) hairHex = mix(hairHex, "#9a9a9c", 0.3);
  const stripe = SUITS[a.suit].label.includes("rayé");
  const sheenSkin = new THREE.Color(skinHex).lerp(new THREE.Color("#ff9a8a"), 0.4);

  const skin = m(new THREE.MeshPhysicalMaterial({ color: skinHex, roughness: 0.55, bumpMap: poreBump, bumpScale: 0.4, sheen: 0.12, sheenColor: sheenSkin, sheenRoughness: 0.6 }));
  const headMat = m(new THREE.MeshPhysicalMaterial({ color: "#ffffff", vertexColors: true, roughness: 0.52, bumpMap: poreBump, bumpScale: 0.35, sheen: 0.12, sheenColor: sheenSkin, sheenRoughness: 0.55 }));
  const cloth = (hex: string, strip = false) => m(new THREE.MeshPhysicalMaterial({ color: "#ffffff", map: fabric(hex, strip), bumpMap: fabricBump, bumpScale: 0.6, roughness: 0.85, sheen: 0.25, sheenRoughness: 0.6, sheenColor: new THREE.Color(hex).lerp(new THREE.Color("#ffffff"), 0.15) }));
  const suit = cloth(suitHex, stripe), suitDark = cloth(mix(suitHex, "#000000", 0.18), stripe);
  const lapel = m(new THREE.MeshPhysicalMaterial({ color: mix(suitHex, "#ffffff", 0.05), roughness: 0.45, sheen: 0.3, sheenRoughness: 0.4, sheenColor: new THREE.Color("#ffffff") }));
  const shirt = m(new THREE.MeshPhysicalMaterial({ color: shirtHex, roughness: 0.7, sheen: 0.5, bumpMap: fabricBump, bumpScale: 0.25, side: THREE.DoubleSide }));
  const hairM = m(new THREE.MeshStandardMaterial({ color: "#ffffff", map: hairTex(hairHex), bumpMap: hairTex(hairHex), bumpScale: 0.5, roughness: 0.42, metalness: 0.08 }));
  const shoe = m(new THREE.MeshPhysicalMaterial({ color: "#0b0a0c", roughness: 0.18, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.08 }));
  const gold = m(new THREE.MeshStandardMaterial({ color: "#e0b84a", roughness: 0.22, metalness: 1 }));
  const dark = m(new THREE.MeshStandardMaterial({ color: "#0a0a0a", roughness: 0.4 }));

  const body = new THREE.Group(); root.add(body); body.scale.setScalar(k);

  /* ───── jambes (cuisse + tibia, pli du pantalon, chaussures vernies) ───── */
  const legs: { hip: THREE.Group; knee: THREE.Group }[] = [];
  for (const sx of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(sx * 0.095 * w, 0.93, 0); body.add(hip);
    add(hip, g(new THREE.CylinderGeometry(0.1 * w, 0.078 * w, 0.47, 28)), suitDark, 0, -0.235, 0);
    const knee = new THREE.Group(); knee.position.set(0, -0.47, 0); hip.add(knee);
    add(knee, g(new THREE.CylinderGeometry(0.078 * w, 0.064 * w, 0.4, 28)), suitDark, 0, -0.2, 0);
    add(knee, g(new THREE.BoxGeometry(0.006, 0.4, 0.008)), suitDark, 0, -0.2, 0.07 * w);   // pli du pantalon
    add(knee, g(new THREE.CylinderGeometry(0.067 * w, 0.069 * w, 0.025, 24)), suitDark, 0, -0.39, 0.002).castShadow = false;
    // chaussure Oxford vernie
    const up = add(knee, g(new THREE.SphereGeometry(1, 24, 16)), shoe, 0, -0.43, 0.05); up.scale.set(0.05, 0.04, 0.135);
    add(knee, g(new RoundedBoxGeometry(0.1, 0.015, 0.27, 2, 0.006)), dark, 0, -0.465, 0.05);
    add(knee, g(new RoundedBoxGeometry(0.07, 0.03, 0.06, 2, 0.01)), dark, 0, -0.45, -0.045);
    legs.push({ hip, knee });
  }

  /* ───── torse : veste cintrée (profil de révolution), chemise, revers, cravate ───── */
  const torso = new THREE.Group(); torso.position.y = 0.93; body.add(torso);
  const prof: [number, number][] = [[0.172, -0.22], [0.18, -0.12], [0.168, 0.02], [0.155, 0.16], [0.152, 0.26], [0.168, 0.38], [0.186, 0.5], [0.184, 0.55], [0.15, 0.6], [0.095, 0.625], [0.058, 0.635]];
  const jacketGeo = g(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 56));
  const jz = 0.78;                                        // section elliptique : large et peu profonde
  jacketGeo.scale(1.34 * w, 1, jz); jacketGeo.computeVertexNormals();
  add(torso, jacketGeo, suit, 0, 0, 0);
  const zAt = (y: number) => { let r = prof[0][0]; for (let i = 0; i < prof.length - 1; i++) { const [r0, y0] = prof[i], [r1, y1] = prof[i + 1]; if (y >= y0 && y <= y1) { r = r0 + ((r1 - r0) * (y - y0)) / (y1 - y0); break; } } return r * jz; };
  add(body, g(new RoundedBoxGeometry(0.32 * w, 0.16, 0.2, 4, 0.06)), suitDark, 0, 0.88, 0);   // hanches
  // plan de la poitrine (suit la courbure de la veste)
  const chest = new THREE.Group(); chest.position.set(0, 0, zAt(0.3) + 0.004 - 0.3 * Math.sin(0.1)); chest.rotation.x = 0.1; torso.add(chest);
  const vShape = new THREE.Shape(); vShape.moveTo(-0.07, 0.53); vShape.lineTo(0.07, 0.53); vShape.lineTo(0, 0.08); vShape.closePath();
  const vMesh = new THREE.Mesh(g(new THREE.ShapeGeometry(vShape)), shirt); vMesh.position.set(0, 0.02, 0.002); chest.add(vMesh);
  // revers volumineux (extrusion biseautée) de part et d'autre de l'ouverture
  for (const sx of [-1, 1]) {
    const s = new THREE.Shape(); s.moveTo(sx * 0.07, 0.53); s.lineTo(sx * 0.13, 0.5); s.lineTo(sx * 0.098, 0.46); s.lineTo(sx * 0.108, 0.38); s.lineTo(sx * 0.02, 0.1); s.lineTo(0, 0.12); s.closePath();
    const lp = new THREE.Mesh(g(new THREE.ExtrudeGeometry(s, { depth: 0.006, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 3 })), lapel);
    lp.position.set(0, 0.02, 0.003); lp.castShadow = true; chest.add(lp);
  }
  // boutons nacrés, poche de poitrine, poches à rabat
  const button = m(new THREE.MeshStandardMaterial({ color: mix(suitHex, "#000", 0.5), roughness: 0.25, metalness: 0.3 }));
  for (const y of [0.07, -0.07]) add(chest, g(new THREE.CylinderGeometry(0.0125, 0.0125, 0.006, 16)), button, 0, y, 0.012).rotation.x = Math.PI / 2;
  add(chest, g(new THREE.BoxGeometry(0.075, 0.008, 0.006)), suitDark, -0.115 * w, 0.28, 0.006);
  for (const sx of [-1, 1]) { const f = add(chest, g(new RoundedBoxGeometry(0.11, 0.035, 0.01, 2, 0.004)), suitDark, sx * 0.105 * w, -0.1, 0.004); f.rotation.z = sx * 0.04; }
  // chemise : col empesé et pointes
  add(torso, g(new THREE.CylinderGeometry(0.056, 0.06, 0.035, 28, 1, true)), shirt, 0, 0.605, 0);
  for (const sx of [-1, 1]) {
    const cs = new THREE.Shape(); cs.moveTo(0, 0); cs.lineTo(sx * 0.07, 0.01); cs.lineTo(sx * 0.03, -0.075); cs.closePath();
    const wing = new THREE.Mesh(g(new THREE.ExtrudeGeometry(cs, { depth: 0.004, bevelEnabled: false })), shirt); wing.position.set(sx * 0.012, 0.62, zAt(0.6) + 0.0); wing.rotation.set(0.35, sx * -0.25, sx * 0.05); wing.castShadow = true; torso.add(wing);
  }
  // cravate : nœud en forme et lame texturée
  if (a.tie > 0) {
    const tc = TIES[a.tie].color!;
    const tieM = m(new THREE.MeshPhysicalMaterial({ color: tc, roughness: 0.35, sheen: 1, sheenRoughness: 0.25, sheenColor: new THREE.Color(tc).lerp(new THREE.Color("#fff"), 0.4), bumpMap: fabricBump, bumpScale: 0.3 }));
    if (a.tie === 6) {
      for (const sx of [-1, 1]) { const b = add(chest, g(new THREE.ConeGeometry(0.038, 0.075, 4)), tieM, sx * 0.045, 0.5, 0.016); b.rotation.z = sx * Math.PI / 2; b.scale.z = 0.5; }
      add(chest, g(new THREE.SphereGeometry(0.017, 14, 10)), tieM, 0, 0.5, 0.018);
    } else {
      const blade = new THREE.Shape(); blade.moveTo(-0.017, 0.46); blade.lineTo(0.017, 0.46); blade.lineTo(0.03, 0.14); blade.lineTo(0, 0.095); blade.lineTo(-0.03, 0.14); blade.closePath();
      const bm = new THREE.Mesh(g(new THREE.ExtrudeGeometry(blade, { depth: 0.004, bevelEnabled: true, bevelSize: 0.002, bevelThickness: 0.002, bevelSegments: 2 })), tieM); bm.position.set(0, 0, 0.011); bm.castShadow = true; chest.add(bm);
      const knot = add(chest, g(new THREE.SphereGeometry(1, 20, 14)), tieM, 0, 0.485, 0.017); knot.scale.set(0.026, 0.024, 0.017);
      add(chest, g(new THREE.CylinderGeometry(0.0075, 0.0075, 0.06, 12)), gold, 0, 0.3, 0.019).rotation.z = Math.PI / 2; // pince à cravate
    }
  }
  if (a.pocket) { const p = add(chest, g(new THREE.BoxGeometry(0.052, 0.03, 0.012)), m(new THREE.MeshStandardMaterial({ color: "#f6f3ec", roughness: 0.6 })), -0.115 * w, 0.3, 0.012); p.rotation.z = 0.15; }

  /* ───── cou et tête ───── */
  const neck = add(torso, g(new THREE.CylinderGeometry(0.048, 0.058, 0.13, 24)), skin, 0, 0.64, -0.004); neck.castShadow = false;
  const head = new THREE.Group(); head.position.set(0, 0.775, 0.005); head.scale.setScalar(1.04); torso.add(head);
  const skull = new THREE.Mesh(g(shapeHead(new THREE.SphereGeometry(1, 72, 56), a, 0, true)), headMat); skull.castShadow = true; skull.receiveShadow = true; head.add(skull);
  // oreilles
  for (const sx of [-1, 1]) {
    const ear = add(head, g(new THREE.SphereGeometry(0.026, 18, 14)), skin, sx * 0.086 * fw, -0.006, -0.004); ear.scale.set(0.35, 1, 0.75);
    const helix = add(head, g(new THREE.TorusGeometry(0.019, 0.0035, 8, 18, Math.PI * 1.4)), skin, sx * 0.089 * fw, 0.001, -0.004); helix.rotation.y = Math.PI / 2; helix.rotation.z = sx * 0.4;
  }
  // nez : arête, pointe, ailes, narines
  const nz = [{ b: 1, t: 1, w: 1 }, { b: 0.85, t: 0.85, w: 0.85 }, { b: 1.15, t: 1.2, w: 1.2 }][a.nose];
  const nose = new THREE.Group(); nose.position.set(0, -0.012, 0.09); head.add(nose);
  const bridge = add(nose, g(new THREE.SphereGeometry(1, 16, 12)), skin, 0, 0.02, 0.0); bridge.scale.set(0.008 * nz.w, 0.027, 0.011 * nz.b);
  add(nose, g(new THREE.SphereGeometry(0.0105 * nz.t, 18, 14)), skin, 0, -0.012, 0.012 * nz.t);
  const nostril = m(new THREE.MeshStandardMaterial({ color: mix(skinHex, "#000", 0.65), roughness: 0.9 }));
  for (const sx of [-1, 1]) { add(nose, g(new THREE.SphereGeometry(0.0068 * nz.w, 14, 10)), skin, sx * 0.0088 * nz.w, -0.014, 0.005); add(nose, g(new THREE.SphereGeometry(0.0028, 8, 6)), nostril, sx * 0.005, -0.021, 0.014).scale.set(1, 0.6, 1); }
  // yeux : globe, iris texturé, cornée brillante, paupières, cils
  const white = m(new THREE.MeshStandardMaterial({ color: "#f3f1ee", roughness: 0.25 }));
  const irisM = m(new THREE.MeshStandardMaterial({ map: irisTex(EYES[a.eyes].color!), roughness: 0.3, transparent: true }));
  const cornea = m(new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.02, transparent: true, opacity: 0.12, clearcoat: 1, clearcoatRoughness: 0.02 }));
  const eyeR = 0.0115, ex = 0.034 * fw, ey = 0.02, ez = 0.0865;
  for (const sx of [-1, 1]) {
    const eye = new THREE.Group(); eye.position.set(sx * ex, ey, ez); head.add(eye);
    add(eye, g(new THREE.SphereGeometry(eyeR, 24, 18)), white).castShadow = false;
    const ir = new THREE.Mesh(g(new THREE.CircleGeometry(0.0058, 28)), irisM); ir.position.z = eyeR * 0.985; eye.add(ir);
    add(eye, g(new THREE.SphereGeometry(eyeR * 1.02, 20, 14)), cornea).castShadow = false;
    // paupières : calottes de peau autour du globe
    add(eye, g(new THREE.SphereGeometry(eyeR * 1.1, 20, 12, Math.PI * 0.1, Math.PI * 0.8, 0.28, 0.85)), skin).castShadow = false;
    add(eye, g(new THREE.SphereGeometry(eyeR * 1.09, 20, 12, Math.PI * 0.1, Math.PI * 0.8, 2.25, 0.55)), skin).castShadow = false;
    // sourcils : arc effilé
    const bw = [0.0022, 0.0034, 0.0052][a.brows];
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.019, -0.002, 0), new THREE.Vector3(-0.008, 0.004, 0.003), new THREE.Vector3(0.007, 0.0055, 0.003), new THREE.Vector3(0.019, 0.0015, 0)]);
    const brow = add(head, g(new THREE.TubeGeometry(curve, 14, bw, 6, false)), hairM, sx * ex * 1.08, ey + 0.026, 0.0875); brow.rotation.y = sx * -0.12; brow.scale.z = 0.7; brow.castShadow = false;
  }
  // bouche : lèvres charnues
  const lipM = m(new THREE.MeshStandardMaterial({ color: mix(skinHex, "#7a3030", 0.45), roughness: 0.4 }));
  const up = add(head, g(new THREE.CapsuleGeometry(0.0042, 0.03, 6, 12)), lipM, 0, -0.057, 0.0915); up.rotation.z = Math.PI / 2; up.scale.set(1, 1, 0.9);
  const lo = add(head, g(new THREE.CapsuleGeometry(0.0052, 0.027, 6, 12)), lipM, 0, -0.0665, 0.09); lo.rotation.z = Math.PI / 2;
  add(head, g(new THREE.BoxGeometry(0.036, 0.0013, 0.004)), m(new THREE.MeshStandardMaterial({ color: mix(skinHex, "#3a1414", 0.7), roughness: 0.6 })), 0, -0.0615, 0.0925);
  if (a.age === 2) for (const sx of [-1, 1]) { const l = add(head, g(new THREE.BoxGeometry(0.003, 0.034, 0.003)), m(new THREE.MeshStandardMaterial({ color: mix(skinHex, "#000", 0.35), transparent: true, opacity: 0.35, roughness: 1 })), sx * 0.029, -0.034, 0.088); l.rotation.z = sx * 0.4; l.castShadow = false; }

  /* ───── cheveux : coques texturées qui épousent le crâne ───── */
  const shell = (off: number, ph0: number, phL: number, th0: number, thL: number, mat: THREE.Material = hairM) => {
    const geo = shapeHead(new THREE.SphereGeometry(1, 64, 40, ph0, phL, th0, thL), a, off);
    const mesh = new THREE.Mesh(g(geo), mat); mesh.castShadow = true; mesh.receiveShadow = true; head.add(mesh); return mesh;
  };
  const PI = Math.PI;
  // calotte du dessus (ligne des cheveux haute sur le front) + coque arrière et côtés (hors du front, vers les tempes et la nuque)
  const capTop = (th: number, off: number) => shell(off, 0, PI * 2, 0, th);
  const sides = (th0: number, thL: number, off: number) => shell(off, 2.77, PI * 2 - 2.4, th0, thL);
  switch (a.hair) {
    case 1: capTop(0.82, 0.0045); sides(0.78, 0.8, 0.004); break;
    case 2: { capTop(0.8, 0.007); sides(0.76, 0.8, 0.004); shell(0.013, 0.3, PI - 0.6, 0.0, 0.5); break; }
    case 3: { capTop(0.72, 0.008); sides(0.68, 1.1, 0.007); break; }
    case 4: { capTop(0.78, 0.0055); sides(0.74, 0.8, 0.0045); shell(0.02, 0.5, PI - 1.0, 0.25, 0.55); break; }
    case 5: { capTop(0.84, 0.006); sides(0.8, 1.5, 0.011); break; }
    case 6: sides(0.95, 0.8, 0.004); break;
    default: break;
  }
  // barbe : coque + texture
  if (a.beard > 0) {
    const stub = m(new THREE.MeshStandardMaterial({ color: hairHex, alphaMap: stubbleAlpha, transparent: true, alphaTest: 0.2, roughness: 0.8 }));
    const full = m(new THREE.MeshStandardMaterial({ color: "#ffffff", map: hairTex(hairHex), bumpMap: hairTex(hairHex), bumpScale: 0.5, roughness: 0.55 }));
    if (a.beard === 1) shell(0.0012, 0.2, PI - 0.4, 1.45, 1.05, stub);
    else if (a.beard === 2) { shell(0.004, 1.2, PI - 2.4, 2.15, 0.5, full); add(head, g(new RoundedBoxGeometry(0.052, 0.011, 0.012, 3, 0.004)), hairM, 0, -0.047, 0.095); }
    else if (a.beard === 3) { shell(0.0055, 0.0, PI, 1.4, 1.2, full); add(head, g(new RoundedBoxGeometry(0.058, 0.013, 0.013, 3, 0.005)), hairM, 0, -0.047, 0.097); }
    else { shell(0.011, 0.0, PI, 1.25, 1.45, full); shell(0.008, PI - 0.3, 0.6, 1.2, 0.9, full); add(head, g(new RoundedBoxGeometry(0.07, 0.016, 0.02, 3, 0.006)), hairM, 0, -0.045, 0.103); }
  }
  // lunettes
  if (a.glasses > 0) {
    const fm = m(new THREE.MeshStandardMaterial({ color: GLASSES[a.glasses].color!, roughness: 0.25, metalness: 0.7 }));
    const lensM = m(new THREE.MeshPhysicalMaterial({ color: "#cfe8ff", roughness: 0.02, transparent: true, opacity: 0.1, clearcoat: 1 }));
    for (const sx of [-1, 1]) {
      const x = sx * 0.036 * fw;
      const ring = a.glasses === 2 ? add(head, g(rectFrame(0.056, 0.036, 0.0045, 0.008)), fm, x, 0.02, 0.0985) : add(head, g(new THREE.TorusGeometry(0.0265, 0.0032, 10, 36)), fm, x, 0.02, 0.099);
      ring.castShadow = false;
      add(head, g(a.glasses === 2 ? new THREE.PlaneGeometry(0.05, 0.032) : new THREE.CircleGeometry(0.0258, 24)), lensM, x, 0.02, 0.0985 + 0.002).castShadow = false;
      add(head, g(new THREE.BoxGeometry(0.003, 0.003, 0.1)), fm, sx * 0.092 * fw, 0.025, 0.048).castShadow = false;
    }
    add(head, g(new THREE.BoxGeometry(0.02, 0.004, 0.004)), fm, 0, 0.027, 0.1).castShadow = false;
  }

  /* ───── bras : épaule, coude, avant-bras, manchette, main aux doigts légèrement fermés ───── */
  const arms: { sh: THREE.Group; el: THREE.Group }[] = [];
  for (const sx of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(sx * 0.244 * w, 0.525, 0); torso.add(sh);
    add(sh, g(new THREE.SphereGeometry(0.052, 24, 18)), suit, 0, 0.0, 0);
    add(sh, g(new THREE.CylinderGeometry(0.052, 0.046, 0.3, 24)), suit, 0, -0.15, 0);
    const el = new THREE.Group(); el.position.set(0, -0.3, 0); sh.add(el);
    add(el, g(new THREE.SphereGeometry(0.046, 20, 14)), suit, 0, 0, 0);
    add(el, g(new THREE.CylinderGeometry(0.045, 0.039, 0.27, 24)), suit, 0, -0.135, 0);
    add(el, g(new THREE.CylinderGeometry(0.0405, 0.0405, 0.032, 24)), shirt, 0, -0.282, 0);
    if (a.cufflinks) add(el, g(new THREE.SphereGeometry(0.0075, 10, 8)), gold, sx * 0.041, -0.285, 0.0);
    if (a.watch > 0 && sx === -1) {
      const wm = m(new THREE.MeshStandardMaterial({ color: WATCHES[a.watch].color!, roughness: 0.2, metalness: 1 }));
      add(el, g(new THREE.TorusGeometry(0.0425, 0.0065, 10, 28)), wm, 0, -0.3, 0).rotation.x = Math.PI / 2;
      add(el, g(new THREE.CylinderGeometry(0.0215, 0.0215, 0.011, 28)), wm, 0, -0.3, 0.046).rotation.x = Math.PI / 2;
      add(el, g(new THREE.CylinderGeometry(0.0185, 0.0185, 0.003, 28)), m(new THREE.MeshStandardMaterial({ color: "#10131c", roughness: 0.2, metalness: 0.3 })), 0, -0.3, 0.0525).rotation.x = Math.PI / 2;
    }
    const hand = new THREE.Group(); hand.position.set(0, -0.325, 0.008); el.add(hand);
    add(hand, g(new RoundedBoxGeometry(0.078, 0.09, 0.032, 4, 0.014)), skin, 0, -0.045, 0);
    for (let f = 0; f < 4; f++) { const fx = (f - 1.5) * 0.0185, fl = [0.062, 0.07, 0.066, 0.052][f]; const fg = new THREE.Group(); fg.position.set(fx, -0.088, 0); fg.rotation.x = -0.35 - f * 0.04; hand.add(fg); add(fg, g(new THREE.CapsuleGeometry(0.0088, fl, 6, 10)), skin, 0, -fl / 2, 0); }
    const th = new THREE.Group(); th.position.set(-sx * 0.04, -0.03, 0.006); th.rotation.set(-0.2, 0, sx * 0.5); hand.add(th); add(th, g(new THREE.CapsuleGeometry(0.0095, 0.04, 6, 10)), skin, 0, -0.02, 0);
    sh.rotation.z = sx * 0.06; el.rotation.x = -0.12;
    arms.push({ sh, el });
  }

  root.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = o.castShadow !== false; o.receiveShadow = true; } });
  let ph = 0, breath = 0;
  return {
    root, head,
    update(dt, walk) {
      ph += dt * (4.2 + 3.2 * walk) * (walk > 0.05 ? 1 : 0);
      breath += dt;
      const sw = Math.sin(ph) * 0.6 * walk;
      legs[0].hip.rotation.x = sw; legs[1].hip.rotation.x = -sw;
      legs[0].knee.rotation.x = Math.max(0, -Math.sin(ph)) * 0.7 * walk; legs[1].knee.rotation.x = Math.max(0, Math.sin(ph)) * 0.7 * walk;
      arms[0].sh.rotation.x = -sw * 0.75; arms[1].sh.rotation.x = sw * 0.75;
      arms[0].el.rotation.x = -0.12 - Math.max(0, sw) * 0.5 * walk; arms[1].el.rotation.x = -0.12 - Math.max(0, -sw) * 0.5 * walk;
      body.position.y = Math.abs(Math.cos(ph)) * 0.02 * walk;
      torso.rotation.y = Math.sin(ph) * 0.06 * walk;
      torso.scale.y = 1 + Math.sin(breath * 1.6) * 0.004 * (1 - walk);
      head.rotation.y = Math.sin(breath * 0.5) * 0.1 * (1 - walk);
      head.rotation.x = Math.sin(breath * 0.35) * 0.02 * (1 - walk);
    },
    dispose() { geos.forEach((x) => x.dispose()); mats.forEach((x) => x.dispose()); },
  };
}

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";

/** Décors 3D construits par code : parvis et hall de la banque, atelier du tailleur. */

export const HALL = { x0: -16, x1: 16, zBack: -10, zFront: 8, h: 9.5 };
/** Portes des 7 pièces, alignées sur le mur du fond (x) ; le personnage s'arrête en (x, DOOR_Z) face à la porte */
export const DOOR_X = [-13.5, -9, -4.5, 0, 4.5, 9, 13.5];
export const DOOR_Z = -7.6;
/** Baie d'ascenseur : largeur, hauteur, profondeur de la cabine (derrière le mur du fond) */
export const EL = { w: 3.1, h: 4.5, d: 2.8 };
export const ENTRY = { x: 0, z: 5.6 };
export const OBSTACLES = [{ x: 0, z: 0.8, r: 2.9 }, { x: 11.2, z: 2.6, r: 2.7 }, { x: -11.2, z: 2.6, r: 2.7 }, { x: 7.2, z: 5.6, r: 1.2 }];

const std = (color: string | number, rough = 0.7, metal = 0, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });

function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void, repeat?: [number, number]) {
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  draw(cv.getContext("2d")!);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
const rnd = (() => { let s = 12345; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();

function marbleTexture(repeat: [number, number]) {
  return canvasTex(1024, 1024, (c) => {
    const n = 8, sz = 1024 / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const dark = (i + j) % 2 === 0;
      c.fillStyle = dark ? "#cfc6b4" : "#efe9dc"; c.fillRect(i * sz, j * sz, sz, sz);
      c.strokeStyle = dark ? "rgba(120,110,95,.28)" : "rgba(150,140,125,.2)"; c.lineWidth = 2;
      for (let k = 0; k < 4; k++) { c.beginPath(); const x = i * sz + rnd() * sz, y = j * sz + rnd() * sz; c.moveTo(x, y); c.bezierCurveTo(x + 30, y + 40, x - 40, y + 70, x + 20, y + sz * 0.6); c.stroke(); }
    }
    c.strokeStyle = "#c9a24a"; c.lineWidth = 3; for (let i = 0; i <= n; i++) { c.beginPath(); c.moveTo(i * sz, 0); c.lineTo(i * sz, 1024); c.stroke(); c.beginPath(); c.moveTo(0, i * sz); c.lineTo(1024, i * sz); c.stroke(); }
  }, repeat);
}
/** Marbre veiné (murs) : grandes veines grises et dorées sur fond ivoire */
function veinedMarble(repeat: [number, number]) {
  return canvasTex(1024, 1024, (c) => {
    c.fillStyle = "#e8dfcf"; c.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 1500; i++) { c.fillStyle = `rgba(${rnd() < 0.5 ? "120,105,85" : "255,255,255"},${rnd() * 0.05})`; c.fillRect(rnd() * 1024, rnd() * 1024, 6 + rnd() * 30, 6 + rnd() * 30); }
    c.filter = "blur(1.2px)";
    for (let v = 0; v < 26; v++) {
      c.strokeStyle = rnd() < 0.25 ? `rgba(190,150,70,${0.18 + rnd() * 0.2})` : `rgba(95,88,80,${0.12 + rnd() * 0.22})`; c.lineWidth = 0.8 + rnd() * 2.6;
      c.beginPath(); let x = rnd() * 1024, y = rnd() * 1024; c.moveTo(x, y);
      for (let s = 0; s < 14; s++) { x += (rnd() - 0.35) * 120; y += (rnd() - 0.5) * 120; c.lineTo(x, y); }
      c.stroke();
    }
  }, repeat);
}
function towerTexture() {
  return canvasTex(512, 1024, (c) => {
    c.fillStyle = "#0d1426"; c.fillRect(0, 0, 512, 1024);
    for (let y = 8; y < 1024; y += 22) for (let x = 8; x < 512; x += 22) { const lit = rnd() < 0.42; c.fillStyle = lit ? (rnd() < 0.5 ? "#f3d58a" : "#cfe3ff") : "#16203a"; c.fillRect(x, y, 14, 14); }
  });
}
function signTexture(text: string, sub?: string) {
  return canvasTex(1024, 256, (c) => {
    c.fillStyle = "#0b1020"; c.fillRect(0, 0, 1024, 256);
    c.strokeStyle = "#c9a24a"; c.lineWidth = 8; c.strokeRect(10, 10, 1004, 236);
    const g = c.createLinearGradient(0, 60, 0, 190); g.addColorStop(0, "#fff1b8"); g.addColorStop(0.5, "#e0b84a"); g.addColorStop(1, "#8a6a28");
    c.fillStyle = g; c.textAlign = "center"; c.textBaseline = "middle";
    let fs = 118; c.font = `800 ${fs}px 'Times New Roman', serif`; while (c.measureText(text).width > 900 && fs > 30) { fs -= 4; c.font = `800 ${fs}px 'Times New Roman', serif`; }
    c.fillText(text, 512, sub ? 108 : 128);
    if (sub) { c.font = "500 44px 'Times New Roman', serif"; c.fillStyle = "#d9c58a"; c.fillText(sub, 512, 205); }
  });
}

export interface BankWorld {
  group: THREE.Group;
  /** Mur de façade (retiré une fois à l'intérieur pour la vue en coupe) */
  front: THREE.Group;
  /** Anime les portes coulissantes, le globe et le lustre */
  update(dt: number, avatarPos: THREE.Vector3): void;
  labelAnchors: THREE.Vector3[];
  /** Ouvre (1) ou ferme (0) les portes de l'ascenseur `slot` ; renvoie l'ouverture actuelle (0 à 1) */
  setDoor(slot: number, open: number): void;
  /** Coupe le reflet du sol (appareil lent) */
  disableMirror(): void;
  doorAt(slot: number): number;
  dispose(): void;
  receptionist: THREE.Vector3;
}

export function buildBank(scene: THREE.Scene, opts: { reflect?: boolean } = {}): BankWorld {
  const group = new THREE.Group(); scene.add(group);
  const disposables: { dispose(): void }[] = [];
  const reg = <T extends { dispose(): void }>(x: T) => { disposables.push(x); return x; };
  const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = group, rounded = 0) => {
    const o = new THREE.Mesh(reg(rounded ? new RoundedBoxGeometry(w, h, d, 3, rounded) : new THREE.BoxGeometry(w, h, d)), m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o;
  };
  const gold = reg(std("#e0b84a", 0.28, 0.9));
  const goldDim = reg(std("#a8832f", 0.35, 0.85));
  const wallM = reg(new THREE.MeshStandardMaterial({ map: reg(veinedMarble([3, 1.2])), color: "#f2e6d0", roughness: 0.22, metalness: 0.05 }));
  const wallDark = reg(std("#2a2230", 0.6, 0.1));
  const wood = reg(std("#3b2414", 0.5, 0.1));

  /* ───── sol, murs ───── */
  const floorTex = reg(marbleTexture([4, 2.25]));
  const floor = new THREE.Mesh(reg(new THREE.PlaneGeometry(HALL.x1 - HALL.x0, HALL.zFront - HALL.zBack)), reg(new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.1, metalness: 0.1, ...(opts.reflect ? { transparent: true, opacity: 0.8 } : {}) })));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, (HALL.zFront + HALL.zBack) / 2); floor.receiveShadow = true; group.add(floor);
  // reflet du sol poli : une 2e vue de la scène, vue à travers le marbre légèrement transparent
  let mirror: Reflector | null = null;
  if (opts.reflect) {
    mirror = new Reflector(new THREE.PlaneGeometry(HALL.x1 - HALL.x0, HALL.zFront - HALL.zBack), { clipBias: 0.003, textureWidth: 768, textureHeight: 512, color: 0x8a8578 });
    mirror.rotation.x = -Math.PI / 2; mirror.position.set(0, -0.004, (HALL.zFront + HALL.zBack) / 2); group.add(mirror);
    floor.renderOrder = 1;
  }
  const W = HALL.x1 - HALL.x0, cz = (HALL.zFront + HALL.zBack) / 2;
  // mur du fond percé de 7 baies d'ascenseur : piliers pleins entre les baies, linteau au-dessus
  {
    const edges = [HALL.x0 - 0.5, ...DOOR_X.flatMap((x) => [x - EL.w / 2, x + EL.w / 2]), HALL.x1 + 0.5];
    for (let i = 0; i < edges.length; i += 2) { const x0 = edges[i], x1 = edges[i + 1]; if (x1 - x0 > 0.01) box(x1 - x0, HALL.h, 0.6, wallM, (x0 + x1) / 2, HALL.h / 2, HALL.zBack - 0.3); }
    box(W + 1, HALL.h - EL.h, 0.6, wallM, 0, EL.h + (HALL.h - EL.h) / 2, HALL.zBack - 0.3);
  }
  box(0.6, HALL.h, HALL.zFront - HALL.zBack, wallM, HALL.x0 - 0.3, HALL.h / 2, cz);   // gauche
  box(0.6, HALL.h, HALL.zFront - HALL.zBack, wallM, HALL.x1 + 0.3, HALL.h / 2, cz);   // droite
  // lambris dorés
  box(W, 0.14, 0.16, gold, 0, 3.6, HALL.zBack + 0.08); box(W, 0.14, 0.16, gold, 0, HALL.h - 0.7, HALL.zBack + 0.08);
  box(0.16, 0.14, HALL.zFront - HALL.zBack, gold, HALL.x0 + 0.08, 3.6, cz); box(0.16, 0.14, HALL.zFront - HALL.zBack, gold, HALL.x1 - 0.08, 3.6, cz);
  box(W, 0.4, 0.5, wallDark, 0, 0.2, HALL.zBack + 0.25);
  // pilastres entre les portes
  for (const x of [-11.25, -6.75, -2.25, 2.25, 6.75, 11.25]) { box(0.7, HALL.h - 0.8, 0.45, wallM, x, (HALL.h - 0.8) / 2, HALL.zBack + 0.22, group, 0.05); box(0.9, 0.3, 0.55, gold, x, HALL.h - 1.0, HALL.zBack + 0.25); box(0.9, 0.3, 0.55, gold, x, 0.2, HALL.zBack + 0.25); }
  // plafond à caissons et lustre
  const ceil = new THREE.Mesh(reg(new THREE.PlaneGeometry(W, HALL.zFront - HALL.zBack)), reg(std("#171320", 0.8)));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(0, HALL.h, cz); group.add(ceil);
  for (let i = -3; i <= 3; i++) box(0.3, 0.3, HALL.zFront - HALL.zBack, goldDim, i * 4.4, HALL.h - 0.15, cz);
  const chandelier = new THREE.Group(); chandelier.position.set(0, 6.6, 0.8); group.add(chandelier);
  for (const [r, n] of [[1.8, 18], [1.0, 10]] as [number, number][]) {
    const ring = new THREE.Mesh(reg(new THREE.TorusGeometry(r, 0.06, 8, 40)), gold); ring.rotation.x = Math.PI / 2; chandelier.add(ring);
    for (let i = 0; i < n; i++) { const b = new THREE.Mesh(reg(new THREE.SphereGeometry(0.1, 10, 8)), reg(new THREE.MeshStandardMaterial({ color: "#fff3cf", emissive: "#ffd98a", emissiveIntensity: 1.4 }))); const a = (i / n) * Math.PI * 2; b.position.set(Math.cos(a) * r, -0.05, Math.sin(a) * r); chandelier.add(b); }
  }
  const chain = new THREE.Mesh(reg(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 6)), gold); chain.position.y = 1.2; chandelier.add(chain);
  const lamp = new THREE.PointLight("#ffe2a8", 45, 34, 1.7); lamp.position.set(0, 6.3, 0.8); lamp.castShadow = false; group.add(lamp);

  /* ───── 7 ascenseurs : chacun mène à une option ───── */
  const labelAnchors: THREE.Vector3[] = [];
  const leaves: [THREE.Mesh, THREE.Mesh][] = [];
  const openNow: number[] = DOOR_X.map(() => 0), openGoal: number[] = DOOR_X.map(() => 0);
  const brushed = reg(new THREE.MeshStandardMaterial({ color: "#c9a85a", roughness: 0.28, metalness: 1 }));
  const champagne = reg(new THREE.MeshStandardMaterial({ color: "#d8c7a0", roughness: 0.35, metalness: 0.85 }));
  const bronze = reg(std("#3a2a16", 0.4, 0.8));
  const cabLight = reg(new THREE.MeshStandardMaterial({ color: "#fff1cf", emissive: "#ffe2a8", emissiveIntensity: 2.6 }));
  const cabFloor = reg(std("#1c1c22", 0.15, 0.2));
  DOOR_X.forEach((x, i) => {
    const zb = HALL.zBack;
    // encadrement bronze et or
    box(0.3, EL.h + 0.3, 0.42, bronze, x - EL.w / 2 - 0.15, (EL.h + 0.3) / 2, zb + 0.18);
    box(0.3, EL.h + 0.3, 0.42, bronze, x + EL.w / 2 + 0.15, (EL.h + 0.3) / 2, zb + 0.18);
    box(EL.w + 0.9, 0.34, 0.46, bronze, x, EL.h + 0.17, zb + 0.2);
    box(EL.w + 0.2, 0.06, 0.5, gold, x, EL.h + 0.36, zb + 0.2);
    // cabine : sol, parois miroir doré, plafond lumineux
    box(EL.w, 0.1, EL.d, cabFloor, x, 0.05, zb - EL.d / 2);
    box(EL.w, EL.h, 0.1, brushed, x, EL.h / 2, zb - EL.d);
    box(0.1, EL.h, EL.d, champagne, x - EL.w / 2, EL.h / 2, zb - EL.d / 2); box(0.1, EL.h, EL.d, champagne, x + EL.w / 2, EL.h / 2, zb - EL.d / 2);
    box(EL.w, 0.1, EL.d, champagne, x, EL.h, zb - EL.d / 2);
    box(EL.w - 0.4, 0.04, EL.d - 0.4, cabLight, x, EL.h - 0.07, zb - EL.d / 2).castShadow = false;
    box(EL.w - 0.5, 0.06, 0.1, gold, x, 1.05, zb - EL.d + 0.1); // main courante
    // vantaux coulissants : or brossé avec rainures
    const mk = (sx: number) => {
      const g = new THREE.Group(); g.position.set(x + sx * EL.w / 4, EL.h / 2, zb + 0.04); group.add(g);
      const leaf = new THREE.Mesh(reg(new RoundedBoxGeometry(EL.w / 2 - 0.02, EL.h - 0.04, 0.08, 2, 0.01)), brushed); leaf.castShadow = true; leaf.receiveShadow = true; g.add(leaf);
      for (let k = -2; k <= 2; k++) { const r = new THREE.Mesh(reg(new THREE.BoxGeometry(0.012, EL.h - 0.3, 0.012)), goldDim); r.position.set(k * 0.28, 0, 0.045); g.add(r); }
      return g as unknown as THREE.Mesh;
    };
    leaves.push([mk(-1), mk(1)]);
    // afficheur d'étage et bouton d'appel
    const disp = new THREE.Mesh(reg(new THREE.PlaneGeometry(0.9, 0.34)), reg(new THREE.MeshBasicMaterial({ map: signTexture(String(i + 1), undefined) })));
    disp.position.set(x, EL.h + 0.17, zb + 0.43); group.add(disp);
    box(0.2, 0.42, 0.06, bronze, x + EL.w / 2 + 0.55, 1.3, zb + 0.07);
    for (const dy of [0.08, -0.08]) { const b = new THREE.Mesh(reg(new THREE.SphereGeometry(0.035, 12, 8)), reg(new THREE.MeshStandardMaterial({ color: "#fff3cf", emissive: "#ffd98a", emissiveIntensity: 2 }))); b.position.set(x + EL.w / 2 + 0.55, 1.3 + dy, zb + 0.12); group.add(b); }
    box(EL.w + 1.2, 0.04, 1.6, reg(std("#7a1d2b", 0.9)), x, 0.02, zb + 1.2);   // tapis devant l'ascenseur
    labelAnchors.push(new THREE.Vector3(x, EL.h + (i % 2 ? 2.4 : 1.2), zb + 0.5));
  });

  /* ───── mobilier : globe d'or, accueil, salon ───── */
  const platform = new THREE.Mesh(reg(new THREE.CylinderGeometry(2.7, 2.9, 0.4, 48)), reg(std("#efe9dc", 0.25, 0.1))); platform.position.set(0, 0.2, 0.8); platform.receiveShadow = true; platform.castShadow = true; group.add(platform);
  const ringBase = new THREE.Mesh(reg(new THREE.TorusGeometry(2.75, 0.08, 8, 48)), gold); ringBase.rotation.x = Math.PI / 2; ringBase.position.set(0, 0.42, 0.8); group.add(ringBase);
  const globe = new THREE.Group(); globe.position.set(0, 1.95, 0.8); group.add(globe);
  const sphere = new THREE.Mesh(reg(new THREE.SphereGeometry(1.05, 40, 28)), reg(std("#caa13c", 0.22, 1))); sphere.castShadow = true; globe.add(sphere);
  for (const r of [1.2, 1.4]) { const t = new THREE.Mesh(reg(new THREE.TorusGeometry(r, 0.025, 8, 60)), gold); t.rotation.set(Math.PI / 2.4, 0.3, r > 1.3 ? 0.8 : 0); globe.add(t); }
  for (let i = 0; i < 5; i++) { const t = new THREE.Mesh(reg(new THREE.TorusGeometry(1.05, 0.012, 6, 60)), reg(std("#8a6a28", 0.4, 0.9))); t.rotation.y = (i / 5) * Math.PI; globe.add(t); }
  const stand = new THREE.Mesh(reg(new THREE.CylinderGeometry(0.2, 0.5, 0.5, 16)), gold); stand.position.set(0, 0.65, 0.8); group.add(stand);
  // comptoir d'accueil (arc de cercle) — à droite
  const desk = new THREE.Mesh(reg(new THREE.CylinderGeometry(2.3, 2.3, 1.15, 40, 1, false, Math.PI * 0.55, Math.PI * 0.9)), reg(std("#3b2414", 0.35, 0.2, { side: THREE.DoubleSide }))); desk.position.set(11.2, 0.575, 2.6); desk.castShadow = true; group.add(desk);
  const deskTop = new THREE.Mesh(reg(new THREE.CylinderGeometry(2.4, 2.4, 0.09, 40, 1, false, Math.PI * 0.55, Math.PI * 0.9)), reg(std("#efe9dc", 0.2, 0.1, { side: THREE.DoubleSide }))); deskTop.position.set(11.2, 1.18, 2.6); group.add(deskTop);
  const logoPanel = new THREE.Mesh(reg(new THREE.PlaneGeometry(2.6, 0.65)), reg(new THREE.MeshBasicMaterial({ map: signTexture("ACCUEIL") }))); logoPanel.position.set(11.2, 0.6, 4.88); logoPanel.rotation.y = 0; group.add(logoPanel);
  // salon à gauche : canapés et table basse
  const leather = reg(std("#5a1f2b", 0.5, 0.05));
  box(3.4, 0.55, 1.0, leather, -11.2, 0.3, 4.4, group, 0.15); box(3.4, 0.9, 0.25, leather, -11.2, 0.75, 4.8, group, 0.1);
  box(1.0, 0.55, 2.6, leather, -13.0, 0.3, 2.4, group, 0.15); box(0.25, 0.9, 2.6, leather, -13.4, 0.75, 2.4, group, 0.1);
  box(1.5, 0.12, 1.5, reg(std("#d9d4c8", 0.12, 0.2)), -11.0, 0.45, 2.4, group, 0.05);
  // plantes
  const planter = (x: number, z: number) => { box(0.9, 0.9, 0.9, reg(std("#d9d4c8", 0.4)), x, 0.45, z, group, 0.12); const l = new THREE.Mesh(reg(new THREE.IcosahedronGeometry(0.85, 1)), reg(std("#2f7d4f", 0.7))); l.position.set(x, 1.7, z); l.castShadow = true; group.add(l); };
  for (const [x, z] of [[-14.8, -8.6], [14.8, -8.6], [-14.8, 6.6], [14.8, 6.6], [-5.5, 5.4], [5.5, 5.4]]) planter(x, z);

  /* ───── façade extérieure et parvis ───── */
  const front = new THREE.Group(); group.add(front);
  const fw = (x0: number, x1: number) => box(x1 - x0, HALL.h, 0.6, wallM, (x0 + x1) / 2, HALL.h / 2, HALL.zFront + 0.3, front);
  fw(HALL.x0 - 0.6, -2.7); fw(2.7, HALL.x1 + 0.6);
  box(5.4, HALL.h - 4.6, 0.6, wallM, 0, 4.6 + (HALL.h - 4.6) / 2, HALL.zFront + 0.3, front);
  for (const x of [-14, -10.5, -7, 7, 10.5, 14]) { box(0.9, HALL.h + 0.6, 0.9, wallM, x, (HALL.h + 0.6) / 2, HALL.zFront + 1.1, front, 0.1); box(1.2, 0.35, 1.2, gold, x, HALL.h + 0.2, HALL.zFront + 1.1, front); box(1.2, 0.35, 1.2, gold, x, 0.2, HALL.zFront + 1.1, front); }
  box(W + 3, 0.7, 2.2, gold, 0, HALL.h + 0.5, HALL.zFront + 0.9, front);
  const sign = new THREE.Mesh(reg(new THREE.PlaneGeometry(10, 2.5)), reg(new THREE.MeshBasicMaterial({ map: signTexture("FINANCIAL EMPIRE", "BANQUE D'INVESTISSEMENT") }))); sign.position.set(0, HALL.h - 2.4, HALL.zFront + 0.65); front.add(sign);
  // portes vitrées coulissantes
  const glassM = reg(new THREE.MeshPhysicalMaterial({ color: "#9fc4e0", roughness: 0.05, metalness: 0.1, transmission: 0, transparent: true, opacity: 0.32 }));
  const leafL = box(2.6, 4.5, 0.1, glassM, -1.3, 2.25, HALL.zFront + 0.35, front), leafR = box(2.6, 4.5, 0.1, glassM, 1.3, 2.25, HALL.zFront + 0.35, front);
  for (const l of [leafL, leafR]) l.castShadow = false;
  box(5.6, 0.2, 0.4, gold, 0, 4.6, HALL.zFront + 0.45, front); box(0.18, 4.6, 0.4, gold, -2.8, 2.3, HALL.zFront + 0.45, front); box(0.18, 4.6, 0.4, gold, 2.8, 2.3, HALL.zFront + 0.45, front);
  // perron
  for (let i = 0; i < 4; i++) box(14, 0.18, 1.0, reg(std("#e6dfcf", 0.35, 0.05)), 0, 0.09 + (3 - i) * 0.0, HALL.zFront + 1.5 + i * 0.9, front).scale.y = 1 + (3 - i) * 0.6;
  // parvis
  const plazaTex = reg(canvasTex(512, 512, (c) => { c.fillStyle = "#222a3a"; c.fillRect(0, 0, 512, 512); c.strokeStyle = "#323c52"; c.lineWidth = 3; for (let i = 0; i <= 8; i++) { c.beginPath(); c.moveTo(i * 64, 0); c.lineTo(i * 64, 512); c.stroke(); c.beginPath(); c.moveTo(0, i * 64); c.lineTo(512, i * 64); c.stroke(); } c.strokeStyle = "#c9a24a"; c.lineWidth = 6; c.strokeRect(0, 0, 512, 512); }, [20, 14]));
  const plaza = new THREE.Mesh(reg(new THREE.PlaneGeometry(120, 80)), reg(new THREE.MeshStandardMaterial({ map: plazaTex, roughness: 0.4, metalness: 0.1 }))); plaza.rotation.x = -Math.PI / 2; plaza.position.set(0, -0.005, HALL.zFront + 40); plaza.receiveShadow = true; group.add(plaza);
  const hole = new THREE.Mesh(reg(new THREE.PlaneGeometry(200, 120)), reg(std("#10141f", 1))); hole.rotation.x = -Math.PI / 2; hole.position.set(0, -0.02, -30); group.add(hole);
  // tapis rouge du perron à la porte
  box(2.6, 0.04, 22, reg(std("#7a1d2b", 0.9)), 0, 0.02, HALL.zFront + 12.5, front);
  // lampadaires, jardinières
  for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) {
    const x = sx * 7, z = HALL.zFront + 6 + i * 7;
    box(0.14, 4.4, 0.14, goldDim, x, 2.2, z, front); const b = new THREE.Mesh(reg(new THREE.SphereGeometry(0.34, 14, 10)), reg(new THREE.MeshStandardMaterial({ color: "#fff3cf", emissive: "#ffd98a", emissiveIntensity: 2.4 }))); b.position.set(x, 4.55, z); front.add(b);
    const pl = new THREE.PointLight("#ffd98a", 9, 12, 1.8); pl.position.set(x, 4.4, z); front.add(pl);
    planter(sx * 10, HALL.zFront + 8 + i * 7);
  }
  // tours alentour (silhouette urbaine, fenêtres éclairées)
  const tTex = reg(towerTexture());
  const tMat = (rx: number, ry: number) => { const t = tTex.clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.needsUpdate = true; return reg(new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: "#ffffff", emissiveIntensity: 0.55, roughness: 0.6 })); };
  box(W + 10, 54, 18, tMat(6, 4), 0, 27, -20, group);           // tour de la banque
  for (let i = 0; i < 26; i++) {
    const side = i % 2 ? 1 : -1, hh = 24 + rnd() * 60, ww = 8 + rnd() * 10, z = HALL.zFront - 24 + Math.floor(i / 2) * 11 + rnd() * 5, x = side * (30 + rnd() * 26);
    box(ww, hh, ww, tMat(Math.max(1, Math.round(ww / 3)), Math.max(1, Math.round(hh / 8))), x, hh / 2, z, group);
  }

  const labelMat = null; void labelMat;
  const receptionist = new THREE.Vector3(11.2, 0, 4.1);
  let t = 0;
  return {
    group, front, labelAnchors, receptionist,
    setDoor(slot, open) { openGoal[slot] = open; },
    disableMirror() { if (mirror) { mirror.visible = false; mirror = null; } (floor.material as THREE.MeshStandardMaterial).opacity = 1; (floor.material as THREE.MeshStandardMaterial).transparent = false; (floor.material as THREE.MeshStandardMaterial).needsUpdate = true; },
    doorAt(slot) { return openNow[slot]; },
    update(dt, p) {
      t += dt;
      globe.rotation.y += dt * 0.25; chandelier.rotation.y += dt * 0.05;
      // portes coulissantes : s'ouvrent à l'approche
      const near = p.z > HALL.zFront - 4 && p.z < HALL.zFront + 9 && Math.abs(p.x) < 4.5;
      const open = near ? 1.9 : 0;
      leafL.position.x += ((-1.3 - open) - leafL.position.x) * Math.min(1, dt * 4);
      leafR.position.x += ((1.3 + open) - leafR.position.x) * Math.min(1, dt * 4);
      DOOR_X.forEach((x, i) => { openNow[i] += (openGoal[i] - openNow[i]) * Math.min(1, dt * 3.2); const o = openNow[i] * EL.w * 0.23; leaves[i][0].position.x = x - EL.w / 4 - o; leaves[i][1].position.x = x + EL.w / 4 + o; });
      void t;
    },
    dispose() { disposables.forEach((d) => d.dispose()); scene.remove(group); },
  };
}

/** Atelier de tailleur : podium, miroir, tissus */
export function buildTailor(scene: THREE.Scene) {
  const group = new THREE.Group(); scene.add(group);
  const disposables: { dispose(): void }[] = [];
  const reg = <T extends { dispose(): void }>(x: T) => { disposables.push(x); return x; };
  const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, r = 0) => { const o = new THREE.Mesh(reg(r ? new RoundedBoxGeometry(w, h, d, 3, r) : new THREE.BoxGeometry(w, h, d)), m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; group.add(o); return o; };
  const wood = reg(std("#3b2414", 0.5, 0.1)), gold = reg(std("#e0b84a", 0.28, 0.9));
  const floor = new THREE.Mesh(reg(new THREE.PlaneGeometry(14, 14)), reg(new THREE.MeshStandardMaterial({ map: reg(marbleTexture([2, 2])), roughness: 0.25, metalness: 0.12 }))); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; group.add(floor);
  box(14, 6, 0.4, reg(std("#2a1c16", 0.7)), 0, 3, -4.2);
  box(0.4, 6, 8.6, reg(std("#2a1c16", 0.7)), -5.5, 3, 0); box(0.4, 6, 8.6, reg(std("#2a1c16", 0.7)), 5.5, 3, 0);
  // miroir triptyque doré
  for (const [x, ry] of [[-2.1, 0.35], [0, 0], [2.1, -0.35]] as [number, number][]) {
    const f = new THREE.Group(); f.position.set(x, 1.9, -3.7); f.rotation.y = ry; group.add(f);
    const frame = new THREE.Mesh(reg(new RoundedBoxGeometry(1.9, 3.5, 0.12, 3, 0.04)), gold); f.add(frame);
    const glass = new THREE.Mesh(reg(new THREE.PlaneGeometry(1.65, 3.25)), reg(new THREE.MeshStandardMaterial({ color: "#7d89a6", roughness: 0.12, metalness: 0.55, emissive: "#1d2540", emissiveIntensity: 0.9 }))); glass.position.z = 0.07; f.add(glass);
  }
  // podium
  const pod = new THREE.Mesh(reg(new THREE.CylinderGeometry(1.1, 1.2, 0.22, 48)), reg(std("#7a1d2b", 0.85))); pod.position.y = 0.11; pod.receiveShadow = true; group.add(pod);
  const ring = new THREE.Mesh(reg(new THREE.TorusGeometry(1.12, 0.035, 8, 48)), gold); ring.rotation.x = Math.PI / 2; ring.position.y = 0.22; group.add(ring);
  // rouleaux de tissu, cintres, mannequin décoratif
  const cols = ["#1c2a4a", "#34383f", "#8d939c", "#3d1620", "#b7a083", "#121c36"];
  cols.forEach((c, i) => { const r = new THREE.Mesh(reg(new THREE.CylinderGeometry(0.17, 0.17, 1.5, 20)), reg(std(c, 0.9))); r.position.set(-4.9 + (i % 3) * 0.42, 0.9 + Math.floor(i / 3) * 0.4, -3 + (i % 2) * 0.05); r.rotation.z = Math.PI / 2; r.rotation.y = Math.PI / 2; r.castShadow = true; group.add(r); });
  box(1.4, 0.9, 1.0, wood, 4.5, 0.45, -2.6, 0.04); box(1.5, 0.06, 1.1, gold, 4.5, 0.93, -2.6);
  // luminaires
  const l1 = new THREE.SpotLight("#fff1d2", 140, 20, 0.55, 0.5, 1.2); l1.position.set(1.5, 6, 4); l1.target.position.set(0, 1.1, 0); l1.castShadow = true; l1.shadow.mapSize.set(1024, 1024); group.add(l1, l1.target);
  const l2 = new THREE.PointLight("#ffb77a", 14, 14, 1.5); l2.position.set(-4, 3.2, 1); group.add(l2);
  return { group, dispose() { disposables.forEach((d) => d.dispose()); scene.remove(group); } };
}

/** Dégradé de ciel d'aube */
export function skyMesh() {
  const geo = new THREE.SphereGeometry(300, 24, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color("#10193a") }, mid: { value: new THREE.Color("#5d4a78") }, low: { value: new THREE.Color("#f6b27a") } },
    vertexShader: "varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: "varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 low; void main(){ float h = normalize(vP).y; vec3 c = mix(low, mid, smoothstep(-0.05, 0.25, h)); c = mix(c, top, smoothstep(0.2, 0.8, h)); gl_FragColor = vec4(c, 1.0); }",
  });
  return new THREE.Mesh(geo, mat);
}

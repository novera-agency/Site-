import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { Avatar } from "@/engine/avatar";
import { defaultAvatar } from "@/engine/avatar";
import { RigSlot } from "./rigslot";
import { buildBank, HALL, type BankWorld } from "./world";
import { IntroAudio, type Section } from "./introAudio";

/**
 * Introduction cinématographique : arrivée du joueur devant la banque, puis dans le hall.
 * Scène 3D temps réel (rien de pré-enregistré), indépendante du jeu : elle n'écrit rien dans la partie.
 * Chronologie (secondes) : 0 plan d'ensemble sur la ville · 7,5 approche de la banque · 16 arrivée du personnage (travelling latéral) ·
 * 24,8 entrée par les portes · 34 découverte du hall (panoramique) · 43 plan final.
 */
import { INTRO_DURATION } from "./intro-timing";
export { INTRO_DURATION };
export interface IntroOptions {
  canvas: HTMLCanvasElement; avatar: Avatar; muted?: boolean; reduced?: boolean;
  /** Appelé à chaque image avec le temps de la séquence (secondes) */
  onFrame?: (t: number) => void; onEnd?: () => void;
}

type V3 = THREE.Vector3;
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const sstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const smoother = (t: number) => { t = Math.min(1, Math.max(0, t)); return t * t * t * (t * (t * 6 - 15) + 10); };
const TAU = Math.PI * 2;
const angDiff = (a: number, b: number) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const mix = (a: number, b: number, k: number) => a + (b - a) * k;
const mixV = (a: V3, b: V3, k: number) => a.clone().lerp(b, k);

function pickQuality(): "high" | "medium" | "low" {
  try { const q = new URLSearchParams(window.location.search).get("q") ?? localStorage.getItem("fe_q"); if (q === "high" || q === "medium" || q === "low") return q; } catch { /* */ }
  if (navigator.webdriver) return "low";
  if (/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)) return "low"; // téléphone : pas de post-traitement, résolution native, peu de lumières
  return "high";
}
function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void, repeat?: [number, number], srgb = true) {
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h; draw(cv.getContext("2d")!);
  const t = new THREE.CanvasTexture(cv); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/** Ciel de début de matinée avec halo solaire (sert aussi à fabriquer les reflets des vitrages) */
function daySky(sunDir: V3) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { sun: { value: sunDir.clone().normalize() }, top: { value: new THREE.Color("#4a7fc8") }, mid: { value: new THREE.Color("#a9c6e6") }, low: { value: new THREE.Color("#f2d8b2") } },
    vertexShader: "varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: `varying vec3 vP; uniform vec3 sun; uniform vec3 top; uniform vec3 mid; uniform vec3 low;
      void main(){ vec3 d = normalize(vP); float h = d.y; vec3 c = mix(low, mid, smoothstep(-0.02, 0.22, h)); c = mix(c, top, smoothstep(0.18, 0.85, h));
        float s = max(dot(d, normalize(sun)), 0.0); c += vec3(1.0, 0.82, 0.55) * (pow(s, 6.0) * 0.35 + pow(s, 120.0) * 2.2 + pow(s, 1400.0) * 30.0);
        float cl = smoothstep(0.52, 0.78, sin(d.x * 9.0 + 1.3) * sin(d.z * 7.0) * 0.5 + 0.5) * smoothstep(0.04, 0.3, h) * (1.0 - smoothstep(0.3, 0.6, h)); c = mix(c, vec3(1.0, 0.95, 0.9), cl * 0.28);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(400, 32, 20), mat);
}

/** Verre de façade : étages, meneaux, quelques vitres éclairées */
function curtainTexture(warm: number) {
  return canvasTex(256, 256, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, "#3d6288"); g.addColorStop(0.5, "#2a4a6e"); g.addColorStop(1, "#1d3856"); c.fillStyle = g; c.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 64) for (let x = 0; x < 256; x += 64) {
      const r = rnd(); c.fillStyle = r < warm ? "rgba(255,214,150,0.32)" : r < warm + 0.25 ? "rgba(150,190,225,0.16)" : "rgba(8,16,28,0.14)"; c.fillRect(x + 2, y + 2, 60, 60);
    }
    c.strokeStyle = "rgba(200,212,224,0.75)"; c.lineWidth = 2; for (let i = 0; i <= 256; i += 64) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 256); c.stroke(); c.beginPath(); c.moveTo(0, i); c.lineTo(256, i); c.stroke(); }
    c.strokeStyle = "rgba(60,72,86,0.9)"; c.lineWidth = 4; c.beginPath(); c.moveTo(0, 0); c.lineTo(256, 0); c.stroke();
  });
}
function asphaltTexture() {
  return canvasTex(512, 256, (c) => {
    c.fillStyle = "#3a3b3e"; c.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 6000; i++) { const v = 40 + Math.floor(rnd() * 40); c.fillStyle = `rgb(${v},${v},${v + 2})`; c.fillRect(rnd() * 512, rnd() * 256, 1 + rnd() * 2, 1 + rnd() * 2); }
    c.fillStyle = "#e9e4d3"; for (let x = 0; x < 512; x += 64) c.fillRect(x + 10, 126, 34, 5);
  }, [8, 1]);
}

/** Position le long d'une ligne brisée, vitesse trapézoïdale (démarrage progressif, arrêt en douceur) */
class Move {
  readonly len: number; readonly dur: number; private seg: { a: V3; b: V3; l: number; s: number }[] = [];
  constructor(readonly t0: number, readonly pts: V3[], readonly v: number, private ta = 0.7, private td = 1.0) {
    let s = 0; for (let i = 0; i < pts.length - 1; i++) { const l = pts[i].distanceTo(pts[i + 1]); this.seg.push({ a: pts[i], b: pts[i + 1], l, s }); s += l; }
    this.len = s; this.dur = s / v + (ta + td) / 2;
  }
  get t1() { return this.t0 + this.dur; }
  dist(t: number) { const u = t - this.t0, v = this.v; if (u <= 0) return 0; if (u >= this.dur) return this.len; if (u < this.ta) return 0.5 * v / this.ta * u * u; if (u < this.dur - this.td) return 0.5 * v * this.ta + v * (u - this.ta); const r = this.dur - u; return this.len - 0.5 * v / this.td * r * r; }
  at(t: number, out: V3) { const d = this.dist(t); let sg = this.seg[this.seg.length - 1]; for (const g of this.seg) if (d <= g.s + g.l) { sg = g; break; } out.copy(sg.a).lerp(sg.b, sg.l ? Math.min(1, (d - sg.s) / sg.l) : 0); return Math.atan2(sg.b.x - sg.a.x, sg.b.z - sg.a.z); }
}

interface Shot { t0: number; t1: number; f: (u: number, t: number) => { p: V3; l: V3; fov: number } }
interface Walker { rig: RigSlot; a: V3; b: V3; v: number; wait: number; phase: number; yaw: number; moving: boolean }

export class IntroSequence {
  private o: IntroOptions;
  private renderer: THREE.WebGLRenderer; private scene = new THREE.Scene(); private camera = new THREE.PerspectiveCamera(36, 1.78, 0.15, 900);
  private quality = pickQuality();
  private composer?: EffectComposer; private grade?: ShaderPass;
  private bank: BankWorld; private sun: THREE.DirectionalLight; private hemi: THREE.HemisphereLight; private fog: THREE.Fog;
  private key = new THREE.PointLight("#ffe6c2", 0, 10, 1.5); private debug = false;
  private hero: RigSlot; private walkers: Walker[] = []; private cars: { g: THREE.Group; lane: number; x0: number; v: number; dir: number }[] = [];
  private audio = new IntroAudio();
  private moves: Move[]; private tEnd: number;
  private shots: Shot[] = [];
  private t = 0; private playing = false; private last = 0; private raf = 0; private disposed = false; private ended = false;
  private heroPos = v3(14, 0, 34); private heroYaw = Math.PI; private heroWalk = 0; private prevYaw = Math.PI; private stepAcc = 0; private lastHeroPos = v3(14, 0, 34);
  private camPos = v3(0, 30, 110); private camLook = v3(0, 7, 12); private camFov = 38; private shotIdx = -1;
  private doorOpen = false; private doorClosed = false; private section: Section = "intro"; private ext = 1;
  private frames = 0; private frameSum = 0; private muted: boolean;
  private tmp = v3(0, 0, 0);

  constructor(o: IntroOptions) {
    this.o = o; this.muted = !!o.muted;
    const q = this.quality;
    this.renderer = new THREE.WebGLRenderer({ canvas: o.canvas, antialias: q !== "low", powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q === "high" ? 1.75 : q === "medium" ? 1.25 : 1));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = q === "low" ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 0.95;

    // ciel + reflets : le ciel sert aussi d'environnement aux vitrages
    const sunDir = v3(-0.5, 0.58, 0.64).normalize();
    this.scene.add(daySky(sunDir));
    if (q !== "low") { const pm = new THREE.PMREMGenerator(this.renderer); const es = new THREE.Scene(); es.add(daySky(sunDir)); this.scene.environment = pm.fromScene(es, 0.02).texture; this.scene.environmentIntensity = 1; pm.dispose(); }
    this.fog = new THREE.Fog("#d6c4aa", 110, 520); this.scene.fog = this.fog;
    this.hemi = new THREE.HemisphereLight("#cfe0ff", "#9b8a74", 1.5); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight("#ffd9a8", 3.4);
    this.sun.target.position.set(0, 0, 26); this.sun.position.copy(this.sun.target.position).addScaledVector(sunDir, 90); this.sun.castShadow = true;
    const sm = q === "high" ? 4096 : q === "medium" ? 2048 : 1024; this.sun.shadow.mapSize.set(sm, sm);
    const sc = this.sun.shadow.camera; sc.left = -52; sc.right = 52; sc.top = 52; sc.bottom = -52; sc.near = 5; sc.far = 220; this.sun.shadow.bias = -0.0003; this.sun.shadow.normalBias = 0.35;
    this.scene.add(this.sun, this.sun.target, this.key);

    // le hall et sa façade : exactement ceux du jeu (mêmes matériaux, même ascenseurs)
    this.bank = buildBank(this.scene, { reflect: q === "high", towers: false });
    this.bank.group.traverse((ob) => { const m = ob as THREE.Mesh; const p = (m.geometry as THREE.PlaneGeometry | undefined)?.parameters; if (m.isMesh && p?.width === 200 && p?.height === 120) m.visible = false; }); // fosse noir du hall : remplacé par le grand sol
    // chaque lampe dynamique alourdit TOUS les pixels : on ne garde que le lustre (et 4 lampadaires en qualité haute), les ampoules restent lumineuses
    let kept = 0; this.bank.group.traverse((ob) => { const l = ob as THREE.PointLight; if (l.isPointLight && l.intensity === 9) { if (q === "high" && kept++ < 4) return; l.visible = false; } });
    this.buildCity(); this.buildFacade(); this.buildStreet();
    this.hero = new RigSlot(o.avatar); this.scene.add(this.hero.root);
    this.buildCrowd();

    // trajet du personnage (secondes de la séquence)
    const A = new Move(8.0, [v3(14, 0, 34), v3(3.2, 0, 22.5), v3(0.3, 0, 18.0)], 1.45);
    const B = new Move(A.t1 + 1.55, [v3(0.3, 0, 18.0), v3(0, 0, 5.0)], 1.5, 0.8, 1.2);
    this.moves = [A, B]; this.tEnd = B.t1;
    this.buildShots(A, B);

    if (q !== "low") this.initComposer();
    this.resize(); this.update(0);
    let dbg = false; try { dbg = /intro_debug=1/.test(window.location.search) || localStorage.getItem("fe_intro_debug") === "1"; } catch { /* */ }
    this.debug = dbg;
    if (dbg) (window as unknown as { __intro?: IntroSequence }).__intro = this;
  }

  /* ───────── décor ───────── */
  private buildCity() {
    const q = this.quality, g = new THREE.Group(); this.scene.add(g);
    const mats = [curtainTexture(0.04), curtainTexture(0.07), curtainTexture(0.02)].map((t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      return q === "low" ? new THREE.MeshStandardMaterial({ map: t, roughness: 0.35, metalness: 0.3, emissive: "#6f8fb4", emissiveMap: t, emissiveIntensity: 0.25 }) : new THREE.MeshPhysicalMaterial({ map: t, color: "#d6e4f4", metalness: 0.5, roughness: 0.16, clearcoat: 0.5, envMapIntensity: 2.4, emissive: "#9db8d8", emissiveMap: t, emissiveIntensity: 0.12 });
    });
    const stone = new THREE.MeshStandardMaterial({ color: "#cfc6b6", roughness: 0.7 });
    const tower = (x: number, z: number, w: number, d: number, h: number, mi: number) => {
      const geo = new THREE.BoxGeometry(w, h, d), uv = geo.attributes.uv as THREE.BufferAttribute;
      const face = (i: number, su: number, sv: number) => { for (let k = i * 4; k < i * 4 + 4; k++) uv.setXY(k, uv.getX(k) * su, uv.getY(k) * sv); };
      face(0, d / 12, h / 12); face(1, d / 12, h / 12); face(2, w / 12, d / 12); face(3, w / 12, d / 12); face(4, w / 12, h / 12); face(5, w / 12, h / 12);
      const m = new THREE.Mesh(geo, mats[mi]); m.position.set(x, h / 2, z); m.castShadow = true; m.receiveShadow = true; g.add(m);
      const crown = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 3 + rnd() * 3, d * 0.7), stone); crown.position.set(x, h + 1.8, z); crown.castShadow = true; g.add(crown);
    };
    // tour de la banque (derrière le hall) : socle de pierre, grande tour de verre, couronnement
    tower(0, -23, 36, 20, 104, 0);
    const podium = new THREE.Mesh(new THREE.BoxGeometry(37, 9.4, 21), stone); podium.position.set(0, 4.7, -23); g.add(podium);
    // toit du hall (le décor du jeu est ouvert au-dessus)
    const roof = new THREE.Mesh(new THREE.BoxGeometry(HALL.x1 - HALL.x0 + 1.4, 0.5, HALL.zFront - HALL.zBack + 1.4), new THREE.MeshStandardMaterial({ color: "#cfc7b8", roughness: 0.8 })); roof.position.set(0, HALL.h + 0.3, (HALL.zFront + HALL.zBack) / 2); roof.castShadow = true; roof.receiveShadow = true; g.add(roof);
    // gratte-ciel de part et d'autre de la place, façades vitrées qui se reflètent
    const n = q === "low" ? 9 : q === "medium" ? 14 : 20;
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1, k = Math.floor(i / 2);
      const w = 16 + rnd() * 12, d = 16 + rnd() * 10, h = 46 + rnd() * 80, x = side * (36 + w / 2 + (k % 2) * 14 + rnd() * 6), z = -8 + k * (q === "low" ? 30 : 20) + rnd() * 6;
      tower(x, z, w, d, h, i % 3);
    }
    // immeubles plus bas qui bordent la rue
    for (const sx of [-1, 1]) for (let i = 0; i < (q === "low" ? 3 : 5); i++) tower(sx * (44 + i * 3), 82 + i * 19, 24, 18, 26 + rnd() * 22, (i + 1) % 3);
    // grand sol qui se perd dans la brume
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshStandardMaterial({ color: "#8b857b", roughness: 0.95, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 })); ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.012, 120); ground.receiveShadow = true; this.scene.add(ground);
  }
  private buildFacade() {
    const q = this.quality, z = HALL.zFront + 0.63, g = new THREE.Group(); this.scene.add(g);
    const t = curtainTexture(0.08); t.repeat.set(2.2, 1.5);
    const glass = q === "low" ? new THREE.MeshStandardMaterial({ map: t, roughness: 0.2, metalness: 0.6 }) : new THREE.MeshPhysicalMaterial({ map: t, color: "#c4d6ea", metalness: 0.9, roughness: 0.07, clearcoat: 0.6, envMapIntensity: 1.7, emissive: "#ffd9a0", emissiveMap: t, emissiveIntensity: 0.12 });
    const panel = (x0: number, x1: number, y0: number, y1: number) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0), glass); m.position.set((x0 + x1) / 2, (y0 + y1) / 2, z); g.add(m); };
    panel(-15.6, -2.8, 0.15, 9.2); panel(2.8, 15.6, 0.15, 9.2);
    // soubassement de pierre sous les vitrages et encadrements métalliques
    const brass = new THREE.MeshStandardMaterial({ color: "#b99a52", roughness: 0.3, metalness: 0.9 });
    for (const x of [-15.6, -2.8, 2.8, 15.6]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.18, 9.2, 0.12), brass); m.position.set(x, 4.6, z + 0.04); g.add(m); }
    // éclairage d'accueil de l'entrée : deux projecteurs encastrés sur le perron
    if (q === "high") for (const x of [-3.6, 3.6]) { const s = new THREE.SpotLight("#ffe2b0", 60, 18, 0.5, 0.6, 1.4); s.position.set(x, 8.4, HALL.zFront + 3); s.target.position.set(x * 0.4, 0, HALL.zFront + 6); g.add(s, s.target); }
  }
  private buildStreet() {
    const q = this.quality;
    const road = new THREE.Mesh(new THREE.PlaneGeometry(500, 11), new THREE.MeshStandardMaterial({ map: asphaltTexture(), roughness: 0.55, metalness: 0.05 })); road.rotation.x = -Math.PI / 2; road.position.set(0, 0.02, 55); road.receiveShadow = true; this.scene.add(road);
    const kerb = new THREE.MeshStandardMaterial({ color: "#a8a398", roughness: 0.8 });
    for (const zz of [49.4, 60.6]) { const k = new THREE.Mesh(new THREE.BoxGeometry(500, 0.16, 0.5), kerb); k.position.set(0, 0.08, zz); k.receiveShadow = true; this.scene.add(k); }
    // passage piéton
    const zebra = new THREE.MeshStandardMaterial({ color: "#eeeae0", roughness: 0.6 });
    for (let i = -4; i <= 4; i++) { const s = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 9), zebra); s.rotation.x = -Math.PI / 2; s.position.set(i * 1.2, 0.03, 55); this.scene.add(s); }
    // arbres le long du trottoir
    const trunk = new THREE.MeshStandardMaterial({ color: "#4a3a2c", roughness: 0.9 }), leaf = new THREE.MeshStandardMaterial({ color: "#5d7a3a", roughness: 0.85 });
    const nt = q === "low" ? 6 : 14;
    for (let i = 0; i < nt; i++) {
      const x = -45 + (i % (nt / 2)) * (90 / (nt / 2 - 1)), zz = i < nt / 2 ? 46.5 : 63.5, h = 4.2 + rnd() * 1.2;
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, h, 8), trunk); tr.position.set(x, h / 2, zz); tr.castShadow = true; this.scene.add(tr);
      for (let k = 0; k < 3; k++) { const f = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5 + rnd() * 0.6, 1), leaf); f.position.set(x + (rnd() - 0.5) * 1.4, h + 0.6 + k * 0.6, zz + (rnd() - 0.5) * 1.4); f.castShadow = true; this.scene.add(f); }
    }
    // voitures : deux files, en mouvement continu ; deux voitures garées devant la banque
    const colors = ["#16181d", "#d8d6d0", "#7a1d2b", "#1f3a5f", "#c8a43a", "#2c2f36", "#9aa3ad", "#0e0f12"];
    const nc = q === "low" ? 4 : 9;
    for (let i = 0; i < nc; i++) { const lane = i % 2, dir = lane ? -1 : 1; const g = this.makeCar(colors[i % colors.length], i === 3); g.position.set(0, 0.02, lane ? 57.8 : 52.3); g.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2; this.scene.add(g); this.cars.push({ g, lane, x0: -90 + (i * 180) / nc + rnd() * 6, v: 7 + rnd() * 4, dir }); }
    for (const [x, z, c] of [[-13.5, 16.5, "#0e0f12"], [14.5, 19.5, "#17191e"]] as [number, number, string][]) { const g = this.makeCar(c, false); g.position.set(x, 0, z); g.rotation.y = Math.PI / 2; this.scene.add(g); }
  }
  private makeCar(color: string, taxi: boolean) {
    const g = new THREE.Group();
    const paint = new THREE.MeshPhysicalMaterial({ color: taxi ? "#e4b72b" : color, metalness: 0.6, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08 });
    const glass = new THREE.MeshPhysicalMaterial({ color: "#10161d", metalness: 0.9, roughness: 0.05 });
    const body = new THREE.Mesh(new RoundedBoxGeometry(1.85, 0.62, 4.5, 3, 0.18), paint); body.position.y = 0.62; body.castShadow = true; g.add(body);
    const cab = new THREE.Mesh(new RoundedBoxGeometry(1.62, 0.55, 2.3, 3, 0.2), glass); cab.position.set(0, 1.15, -0.1); cab.castShadow = true; g.add(cab);
    const wm = new THREE.MeshStandardMaterial({ color: "#101010", roughness: 0.7 });
    for (const [x, z] of [[-0.9, 1.4], [0.9, 1.4], [-0.9, -1.4], [0.9, -1.4]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.26, 16), wm); w.rotation.z = Math.PI / 2; w.position.set(x, 0.34, z); g.add(w); }
    const head = new THREE.MeshBasicMaterial({ color: "#fff4d8" }), tail = new THREE.MeshBasicMaterial({ color: "#ff2a2a" });
    for (const x of [-0.65, 0.65]) { const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.05), head); h.position.set(x, 0.7, 2.27); g.add(h); const r = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.05), tail); r.position.set(x, 0.72, -2.27); g.add(r); }
    if (taxi) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.22), new THREE.MeshBasicMaterial({ color: "#fff1b0" })); s.position.set(0, 1.5, -0.1); g.add(s); }
    return g;
  }
  private buildCrowd() {
    const q = this.quality, looks: Partial<Avatar>[] = [
      { skin: 2, hair: 1, hairColor: 0, suit: 1, tie: 2, beard: 0 }, { skin: 4, hair: 0, hairColor: 0, suit: 2, tie: 0, beard: 3, glasses: 2 },
      { skin: 0, hair: 3, hairColor: 3, suit: 0, tie: 4, build: 0 }, { skin: 3, hair: 5, hairColor: 2, suit: 1, tie: 5, beard: 1, height: 2 },
      { skin: 1, hair: 3, hairColor: 2, suit: 3, tie: 3, glasses: 0, build: 0 }, { skin: 2, hair: 0, hairColor: 1, suit: 2, tie: 1 },
    ];
    const add = (i: number, a: V3, b: V3, v: number, wait: number, phase: number, yaw?: number) => {
      const rig = new RigSlot({ ...defaultAvatar(), ...looks[i % looks.length], build: looks[i % looks.length].build ?? 1, height: looks[i % looks.length].height ?? 1 }); this.scene.add(rig.root);
      this.walkers.push({ rig, a, b, v, wait, phase, yaw: yaw ?? 0, moving: false });
    };
    const still = (i: number, x: number, z: number, yaw: number) => add(i, v3(x, 0, z), v3(x, 0, z), 0, 0, 0, yaw);
    // dehors : un couple qui discute devant l'entrée, des passants qui arrivent ou repartent, quelqu'un qui traverse la rue
    still(0, -9.4, 19.6, Math.PI / 2); still(1, -8.1, 19.5, -Math.PI / 2);
    add(2, v3(-16, 0, 38), v3(-16, 0, 13), 1.1, 3, 0);
    if (q === "high") { add(3, v3(15.5, 0, 14), v3(15.5, 0, 40), 1.2, 4, 7); add(4, v3(-30, 0, 55), v3(30, 0, 55), 1.3, 6, 2); still(5, 6.6, 24, -2.2); }
    // dedans : accueil, deux collègues qui discutent, deux qui circulent
    const rec = this.bank.receptionist; still(4, rec.x, rec.z, Math.PI);
    still(1, 6.6, 5.8, Math.PI / 2); still(3, 7.8, 5.5, -Math.PI / 2);
    add(2, v3(-14.6, 0, -4.5), v3(-14.6, 0, 5.5), 1.0, 2, 0);
    if (q === "high") { add(0, v3(8.6, 0, 6.2), v3(9, 0, -6.4), 1.15, 5, 31); add(5, v3(-8, 0, -6.4), v3(-5.2, 0, 4.8), 1.05, 4, 35); }
  }

  /* ───────── mise en scène ───────── */
  private buildShots(A: Move, B: Move) {
    const hero = (t: number) => { const p = v3(0, 0, 0); this.heroAt(t, p); return p; };
    const side = (t: number, a: number, d: number, h: number) => { // position relative au personnage : angle (0 = devant, π/2 = côté), distance, hauteur
      const p = hero(t), yaw = this.heroYawAt(t); const f = v3(Math.sin(yaw), 0, Math.cos(yaw)), r = v3(Math.cos(yaw), 0, -Math.sin(yaw));
      return p.clone().addScaledVector(r, -Math.sin(a) * d).addScaledVector(f, Math.cos(a) * d).add(v3(0, h, 0));
    };
    const chest = (t: number, up = 1.35) => hero(t).add(v3(0, up, 0));
    const wob = (t: number, amp = 0.012) => v3(Math.sin(t * 0.7) * amp, Math.sin(t * 0.93 + 1) * amp * 0.7, Math.sin(t * 0.55 + 2) * amp);
    const S = (t0: number, t1: number, f: Shot["f"]) => this.shots.push({ t0, t1, f });
    // 1 — grand plan d'établissement : grue qui descend sur le quartier d'affaires, la banque devient le sujet
    S(0, 7.5, (u, t) => ({ p: mixV(v3(-34, 34, 118), v3(-10, 12.5, 70), smoother(u)).add(wob(t, 0.05)), l: mixV(v3(6, 17, 20), v3(0, 6.5, 12), smoother(u)), fov: mix(40, 33, smoother(u)) }));
    // 2 — approche de la façade, caméra basse et stabilisée, les passants vivent devant
    S(7.5, 16, (u, t) => ({ p: mixV(v3(-4.6, 2.3, 47), v3(-2.2, 1.9, 31), smoother(u)).add(wob(t)), l: mixV(v3(0, 5.4, 8), v3(0, 4.4, 8), smoother(u)), fov: mix(35, 39, smoother(u)) }));
    // 3 — travelling latéral : on tourne doucement autour du personnage qui arrive
    S(16, A.t1 + 1.55, (u, t) => { const a = mix(1.35, 0.55, smoother(u)); return { p: side(t, a, mix(3.9, 3.0, u), mix(1.2, 1.45, u)).add(wob(t, 0.008)), l: chest(t, mix(1.3, 1.5, u)), fov: mix(30, 34, u) }; });
    // 4 — il franchit les portes : caméra derrière lui, puis elle passe le seuil et entre dans le hall
    S(B.t0, 34, (u, t) => { const k = smoother(u); return { p: mixV(v3(-2.6, 2.1, 24), v3(-0.7, 1.8, 7.6), k).add(wob(t, 0.01)), l: chest(t, mix(1.5, 1.55, k)).lerp(v3(0, 2.6, -2), smoother((u - 0.75) / 0.25) * 0.3), fov: mix(36, 48, k) }; });
    // 5 — découverte du hall : la caméra monte et avance doucement pendant un panoramique sur les sept ascenseurs
    S(34, 43, (u, t) => {
      const k = smoother(u);
      const L = u < 0.5 ? mixV(v3(-1, 2.8, -2), v3(-12.5, 4.4, -9.6), smoother(u / 0.5)) : mixV(v3(-12.5, 4.4, -9.6), v3(12.5, 4.4, -9.6), smoother((u - 0.5) / 0.5));
      return { p: mixV(v3(-0.7, 1.8, 7.6), v3(0.4, 3.3, 7.7), k).add(wob(t, 0.01)), l: L, fov: mix(48, 58, Math.sin(u * Math.PI * 0.5)) };
    });
    // 6 — retour sur le personnage (tour de trois quarts), puis la caméra recule et prend la place de la vue de jeu, face aux ascenseurs
    S(43, INTRO_DURATION + 1, (u, t) => {
      const a = smoother(Math.min(1, u / 0.45)), b = smoother(Math.max(0, (u - 0.45) / 0.55));
      const p = side(t, mix(0.7, 0.22, a), mix(3.1, 2.5, a), 1.58), l = chest(t, 1.6);
      return { p: mixV(p, v3(0.5, 2.4, 7.9), b).add(wob(t, 0.008)), l: mixV(l, v3(0, 2.0, -3), b), fov: mix(mix(36, 32, a), 56, b) };
    });
  }
  /** Position (et cap) du personnage à l'instant t */
  private heroAt(t: number, out: V3) {
    const [A, B] = this.moves;
    if (t < A.t0) out.copy(A.pts[0]); else if (t < A.t1) A.at(t, out); else if (t < B.t0) out.copy(A.pts[A.pts.length - 1]); else if (t < B.t1) B.at(t, out); else out.copy(B.pts[B.pts.length - 1]);
    return out;
  }
  private heroYawAt(t: number) {
    const [A, B] = this.moves, tmp = v3(0, 0, 0);
    if (t < A.t1) return A.at(Math.max(A.t0 + 0.01, t), tmp); if (t < B.t0) return A.at(A.t1 - 0.01, tmp); return B.at(Math.min(Math.max(B.t0 + 0.01, t), B.t1 - 0.01), tmp);
  }

  /* ───────── post-traitement ───────── */
  private initComposer() {
    const c = this.o.canvas, w = c.clientWidth || 800, h = c.clientHeight || 450;
    const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: this.quality === "high" ? 2 : 0 });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.22, 0.55, 0.9));
    this.composer.addPass(new OutputPass());
    // étalonnage : contraste doux en S, teintes chaudes dehors / dorées dedans, vignettage léger et grain de pellicule
    this.grade = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, time: { value: 0 }, warm: { value: 1 } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: `uniform sampler2D tDiffuse; uniform float time; uniform float warm; varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + time) * 43758.5453); }
        void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; vec3 s = c*c*(3.0-2.0*c); c = mix(c, s, 0.22);
          float l = dot(c, vec3(0.299,0.587,0.114)); c = mix(vec3(l), c, 1.06);
          c *= mix(vec3(1.0,1.02,1.05), vec3(1.06,1.0,0.9), warm * 0.6 + 0.2);
          vec2 q = vUv - 0.5; c *= 1.0 - dot(q, q) * 0.55; c += (h(vUv * 1000.0) - 0.5) * 0.022; gl_FragColor = vec4(c, 1.0); }`,
    });
    this.composer.addPass(this.grade);
  }
  resize() {
    const c = this.o.canvas, w = Math.max(2, c.clientWidth), h = Math.max(2, c.clientHeight);
    this.renderer.setSize(w, h, false); this.composer?.setSize(w, h);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  /* ───────── commandes ───────── */
  /** Le personnage est-il chargé ? (sinon l'avatar de secours est affiché) */
  get qualityNow() { return `${this.quality}${this.composer ? "+post" : ""}${this.scene.environment ? "+env" : ""}`; }
  get heroReady() { return !!this.hero.character && this.walkers.every((w) => !!w.rig.character); }
  start() {
    if (this.playing) return; this.playing = true; this.last = performance.now();
    this.audio.start(this.muted); this.audio.setSection("intro");
    cancelAnimationFrame(this.raf); this.raf = requestAnimationFrame(this.tick);
  }
  /** Rendu de l'image fixe avant le départ (écran de chargement) */
  preview() { if (!this.playing) { this.update(0); try { this.renderer.compile(this.scene, this.camera); } catch { /* */ } this.draw(0.016); } }
  setMuted(m: boolean) { this.muted = m; this.audio.setMuted(m); }
  seek(t: number) { this.t = Math.max(0, Math.min(INTRO_DURATION, t)); this.shotIdx = -1; this.heroAt(this.t - 0.03, this.lastHeroPos); this.update(0.03); this.draw(0.03); }
  skip() { if (!this.ended) { this.ended = true; this.audio.fadeOut(0.6); this.o.onEnd?.(); } }
  dispose() {
    this.disposed = true; cancelAnimationFrame(this.raf); this.audio.dispose();
    this.hero.dispose(); this.walkers.forEach((w) => w.rig.dispose()); this.bank.dispose();
    this.scene.traverse((ob) => { const m = ob as THREE.Mesh; if (m.isMesh) { m.geometry?.dispose(); const mm = m.material as THREE.Material | THREE.Material[]; (Array.isArray(mm) ? mm : [mm]).forEach((x) => { (x as THREE.MeshStandardMaterial).map?.dispose?.(); x.dispose(); }); } });
    this.composer?.dispose(); this.renderer.dispose(); this.renderer.forceContextLoss();
    delete (window as unknown as { __intro?: unknown }).__intro;
  }

  /* ───────── boucle ───────── */
  private tick = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.tick);
    const dt = Math.min(0.1, (now - this.last) / 1000); this.last = now;
    if (document.hidden) return;
    if (!this.ended) this.t += dt;
    this.update(dt); this.draw(dt); this.adapt(dt);
    this.o.onFrame?.(this.t);
    if (this.t >= INTRO_DURATION && !this.ended) { this.ended = true; this.o.onEnd?.(); }
  };
  private draw(dt: number) {
    if (this.grade) { this.grade.uniforms.time.value = (this.grade.uniforms.time.value + dt) % 100; this.grade.uniforms.warm.value = this.ext; }
    if (this.composer) this.composer.render(dt); else this.renderer.render(this.scene, this.camera);
  }
  private update(dt: number) {
    const t = this.t;
    // personnage principal
    this.heroAt(t, this.heroPos);
    const moving = t > this.moves[0].t0 && t < this.moves[0].t1 + 0 || (t > this.moves[1].t0 && t < this.moves[1].t1);
    const inB = t >= this.moves[0].t1 && t < this.moves[1].t0;
    const targetYaw = moving ? this.heroYawAt(t) : inB ? this.heroYawAt(t) : Math.PI;
    this.heroYaw += angDiff(this.heroYaw, targetYaw) * Math.min(1, dt * 8 + (dt === 0 ? 1 : 0));
    const speed = dt > 0 ? this.heroPos.distanceTo(this.lastHeroPos) / dt : 0;
    this.stepAcc += this.heroPos.distanceTo(this.lastHeroPos);
    if (this.stepAcc > 0.74) { this.stepAcc = 0; if (this.playing && speed > 0.3) this.audio.step(this.heroPos.z < HALL.zFront, 1); }
    this.lastHeroPos.copy(this.heroPos);
    this.heroWalk += ((speed > 0.1 ? 1 : 0) - this.heroWalk) * Math.min(1, dt * 8);
    const turnRate = dt > 0 ? angDiff(this.prevYaw, this.heroYaw) / dt : 0; this.prevYaw = this.heroYaw;
    this.hero.root.position.copy(this.heroPos); this.hero.root.rotation.y = this.heroYaw;
    this.hero.update(dt, this.heroWalk, { speed: Math.min(speed, 3), turnRate });
    const ch = this.hero.character;
    if (ch) {
      // regards : l'enseigne, puis le hall de gauche à droite, enfin la caméra
      const g = this.gaze(t); ch.lookAt(g);
      ch.setExpression(t > 45.5 && t < 49.5 ? "smile" : "neutral");
    }
    // portes automatiques : elles réagissent à la position du personnage ; elles se referment derrière lui
    const ctrl = t > this.moves[1].t1 + 0.8 ? v3(0, 0, 0) : this.heroPos;
    this.bank.update(dt, ctrl);
    const wantOpen = this.heroPos.z < HALL.zFront + 9 && this.heroPos.z > HALL.zFront - 4 && t > this.moves[1].t0 && t < this.moves[1].t1 + 0.8;
    if (wantOpen && !this.doorOpen) { this.doorOpen = true; if (this.playing) this.audio.door(true); }
    if (!wantOpen && this.doorOpen && !this.doorClosed && t > this.moves[1].t1) { this.doorClosed = true; if (this.playing) this.audio.door(false); }
    // figurants
    for (const w of this.walkers) this.stepWalker(w, t, dt);
    // voitures
    for (const c of this.cars) { const x = ((c.x0 + c.dir * c.v * t + 90) % 180 + 180) % 180 - 90; c.g.position.x = x; }
    // caméra
    this.directCamera(t, dt);
    // lumière : le soleil s'efface quand la caméra entre, les lampes du hall prennent le relais
    const inside = sstep(9.2, 5.2, this.camPos.z); this.ext = 1 - inside;
    this.key.position.copy(this.camPos).add(v3(0.6, 0.9, 0)); this.key.intensity = 14 * inside;
    this.sun.intensity = 3.4 * (1 - inside); this.hemi.intensity = mix(1.5, 0.22, inside);
    this.renderer.toneMappingExposure = mix(1.1, 1.05, inside);
    if (this.scene.environment) this.scene.environmentIntensity = mix(1, 0.3, inside);
    this.fog.far = mix(520, 3000, inside); this.fog.near = mix(110, 400, inside);
    if (this.playing) {
      this.audio.setOutdoor(1 - inside);
      const s: Section = t < 7.5 ? "intro" : t < 16 ? "approach" : t < 33 ? "arrival" : t < 45 ? "hall" : "end";
      if (s !== this.section) { this.section = s; this.audio.setSection(s); }
    }
  }
  private gaze(t: number): V3 | null {
    if (t > 22.5 && t < 24.6) return v3(0, 7.4, 9); // lève les yeux vers l'enseigne
    if (t > 34.4 && t < 36.4) return v3(-10, 3.2, -2);
    if (t > 36.4 && t < 39) return v3(10, 3.4, -2);
    if (t > 39 && t < 42) return v3(0, 3.6, -9);
    if (t > 44.2 && t < 47.8) return this.camPos.clone();
    return null;
  }
  private stepWalker(w: Walker, t: number, dt: number) {
    const L = w.a.distanceTo(w.b);
    if (w.v <= 0 || L < 0.01) { w.rig.root.position.copy(w.a); w.rig.root.rotation.y = w.yaw; w.rig.update(dt, 0); w.moving = false; return; }
    const leg = L / w.v, P = 2 * (leg + w.wait), tau = ((t + w.phase) % P + P) % P;
    let f: number, dir: number, mv = true;
    if (tau < leg) { f = tau / leg; dir = 1; } else if (tau < leg + w.wait) { f = 1; dir = 1; mv = false; } else if (tau < 2 * leg + w.wait) { f = 1 - (tau - leg - w.wait) / leg; dir = -1; } else { f = 0; dir = -1; mv = false; }
    // accélération et arrêt progressifs aux extrémités
    const e = sstep(0, 0.06, mv ? (dir > 0 ? f : 1 - f) : 1) * (mv ? sstep(0, 0.06, dir > 0 ? 1 - f : f) : 1);
    w.rig.root.position.lerpVectors(w.a, w.b, f);
    const want = Math.atan2((w.b.x - w.a.x) * dir, (w.b.z - w.a.z) * dir); w.yaw += angDiff(w.yaw, want) * Math.min(1, dt * 6 + (dt === 0 ? 1 : 0)); w.rig.root.rotation.y = w.yaw;
    w.moving = mv; w.rig.update(dt, mv ? 1 : 0, { speed: mv ? w.v * e : 0 });
  }
  private directCamera(t: number, dt: number) {
    let idx = this.shots.findIndex((s) => t >= s.t0 && t < s.t1); if (idx < 0) idx = this.shots.length - 1;
    const s = this.shots[idx], k = s.f((t - s.t0) / (s.t1 - s.t0), t);
    // inertie naturelle dans un même plan ; franche coupure entre deux plans
    const a = idx !== this.shotIdx || dt === 0 ? 1 : 1 - Math.exp(-dt * 5.5);
    this.shotIdx = idx;
    this.camPos.lerp(k.p, a); this.camLook.lerp(k.l, a); this.camFov += (k.fov - this.camFov) * a;
    this.camera.position.copy(this.camPos); this.camera.lookAt(this.camLook);
    if (Math.abs(this.camera.fov - this.camFov) > 0.01) { this.camera.fov = this.camFov; this.camera.updateProjectionMatrix(); }
    // plan serré sur un téléphone en portrait : on rétrécit le champ horizontal pour garder le sujet à l'écran
    if (this.camera.aspect < 0.9) { const f = Math.min(1.5, 0.9 / this.camera.aspect); const fv = Math.min(70, this.camFov * f); if (Math.abs(this.camera.fov - fv) > 0.01) { this.camera.fov = fv; this.camera.updateProjectionMatrix(); } }
  }
  /** Mesure la fluidité et allège le rendu par paliers tant que l'appareil peine (sous ~30 images/s) */
  private adaptN = 0; private adaptSum = 0; private adaptOk = 0;
  private adapt(dt: number) {
    if (!this.playing || this.debug || this.quality === "low" && !this.composer || this.adaptOk >= 4) return;
    if (++this.adaptN <= 20) return; // on ignore le démarrage (compilation des shaders, chargement)
    this.adaptSum += dt;
    if (this.adaptN - 20 < 25) return;
    const avg = this.adaptSum / 25; this.adaptSum = 0; this.adaptN = 20;
    if (avg <= 0.03) { this.adaptOk++; return; }
    this.adaptOk = 0;
    if (this.quality === "high") {
      this.quality = "medium"; this.bank.disableMirror(); this.renderer.setPixelRatio(1);
      this.sun.shadow.map?.dispose(); this.sun.shadow.map = null; this.sun.shadow.mapSize.set(1024, 1024); this.resize();
    } else if (this.quality === "medium") {
      this.quality = "low"; this.composer?.dispose(); this.composer = undefined; this.grade = undefined; this.renderer.setPixelRatio(1); this.resize();
    }
  }
}

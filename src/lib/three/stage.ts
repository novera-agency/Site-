import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { type Avatar, defaultAvatar } from "@/engine/avatar";
import { RigSlot } from "./rigslot";
import type { GestureId } from "./character/animator";
import { buildBank, buildTailor, skyMesh, DOOR_X, DOOR_Z, ENTRY, EL, HALL, OBSTACLES, type BankWorld } from "./world";

export interface StageRoom { id: string; slot: number; locked?: boolean; label?: string; sub?: string; icon?: string; hint?: string }
export interface LabelPoint { id: string; x: number; y: number; visible: boolean }
export type View = "full" | "threeQuarter" | "front" | "profile" | "back" | "bust" | "portrait";
/** ancien nom (onglets de personnalisation) */
export type Focus = "body" | "bust" | "face";
const FOCUS_VIEW: Record<Focus, View> = { body: "full", bust: "bust", face: "portrait" };
const VIEWS: Record<View, { az: number; r: number; ty: number; cy: number; fov: number }> = {
  full: { az: 0.35, r: 4.2, ty: 1.15, cy: 1.55, fov: 44 }, threeQuarter: { az: 0.65, r: 3.1, ty: 1.12, cy: 1.5, fov: 44 },
  front: { az: 0, r: 3.3, ty: 1.12, cy: 1.5, fov: 44 }, profile: { az: Math.PI / 2, r: 3.3, ty: 1.12, cy: 1.5, fov: 44 }, back: { az: Math.PI, r: 3.3, ty: 1.12, cy: 1.5, fov: 44 },
  bust: { az: 0.2, r: 1.9, ty: 1.62, cy: 1.7, fov: 42 }, portrait: { az: 0.12, r: 0.95, ty: 1.92, cy: 1.94, fov: 36 },
};
export interface StageOptions {
  canvas: HTMLCanvasElement;
  mode: "lobby" | "tailor";
  avatar: Avatar;
  rooms?: StageRoom[];
  /** Séquence d'arrivée depuis la rue (sinon, le personnage est déjà dans le hall) */
  arrival?: boolean;
  reduced?: boolean;
  focus?: Focus;
  view?: View;
  onArrived?: () => void;
  onWalkEnd?: (roomId: string) => void;
  onLabels?: (pts: LabelPoint[]) => void;
}

type Step = { k: "walk"; pts: THREE.Vector3[] } | { k: "door"; slot: number; open: number } | { k: "wait"; s: number } | { k: "face"; yaw: number } | { k: "call"; fn: () => void };
/** Qualité de départ : `?q=high|medium|low` pour forcer ; les navigateurs pilotés par des tests partent en « low » */
function pickQuality(): "high" | "medium" | "low" {
  try {
    const q = new URLSearchParams(window.location.search).get("q") ?? localStorage.getItem("fe_q");
    if (q === "high" || q === "medium" || q === "low") return q;
  } catch { /* */ }
  if (navigator.webdriver) return "low";
  if (/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)) return "medium";
  return "high";
}
const clamp01 = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const SPEED = 2.6;
const TAU = Math.PI * 2;
const angDiff = (a: number, b: number) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };

/** Contourne les obstacles circulaires (globe, accueil, salon) sur un trajet rectiligne */
function route(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[] {
  let pts = [from.clone(), to.clone()];
  for (let pass = 0; pass < 3; pass++) {
    const next: THREE.Vector3[] = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      let added = false;
      for (const o of OBSTACLES) {
        const R = o.r + 0.5, dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1;
        const t = Math.max(0, Math.min(1, ((o.x - a.x) * dx + (o.z - a.z) * dz) / L2));
        const px = a.x + dx * t, pz = a.z + dz * t, d = Math.hypot(px - o.x, pz - o.z);
        if (d < R - 0.05) {
          let nx = px - o.x, nz = pz - o.z; const nl = Math.hypot(nx, nz);
          if (nl < 0.05) { nx = -dz; nz = dx; }
          const ln = Math.hypot(nx, nz) || 1;
          next.push(new THREE.Vector3(o.x + (nx / ln) * (R + 0.4), 0, o.z + (nz / ln) * (R + 0.4)));
          added = true; break;
        }
      }
      void added;
      next.push(b);
    }
    pts = next;
  }
  return pts.slice(1);
}

export class Stage {
  private o: StageOptions;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private rig: RigSlot;
  private pos = new THREE.Vector3();
  private yaw = 0;
  private path: THREE.Vector3[] = [];
  /** Séquence d'actions (marcher, ouvrir une porte, attendre, se tourner, appeler une fonction) */
  private steps: Step[] = [];
  private wait = 0;
  private turn: number | null = null;
  private inElev: number | null = null;
  private routeTo: THREE.Vector3 | null = null;
  private panX = 0; private panTarget = 0;
  private lobbyDrag: { x: number; moved: boolean } | null = null;
  private walk = 0;
  private bank?: BankWorld;
  private tailor?: { dispose(): void };
  private npcs: { rig: RigSlot; a: THREE.Vector3; b: THREE.Vector3; t: number; dir: number; wait: number; speed: number; yaw: number }[] = [];
  private composer?: EffectComposer;
  private bloom?: UnrealBloomPass;
  private quality: "high" | "medium" | "low" = "high";
  private prevYaw = 0;
  private frames = 0; private frameSum = 0;
  private raf = 0;
  private last = 0;
  private visible = true;
  private io?: IntersectionObserver;
  private camPos = new THREE.Vector3();
  private camLook = new THREE.Vector3();
  private overview = false;
  private arrivalDone = false;
  private orbit = { ang: 0.22, drag: false, lastX: 0, r: 4.2, ty: 0.95, cy: 1.4 };
  private viewKey: View = "full";
  private cam = { az: 0.35, r: 4.2, ty: 1.15, cy: 1.55, fov: 44 };
  private zoomK = 1;
  private auto = true;
  private chair?: THREE.Group;
  private pointers = new Map<number, number>(); private pinch0 = 0;
  private lblT = 0;
  private disposed = false;
  private rooms: StageRoom[];
  private onDown?: (e: PointerEvent) => void; private onMove?: (e: PointerEvent) => void; private onUp?: () => void;

  constructor(o: StageOptions) {
    this.o = o; this.rooms = o.rooms ?? []; this.viewKey = o.view ?? (o.focus ? FOCUS_VIEW[o.focus] : "full"); Object.assign(this.cam, VIEWS[this.viewKey]);
    const { canvas } = o;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 0.9;
    this.camera = new THREE.PerspectiveCamera(48, 1.6, 0.1, 600);
    this.quality = pickQuality();
    if (this.quality === "low") { this.renderer.setPixelRatio(1); this.renderer.shadowMap.type = THREE.PCFShadowMap; }
    else {
      // reflets réalistes (métaux, marbre, verre) grâce à un environnement d'éclairage de studio
      const pm = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; this.scene.environmentIntensity = o.mode === "tailor" ? 0.22 : 0.4; pm.dispose();
    }
    this.scene.fog = new THREE.Fog(o.mode === "lobby" ? "#2a2540" : "#1b1420", o.mode === "lobby" ? 70 : 20, o.mode === "lobby" ? 230 : 40);

    this.rig = new RigSlot(o.avatar); this.scene.add(this.rig.root);
    if (o.mode === "lobby") { this.initLobby(); this.initLobbyInput(); } else this.initTailor();
    if (this.quality !== "low") this.initComposer();
    this.resize();
    this.camPos.copy(this.camera.position);
    this.io = new IntersectionObserver((e) => { this.visible = e[0]?.isIntersecting ?? true; });
    this.io.observe(canvas);
    this.raf = requestAnimationFrame(this.tick);
  }

  /* ───────── initialisation des deux scènes ───────── */
  private initLobby() {
    this.scene.background = null;
    this.scene.add(skyMesh());
    this.scene.add(new THREE.HemisphereLight("#ffeccd", "#3a3248", 1.05));
    const sun = new THREE.DirectionalLight("#ffd8a8", 1.6); sun.position.set(14, 24, 26); sun.castShadow = true;
    sun.shadow.mapSize.set(this.quality === "low" ? 1024 : 4096, this.quality === "low" ? 1024 : 4096); const sc = sun.shadow.camera; sc.left = -24; sc.right = 24; sc.top = 24; sc.bottom = -24; sc.near = 1; sc.far = 90; sun.shadow.bias = -0.0004;
    this.scene.add(sun);
    this.bank = buildBank(this.scene, { reflect: this.quality === "high" }); this.applyPlaques();
    // collègues qui circulent et réceptionniste
    const looks: Partial<Avatar>[] = [
      { skin: 2, hair: 1, hairColor: 0, suit: 1, tie: 2, beard: 0 }, { skin: 4, hair: 0, hairColor: 0, suit: 2, tie: 0, beard: 3, glasses: 2 },
      { skin: 0, hair: 3, hairColor: 3, suit: 0, tie: 4, build: 0 }, { skin: 3, hair: 5, hairColor: 2, suit: 1, tie: 5, beard: 1, height: 2 },
    ];
    const lanes: [number, number, number, number][] = [[-14.6, -4.5, -14.6, 5.5], [14.6, -4.5, 14.6, 5.5]];
    const still: [number, number, number][] = [[6.6, 5.8, Math.PI / 2], [7.8, 5.5, -Math.PI / 2]]; // deux collègues qui discutent
    looks.forEach((l, i) => {
      const rig = new RigSlot({ ...defaultAvatar(), ...l, build: l.build ?? 1, height: l.height ?? 1 }); this.scene.add(rig.root);
      if (i < 2) { const [ax, az, bx, bz] = lanes[i]; this.npcs.push({ rig, a: new THREE.Vector3(ax, 0, az), b: new THREE.Vector3(bx, 0, bz), t: i * 0.4, dir: 1, wait: 0, speed: 1.0 + i * 0.15, yaw: 0 }); }
      else { const [sx, sz, sy] = still[i - 2]; rig.root.position.set(sx, 0, sz); rig.root.rotation.y = sy; this.npcs.push({ rig, a: new THREE.Vector3(sx, 0, sz), b: new THREE.Vector3(sx, 0, sz), t: 0, dir: 1, wait: 0, speed: 0, yaw: sy }); }
    });
    const rec = new RigSlot({ ...defaultAvatar(), skin: 1, hair: 3, hairColor: 2, suit: 3, tie: 3, glasses: 0, build: 0 }); rec.root.position.copy(this.bank.receptionist); rec.root.rotation.y = Math.PI; this.scene.add(rec.root);
    this.npcs.push({ rig: rec, a: this.bank.receptionist.clone(), b: this.bank.receptionist.clone(), t: 0, dir: 1, wait: 0, speed: 0, yaw: Math.PI });
    // position de départ
    if (this.o.arrival && !this.o.reduced) {
      this.pos.set(-2.4, 0, 30); this.yaw = Math.PI;
      this.steps = [{ k: "walk", pts: [new THREE.Vector3(0, 0, 16), new THREE.Vector3(0, 0, HALL.zFront + 3), new THREE.Vector3(0, 0, ENTRY.z)] }, { k: "call", fn: () => { this.arrivalDone = true; this.bank!.front.visible = false; this.overview = true; this.o.onArrived?.(); } }];
      this.camera.position.set(-0.5, 1.5, 36); this.camLook.set(-2.4, 1.4, 28);
    } else { this.pos.set(ENTRY.x, 0, ENTRY.z); this.yaw = Math.PI; this.arrivalDone = true; this.bank.front.visible = false; this.overview = true; this.camera.position.set(0, 4.6, 10.4); this.camLook.set(0, 2.6, -4.5); setTimeout(() => this.o.onArrived?.(), 0); }
  }
  private initLobbyInput() {
    const c = this.o.canvas;
    c.style.touchAction = "pan-y";
    c.addEventListener("pointerdown", (e) => { this.lobbyDrag = { x: e.clientX, moved: false }; c.setPointerCapture?.(e.pointerId); });
    c.addEventListener("pointermove", (e) => {
      if (!this.lobbyDrag) return;
      const dx = e.clientX - this.lobbyDrag.x; if (Math.abs(dx) > 3) this.lobbyDrag.moved = true;
      this.lobbyDrag.x = e.clientX;
      const lim = this.camera.aspect < 0.9 ? 10.5 : 2.5;
      this.panTarget = Math.max(-lim, Math.min(lim, this.panTarget - dx * 0.045));
    });
    const up = () => { this.lobbyDrag = null; };
    c.addEventListener("pointerup", up); c.addEventListener("pointercancel", up);
  }
  /** Fait défiler la vue du hall vers la gauche (-1) ou la droite (1) (boutons, clavier) */
  pan(dir: number) { const lim = this.camera.aspect < 0.9 ? 10.5 : 2.5; this.panTarget = Math.max(-lim, Math.min(lim, this.panTarget + dir * 4.5)); }
  private initTailor() {
    this.scene.background = new THREE.Color("#14101a");
    // éclairage de studio : lumière principale douce, remplissage discret, contre-jour pour détacher la silhouette
    this.scene.add(new THREE.HemisphereLight("#fff0e0", "#2b2436", 0.3));
    const key = new THREE.DirectionalLight("#fff2e0", 2.1); key.position.set(2.6, 4.4, 4.2); key.castShadow = true;
    key.shadow.mapSize.set(this.quality === "low" ? 1024 : 2048, this.quality === "low" ? 1024 : 2048); const kc = key.shadow.camera; kc.left = -2.2; kc.right = 2.2; kc.top = 3; kc.bottom = -1; kc.near = 1; kc.far = 14; key.shadow.bias = -0.0003; key.shadow.normalBias = 0.02; key.shadow.radius = 5;
    this.scene.add(key);
    const fill = new THREE.DirectionalLight("#d6e4ff", 0.45); fill.position.set(-4.5, 2.5, 3.5); this.scene.add(fill);
    const rim = new THREE.DirectionalLight("#ffd9b0", 1.5); rim.position.set(-3, 3.8, -4.5); this.scene.add(rim);
    const rim2 = new THREE.DirectionalLight("#b9d0ff", 0.9); rim2.position.set(4, 3, -4); this.scene.add(rim2);
    this.tailor = buildTailor(this.scene);
    this.pos.set(0, 0.22, 0);
    // ombre de contact douce sous les chaussures
    const cv = document.createElement("canvas"); cv.width = cv.height = 128; const cx = cv.getContext("2d")!; const gr = cx.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, "rgba(0,0,0,0.55)"); gr.addColorStop(1, "rgba(0,0,0,0)"); cx.fillStyle = gr; cx.fillRect(0, 0, 128, 128);
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false })); blob.rotation.x = -Math.PI / 2; blob.position.set(0, 0.224, 0); this.scene.add(blob);
    // chaise (visible quand le personnage s'assoit)
    const chair = new THREE.Group(); const wood = new THREE.MeshStandardMaterial({ color: "#2a1c14", roughness: 0.45, metalness: 0.1 }), leather = new THREE.MeshStandardMaterial({ color: "#3a2630", roughness: 0.5 });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.48), leather); seat.position.set(0, 0.44, -0.12); seat.castShadow = true; chair.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.05), leather); back.position.set(0, 0.74, -0.36); back.castShadow = true; chair.add(back);
    for (const [x, z] of [[-0.21, -0.32], [0.21, -0.32], [-0.21, 0.08], [0.21, 0.08]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.016, 0.44, 10), wood); l.position.set(x, 0.22, z); l.castShadow = true; chair.add(l); }
    chair.position.y = 0.22; chair.visible = false; this.scene.add(chair); this.chair = chair;
    this.camera.position.set(0, 1.4, 4.2); this.camLook.set(0, 0.95, 0);
    const c = this.o.canvas;
    c.style.touchAction = "pan-y";
    this.onDown = (e) => { this.orbit.drag = true; this.orbit.lastX = e.clientX; this.auto = false; this.pointers.set(e.pointerId, e.clientX); c.setPointerCapture?.(e.pointerId); if (this.pointers.size === 2) this.pinch0 = 0; };
    this.onMove = (e) => {
      if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, e.clientX);
      if (this.pointers.size === 2) { // pincement : zoom progressif
        const [x, y] = [...this.pointers.values()]; const d = Math.abs(x - y);
        if (this.pinch0 > 0) this.zoomK = clamp01(this.zoomK * (this.pinch0 / Math.max(d, 1)), 0.5, 1.6);
        this.pinch0 = d; return;
      }
      if (!this.orbit.drag) return; this.cam.az -= (e.clientX - this.orbit.lastX) * 0.012; this.orbit.lastX = e.clientX;
    };
    this.onUp = (e?: PointerEvent) => { if (e) this.pointers.delete(e.pointerId); else this.pointers.clear(); this.orbit.drag = this.pointers.size > 0; this.pinch0 = 0; };
    c.addEventListener("pointerdown", this.onDown); c.addEventListener("pointermove", this.onMove); c.addEventListener("pointerup", this.onUp as EventListener); c.addEventListener("pointercancel", this.onUp as EventListener);
    this.onWheel = (e: WheelEvent) => { e.preventDefault(); this.zoomK = clamp01(this.zoomK * (1 + Math.sign(e.deltaY) * 0.08), 0.5, 1.6); this.auto = false; };
    c.addEventListener("wheel", this.onWheel, { passive: false });
    c.addEventListener("dblclick", () => { this.zoomK = 1; this.cam.az = VIEWS[this.viewKey].az; });
  }
  private onWheel?: (e: WheelEvent) => void;
  private initComposer() {
    const c = this.o.canvas, w = c.clientWidth || 800, h = c.clientHeight || 500;
    const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), this.o.mode === "lobby" ? 0.14 : 0.08, 0.5, 0.94);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }
  /** Mesure la fluidité et allège le rendu si l'appareil peine (reflets, flou lumineux, puis post-traitement) */
  private adapt(dt: number) {
    if (this.frames >= 90) return;
    this.frames++; if (this.frames > 10) this.frameSum += dt;
    if (this.frames === 40 || this.frames === 90) {
      const avg = this.frameSum / Math.max(1, this.frames - 10);
      if (avg > 0.04 && this.quality === "high") { this.quality = "medium"; this.bank?.disableMirror(); this.frameSum = 0; this.frames = 41; }
      else if (avg > 0.06 && this.quality !== "low") { this.quality = "low"; this.bank?.disableMirror(); this.composer = undefined; this.renderer.setPixelRatio(1); this.resize(); this.frames = 90; }
    }
  }

  /* ───────── API ───────── */
  setAvatar(a: Avatar) {
    this.rig.setAvatar(a);
  }
  setFocus(f: Focus) { this.setView(FOCUS_VIEW[f]); }
  setView(v: View) { this.viewKey = v; this.auto = false; this.zoomK = 1; }
  /** Gestes, assise, regard et expressions (atelier du tailleur) */
  play(id: GestureId) { this.rig.character?.gesture(id); }
  setSit(on: boolean) { this.rig.character?.sit(on); }
  lookAtCamera(on: boolean) { this.rig.character?.lookAt(on ? this.camera.position : null); }
  setExpression(e: "neutral" | "smile" | "surprise" | "focus" | "displeased") { this.rig.character?.setExpression(e); }
  /** Aperçu de la marche et de la course sur place (tapis roulant) */
  setTreadmill(speed: number) { this.treadmill = speed; }
  /** Le personnage se retourne vers l'utilisateur (pivot du corps, regard et tête qui anticipent) */
  faceCamera(on: boolean) { this.faceCam = on; this.rig.character?.lookAt(on ? this.camera.position : null); }
  state(): string { return this.rig.character?.animator.state ?? "IDLE"; }
  /** Retour à la pose initiale : geste interrompu, debout, regard libre, vue d'ensemble */
  resetPose() { const c = this.rig.character; c?.animator.stopGesture(); c?.sit(false); this.faceCam = false; this.treadmill = 0; c?.lookAt(null); c?.setExpression("neutral"); this.setView("full"); this.auto = true; }
  setRooms(r: StageRoom[]) { this.rooms = r; this.applyPlaques(); }
  /** Écrit sur chaque enseigne l'icône, le nom et la description de l'option : on sait où mène chaque ascenseur */
  private applyPlaques() { if (!this.bank) return; for (const r of this.rooms) this.bank.setPlaque(r.slot, { icon: r.icon ?? "", label: r.label ?? "", sub: r.sub, hint: r.hint }); }
  highlight(id: string | null) { const r = this.rooms.find((x) => x.id === id); this.bank?.highlight(r ? r.slot : null); }
  resize() {
    const c = this.o.canvas, w = c.clientWidth || 800, h = c.clientHeight || 500;
    this.renderer.setSize(w, h, false); this.composer?.setSize(w, h); this.bloom?.setSize(w, h); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  /** Fait marcher le personnage jusqu'à l'ascenseur de la pièce, puis dedans ; onWalkEnd est rappelé quand les portes sont refermées */
  walkTo(id: string) {
    if (this.o.mode !== "lobby") return;
    const r = this.rooms.find((x) => x.id === id); if (!r || r.locked) return;
    const slot = r.slot, x = DOOR_X[slot], zb = HALL.zBack;
    if (!this.arrivalDone) this.skip();
    const inside = this.inElev;
    if (inside === slot) { this.o.onWalkEnd?.(id); return; }
    if (this.o.reduced) { this.steps = []; this.path = []; if (inside !== null) this.bank?.setDoor(inside, 0); this.inElev = slot; this.pos.set(x, 0, zb - 1.2); this.yaw = 0; this.o.onWalkEnd?.(id); return; }
    this.overview = false; this.path = [];
    const s: Step[] = [];
    if (inside !== null) s.push(...this.exitSteps(inside));
    s.push({ k: "call", fn: () => { this.routeTo = new THREE.Vector3(x, 0, DOOR_Z); } }, { k: "walk", pts: [] },
      { k: "door", slot, open: 1 }, { k: "wait", s: 0.9 },
      { k: "walk", pts: [new THREE.Vector3(x, 0, zb - EL.d + 1.15)] }, { k: "face", yaw: 0 }, { k: "wait", s: 0.35 },
      { k: "door", slot, open: 0 }, { k: "wait", s: 1.1 }, { k: "call", fn: () => { this.inElev = slot; this.o.onWalkEnd?.(id); } });
    this.steps = s;
  }
  private exitSteps(slot: number): Step[] {
    const x = DOOR_X[slot];
    return [{ k: "door", slot, open: 1 }, { k: "wait", s: 0.9 }, { k: "walk", pts: [new THREE.Vector3(x, 0, DOOR_Z + 0.2)] }, { k: "door", slot, open: 0 }, { k: "call", fn: () => { this.inElev = null; } }];
  }
  /** Fait ressortir l'avatar de l'ascenseur (retour au hall) */
  leaveElevator() {
    if (this.inElev === null || this.o.mode !== "lobby") return;
    const slot = this.inElev;
    if (this.o.reduced) { this.bank?.setDoor(slot, 0); this.inElev = null; this.pos.set(DOOR_X[slot], 0, DOOR_Z + 0.2); this.yaw = 0; this.overview = true; return; }
    this.steps = [...this.exitSteps(slot), { k: "call", fn: () => { this.overview = true; } }];
    this.overview = false;
  }
  /** Saute la séquence d'arrivée */
  skip() {
    if (this.arrivalDone || this.o.mode !== "lobby") return;
    this.steps = []; this.path = []; this.pos.set(ENTRY.x, 0, ENTRY.z); this.yaw = Math.PI; this.arrivalDone = true; this.bank!.front.visible = false; this.overview = true; this.o.onArrived?.();
  }
  dispose() {
    this.disposed = true; cancelAnimationFrame(this.raf); this.io?.disconnect();
    const c = this.o.canvas;
    if (this.onDown) c.removeEventListener("pointerdown", this.onDown); if (this.onMove) c.removeEventListener("pointermove", this.onMove);
    if (this.onWheel) c.removeEventListener("wheel", this.onWheel);
    if (this.onUp) { c.removeEventListener("pointerup", this.onUp); c.removeEventListener("pointercancel", this.onUp); }
    this.rig.dispose(); this.npcs.forEach((n) => n.rig.dispose()); this.bank?.dispose(); this.tailor?.dispose();
    this.scene.traverse((ob) => { const m = ob as THREE.Mesh; if (m.isMesh) { m.geometry?.dispose(); const mm = m.material as THREE.Material | THREE.Material[]; (Array.isArray(mm) ? mm : [mm]).forEach((x) => { (x as THREE.MeshStandardMaterial).map?.dispose?.(); x.dispose(); }); } });
    this.renderer.dispose(); this.renderer.forceContextLoss();
  }

  /* ───────── boucle ───────── */
  private tick = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.tick);
    const dt = Math.min(0.05, (now - (this.last || now)) / 1000); this.last = now;
    if (!this.visible || document.hidden) return;
    if (this.o.mode === "lobby") this.stepLobby(dt); else this.stepTailor(dt);
    if (this.composer) this.composer.render(dt); else this.renderer.render(this.scene, this.camera);
    this.adapt(dt);
    this.lblT += dt;
    if (this.lblT > 0.033 && this.o.onLabels && this.bank) { this.lblT = 0; this.emitLabels(); }
  };

  private stepLobby(dt: number) {
    // file d'actions : une à la fois
    let moving = false;
    if (this.wait > 0) this.wait -= dt;
    else if (this.turn !== null) { this.yaw += angDiff(this.yaw, this.turn) * Math.min(1, dt * 7); if (Math.abs(angDiff(this.yaw, this.turn)) < 0.03) { this.yaw = this.turn; this.turn = null; } }
    else if (this.path.length) moving = this.advance(dt);
    else {
      const st = this.steps.shift();
      if (st) {
        if (st.k === "walk") this.path = st.pts.length ? st.pts.map((p) => p.clone()) : this.routeTo ? route(this.pos, this.routeTo) : [];
        else if (st.k === "door") this.bank!.setDoor(st.slot, st.open);
        else if (st.k === "wait") this.wait = st.s;
        else if (st.k === "face") this.turn = st.yaw;
        else st.fn();
      }
    }
    this.walk += ((moving ? 1 : 0) - this.walk) * Math.min(1, dt * 8);
    this.rig.root.position.copy(this.pos); this.rig.root.rotation.y = this.yaw;
    const turnRate = angDiff(this.prevYaw, this.yaw) / Math.max(dt, 1e-3); this.prevYaw = this.yaw;
    this.rig.update(dt, this.walk, { speed: moving ? SPEED : 0, turnRate });
    this.bank!.update(dt, this.pos);
    // collègues
    for (const n of this.npcs) {
      if (n.speed > 0) {
        if (n.wait > 0) { n.wait -= dt; n.rig.update(dt, 0); }
        else {
          n.t += (dt * n.speed * 1.2) / Math.max(1, n.a.distanceTo(n.b)) * n.dir;
          if (n.t > 1 || n.t < 0) { n.t = Math.max(0, Math.min(1, n.t)); n.dir *= -1; n.wait = 2 + Math.random() * 3; }
          const p = n.a.clone().lerp(n.b, n.t); n.rig.root.position.copy(p);
          const want = Math.atan2((n.b.x - n.a.x) * n.dir, (n.b.z - n.a.z) * n.dir); n.yaw += angDiff(n.yaw, want) * Math.min(1, dt * 6); n.rig.root.rotation.y = n.yaw;
          n.rig.update(dt, n.wait > 0 ? 0 : 1, { speed: n.wait > 0 ? 0 : n.speed * 1.2 });
        }
      } else n.rig.update(dt, 0);
    }
    // caméra
    const f = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    let wantPos: THREE.Vector3, wantLook: THREE.Vector3, k = 2.4;
    const aspect = this.camera.aspect, portrait = aspect < 0.9;
    this.panX += (this.panTarget - this.panX) * Math.min(1, dt * 6);
    if (this.overview && !this.path.length && !this.steps.length) {
      wantPos = new THREE.Vector3(this.panX, portrait ? 4.4 : 4.6, portrait ? 11.2 : 10.4); wantLook = new THREE.Vector3(this.panX, 2.6, portrait ? -2 : -4.5); k = 1.6;
      this.camera.fov = portrait ? 68 : 50;
    } else if (this.pos.z < HALL.zBack + 0.8 || (this.inElev !== null && !this.steps.length && !this.path.length)) {
      // dans la cabine, ou devant les portes refermées : plan fixe sur l'ascenseur
      const x = DOOR_X[this.inElev ?? 0] ?? this.pos.x;
      wantPos = new THREE.Vector3(x, 2.4, HALL.zBack + 4.6); wantLook = new THREE.Vector3(x, 1.9, HALL.zBack - 0.5); k = 2.2;
      this.camera.fov = 48;
    } else {
      wantPos = this.pos.clone().addScaledVector(f, -5.2).add(new THREE.Vector3(0, 2.7, 0));
      wantLook = this.pos.clone().addScaledVector(f, 2.2).add(new THREE.Vector3(0, 1.35, 0));
      this.camera.fov = 52;
    }
    // vue de côté légère pour un effet de film pendant l'arrivée
    if (!this.arrivalDone) wantPos.x += Math.sin(now2(this)) * 0.8;
    const a = 1 - Math.exp(-dt * k);
    this.camPos.lerp(wantPos, a); this.camLook.lerp(wantLook, a);
    this.camera.position.copy(this.camPos); this.camera.lookAt(this.camLook); this.camera.updateProjectionMatrix();
    if (!this.arrivalDone && this.path.length === 0 && this.o.reduced) this.skip();
  }

  /** Avance le long du trajet ; renvoie vrai tant que le personnage marche */
  private advance(dt: number): boolean {
    let budget = SPEED * dt;
    while (budget > 0 && this.path.length) {
      const t = this.path[0], dx = t.x - this.pos.x, dz = t.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.02) { this.path.shift(); continue; }
      const st = Math.min(d, budget);
      this.pos.x += (dx / d) * st; this.pos.z += (dz / d) * st; budget -= st;
      const want = Math.atan2(dx, dz); this.yaw += angDiff(this.yaw, want) * Math.min(1, dt * 9);
      if (st === d) this.path.shift();
    }
    return true;
  }

  private stepTailor(dt: number) {
    const V = VIEWS[this.viewKey];
    if (this.auto && !this.o.reduced && !this.orbit.drag) this.cam.az += dt * 0.28;      // présentation d'accueil : légère rotation
    const k = this.o.reduced ? 1 : 1 - Math.exp(-dt * 4.5);
    if (!this.orbit.drag && !this.auto) { let d = (V.az - this.cam.az) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; this.cam.az += d * k * this.snap; }
    this.cam.r += (V.r * this.zoomK - this.cam.r) * k; this.cam.ty += (V.ty - this.cam.ty) * k; this.cam.cy += (V.cy - this.cam.cy) * k; this.cam.fov += (V.fov - this.cam.fov) * k;
    // pivot vers l'utilisateur : le corps tourne progressivement, l'animation de rotation et de pas suit
    const want = this.faceCam ? this.cam.az : 0, dy = angDiff(this.yawT, want), prev = this.yawT;
    this.yawT += dy * Math.min(1, dt * 2.5); const tr = angDiff(prev, this.yawT) / Math.max(dt, 1e-3);
    this.rig.root.position.copy(this.pos); this.rig.root.rotation.y = this.yawT;
    this.rig.update(dt, this.treadmill > 0 ? 1 : 0, { speed: this.treadmill, turnRate: tr });
    const an = this.rig.character?.animator;
    if (this.chair) this.chair.visible = !!an && (an.sitting || an.state === "STAND_UP" || an.state === "INTERACT");
    // jamais à l'intérieur du personnage : distance minimale
    const r = Math.max(0.45, this.cam.r), ang = this.cam.az;
    this.camera.position.set(Math.sin(ang) * r, this.cam.cy, Math.cos(ang) * r);
    this.camera.lookAt(0, this.cam.ty, 0);
    this.camera.fov = this.cam.fov; this.camera.updateProjectionMatrix();
  }
  private snap = 1;
  private treadmill = 0; private faceCam = false; private yawT = 0;
  private emitLabels() {
    const c = this.o.canvas, w = c.clientWidth, h = c.clientHeight, v = new THREE.Vector3();
    const pts: LabelPoint[] = this.rooms.map((r) => {
      v.copy(this.bank!.labelAnchors[r.slot]).project(this.camera);
      return { id: r.id, x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, visible: this.overview && this.arrivalDone && !this.steps.length && v.z < 1 && v.x > -1.05 && v.x < 1.05 && v.y > -1.05 && v.y < 1.05 };
    });
    this.o.onLabels!(pts);
  }
}

const now2 = (s: Stage) => (s as unknown as { last: number }).last / 1500;

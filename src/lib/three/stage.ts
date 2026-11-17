import * as THREE from "three";
import { type Avatar, defaultAvatar } from "@/engine/avatar";
import { buildAvatar, type AvatarRig } from "./avatar3d";
import { buildBank, buildTailor, skyMesh, DOOR_X, DOOR_Z, ENTRY, HALL, OBSTACLES, type BankWorld } from "./world";

export interface StageRoom { id: string; slot: number; locked?: boolean }
export interface LabelPoint { id: string; x: number; y: number; visible: boolean }
export type Focus = "body" | "bust" | "face";
export interface StageOptions {
  canvas: HTMLCanvasElement;
  mode: "lobby" | "tailor";
  avatar: Avatar;
  rooms?: StageRoom[];
  /** Séquence d'arrivée depuis la rue (sinon, le personnage est déjà dans le hall) */
  arrival?: boolean;
  reduced?: boolean;
  focus?: Focus;
  onArrived?: () => void;
  onWalkEnd?: (roomId: string) => void;
  onLabels?: (pts: LabelPoint[]) => void;
}

const SPEED = 3.9;
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
  private rig: AvatarRig;
  private pos = new THREE.Vector3();
  private yaw = 0;
  private path: THREE.Vector3[] = [];
  private pathEnd: (() => void) | null = null;
  private walk = 0;
  private bank?: BankWorld;
  private tailor?: { dispose(): void };
  private npcs: { rig: AvatarRig; a: THREE.Vector3; b: THREE.Vector3; t: number; dir: number; wait: number; speed: number; yaw: number }[] = [];
  private raf = 0;
  private last = 0;
  private visible = true;
  private io?: IntersectionObserver;
  private camPos = new THREE.Vector3();
  private camLook = new THREE.Vector3();
  private overview = false;
  private arrivalDone = false;
  private orbit = { ang: 0.22, drag: false, lastX: 0, r: 4.2, ty: 0.95, cy: 1.4 };
  private focus: Focus = "body";
  private lblT = 0;
  private disposed = false;
  private rooms: StageRoom[];
  private onDown?: (e: PointerEvent) => void; private onMove?: (e: PointerEvent) => void; private onUp?: () => void;

  constructor(o: StageOptions) {
    this.o = o; this.rooms = o.rooms ?? []; if (o.focus) this.focus = o.focus;
    const { canvas } = o;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 0.9;
    this.camera = new THREE.PerspectiveCamera(48, 1.6, 0.1, 600);
    this.scene.fog = new THREE.Fog(o.mode === "lobby" ? "#2a2540" : "#1b1420", o.mode === "lobby" ? 70 : 20, o.mode === "lobby" ? 230 : 40);

    this.rig = buildAvatar(o.avatar); this.scene.add(this.rig.root);
    if (o.mode === "lobby") this.initLobby(); else this.initTailor();
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
    sun.shadow.mapSize.set(2048, 2048); const sc = sun.shadow.camera; sc.left = -24; sc.right = 24; sc.top = 24; sc.bottom = -24; sc.near = 1; sc.far = 90; sun.shadow.bias = -0.0004;
    this.scene.add(sun);
    this.bank = buildBank(this.scene);
    // collègues qui circulent et réceptionniste
    const looks: Partial<Avatar>[] = [
      { skin: 2, hair: 1, hairColor: 0, suit: 1, tie: 2, beard: 0 }, { skin: 4, hair: 0, hairColor: 0, suit: 2, tie: 0, beard: 3, glasses: 2 },
      { skin: 0, hair: 3, hairColor: 3, suit: 0, tie: 4, build: 0 }, { skin: 3, hair: 5, hairColor: 2, suit: 1, tie: 5, beard: 1, height: 2 },
    ];
    const lanes: [number, number, number, number][] = [[-14, 6.6, -6, 6.6], [-6, 6.9, -2.5, 6.9]];
    const still: [number, number, number][] = [[6.6, 5.8, Math.PI / 2], [7.8, 5.5, -Math.PI / 2]]; // deux collègues qui discutent
    looks.forEach((l, i) => {
      const rig = buildAvatar({ ...defaultAvatar(), ...l, build: l.build ?? 1, height: l.height ?? 1 }); this.scene.add(rig.root);
      if (i < 2) { const [ax, az, bx, bz] = lanes[i]; this.npcs.push({ rig, a: new THREE.Vector3(ax, 0, az), b: new THREE.Vector3(bx, 0, bz), t: i * 0.4, dir: 1, wait: 0, speed: 1.0 + i * 0.15, yaw: 0 }); }
      else { const [sx, sz, sy] = still[i - 2]; rig.root.position.set(sx, 0, sz); rig.root.rotation.y = sy; this.npcs.push({ rig, a: new THREE.Vector3(sx, 0, sz), b: new THREE.Vector3(sx, 0, sz), t: 0, dir: 1, wait: 0, speed: 0, yaw: sy }); }
    });
    const rec = buildAvatar({ ...defaultAvatar(), skin: 1, hair: 5, hairColor: 2, suit: 3, tie: 3, glasses: 0, build: 0 }); rec.root.position.copy(this.bank.receptionist); rec.root.rotation.y = Math.PI; this.scene.add(rec.root);
    this.npcs.push({ rig: rec, a: this.bank.receptionist.clone(), b: this.bank.receptionist.clone(), t: 0, dir: 1, wait: 0, speed: 0, yaw: Math.PI });
    // position de départ
    if (this.o.arrival && !this.o.reduced) {
      this.pos.set(-2.4, 0, 30); this.yaw = Math.PI;
      this.path = [new THREE.Vector3(0, 0, 16), new THREE.Vector3(0, 0, HALL.zFront + 3), new THREE.Vector3(0, 0, ENTRY.z)];
      this.pathEnd = () => { this.arrivalDone = true; this.bank!.front.visible = false; this.overview = true; this.o.onArrived?.(); };
      this.camera.position.set(-0.5, 1.5, 36); this.camLook.set(-2.4, 1.4, 28);
    } else { this.pos.set(ENTRY.x, 0, ENTRY.z); this.yaw = Math.PI; this.arrivalDone = true; this.bank.front.visible = false; this.overview = true; this.camera.position.set(0, 6.8, 15.5); this.camLook.set(0, 2.3, -3.5); setTimeout(() => this.o.onArrived?.(), 0); }
  }
  private initTailor() {
    this.scene.background = new THREE.Color("#150f14");
    this.scene.add(new THREE.HemisphereLight("#ffeedd", "#3a2f45", 0.6));
    const key = new THREE.DirectionalLight("#fff1dc", 1.2); key.position.set(3, 6, 5); this.scene.add(key);
    const rim = new THREE.DirectionalLight("#ffd2a0", 0.9); rim.position.set(-4, 4, -5); this.scene.add(rim);
    const fill = new THREE.DirectionalLight("#cfe0ff", 0.4); fill.position.set(-5, 3, 3); this.scene.add(fill);
    this.tailor = buildTailor(this.scene);
    this.pos.set(0, 0.22, 0);
    this.camera.position.set(0, 1.4, 4.2); this.camLook.set(0, 0.95, 0);
    const c = this.o.canvas;
    this.onDown = (e) => { this.orbit.drag = true; this.orbit.lastX = e.clientX; c.setPointerCapture?.(e.pointerId); };
    this.onMove = (e) => { if (!this.orbit.drag) return; this.orbit.ang -= (e.clientX - this.orbit.lastX) * 0.012; this.orbit.lastX = e.clientX; };
    this.onUp = () => { this.orbit.drag = false; };
    c.addEventListener("pointerdown", this.onDown); c.addEventListener("pointermove", this.onMove); c.addEventListener("pointerup", this.onUp); c.addEventListener("pointercancel", this.onUp);
  }

  /* ───────── API ───────── */
  setAvatar(a: Avatar) {
    this.scene.remove(this.rig.root); this.rig.dispose();
    this.rig = buildAvatar(a); this.scene.add(this.rig.root);
  }
  setFocus(f: Focus) { this.focus = f; }
  setRooms(r: StageRoom[]) { this.rooms = r; }
  resize() {
    const c = this.o.canvas, w = c.clientWidth || 800, h = c.clientHeight || 500;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  /** Fait marcher le personnage jusqu'à la porte de la pièce (par le couloir central), puis rappelle onWalkEnd */
  walkTo(id: string) {
    if (this.o.mode !== "lobby") return;
    const r = this.rooms.find((x) => x.id === id); if (!r || r.locked) return;
    const target = new THREE.Vector3(DOOR_X[r.slot], 0, DOOR_Z);
    const done = () => { this.faceTo = Math.PI; this.o.onWalkEnd?.(id); };
    if (!this.arrivalDone) this.skip();
    if (this.o.reduced) { this.pos.copy(target); this.yaw = Math.PI; this.rig.root.position.copy(this.pos); done(); return; }
    this.overview = false;
    this.path = route(this.pos, target); this.pathEnd = done;
  }
  private faceTo: number | null = null;
  /** Saute la séquence d'arrivée */
  skip() {
    if (this.arrivalDone || this.o.mode !== "lobby") return;
    this.path = []; this.pos.set(ENTRY.x, 0, ENTRY.z); this.yaw = Math.PI; this.arrivalDone = true; this.bank!.front.visible = false; this.overview = true;
    const cb = this.pathEnd; this.pathEnd = null; void cb; this.o.onArrived?.();
  }
  dispose() {
    this.disposed = true; cancelAnimationFrame(this.raf); this.io?.disconnect();
    const c = this.o.canvas;
    if (this.onDown) c.removeEventListener("pointerdown", this.onDown); if (this.onMove) c.removeEventListener("pointermove", this.onMove);
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
    this.renderer.render(this.scene, this.camera);
    this.lblT += dt;
    if (this.lblT > 0.033 && this.o.onLabels && this.bank) { this.lblT = 0; this.emitLabels(); }
  };

  private stepLobby(dt: number) {
    // déplacement le long du trajet
    let moving = false;
    if (this.path.length) {
      moving = true;
      let budget = SPEED * dt;
      while (budget > 0 && this.path.length) {
        const t = this.path[0], dx = t.x - this.pos.x, dz = t.z - this.pos.z, d = Math.hypot(dx, dz);
        if (d < 0.02) { this.path.shift(); continue; }
        const st = Math.min(d, budget);
        this.pos.x += (dx / d) * st; this.pos.z += (dz / d) * st; budget -= st;
        const want = Math.atan2(dx, dz); this.yaw += angDiff(this.yaw, want) * Math.min(1, dt * 9);
        if (st === d) this.path.shift();
      }
      if (!this.path.length) { moving = false; const cb = this.pathEnd; this.pathEnd = null; cb?.(); }
    } else if (this.faceTo !== null) { this.yaw += angDiff(this.yaw, this.faceTo) * Math.min(1, dt * 6); if (Math.abs(angDiff(this.yaw, this.faceTo)) < 0.02) this.faceTo = null; }
    this.walk += ((moving ? 1 : 0) - this.walk) * Math.min(1, dt * 8);
    this.rig.root.position.copy(this.pos); this.rig.root.rotation.y = this.yaw; this.rig.update(dt, this.walk);
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
          n.rig.update(dt, n.wait > 0 ? 0 : 1);
        }
      } else n.rig.update(dt, 0);
    }
    // caméra
    const f = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    let wantPos: THREE.Vector3, wantLook: THREE.Vector3, k = 2.4;
    const aspect = this.camera.aspect;
    if (this.overview && !this.path.length) {
      const back = aspect < 0.9 ? 4.5 : 0;
      wantPos = new THREE.Vector3(0, 6.6 - (aspect < 0.9 ? 1.6 : 0), 15 - back); wantLook = new THREE.Vector3(0, 2.4, -3.5 + (aspect < 0.9 ? 2 : 0)); k = 1.6;
      this.camera.fov = 50;
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

  private stepTailor(dt: number) {
    if (!this.o.reduced && !this.orbit.drag) this.orbit.ang += dt * 0.28;
    const F = { body: { r: 4.3, ty: 0.98, cy: 1.35 }, bust: { r: 2.5, ty: 1.35, cy: 1.5 }, face: { r: 1.15, ty: 1.72, cy: 1.75 } }[this.focus];
    const a = 1 - Math.exp(-dt * 4.5);
    this.orbit.r += (F.r - this.orbit.r) * a; this.orbit.ty += (F.ty - this.orbit.ty) * a; this.orbit.cy += (F.cy - this.orbit.cy) * a;
    this.rig.root.position.copy(this.pos); this.rig.root.rotation.y = 0; this.rig.update(dt, 0);
    const ang = this.orbit.ang;
    this.camera.position.set(Math.sin(ang) * this.orbit.r, this.orbit.cy, Math.cos(ang) * this.orbit.r);
    this.camera.lookAt(0, this.orbit.ty, 0);
    this.camera.fov = this.focus === "face" ? 40 : 46; this.camera.updateProjectionMatrix();
  }

  private emitLabels() {
    const c = this.o.canvas, w = c.clientWidth, h = c.clientHeight, v = new THREE.Vector3();
    const pts: LabelPoint[] = this.rooms.map((r) => {
      v.copy(this.bank!.labelAnchors[r.slot]).project(this.camera);
      return { id: r.id, x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, visible: this.overview && this.arrivalDone && v.z < 1 && v.x > -1.05 && v.x < 1.05 && v.y > -1.05 && v.y < 1.05 };
    });
    this.o.onLabels!(pts);
  }
}

const now2 = (s: Stage) => (s as unknown as { last: number }).last / 1500;

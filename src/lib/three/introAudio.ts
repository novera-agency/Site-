/**
 * Ambiance sonore de l'introduction (Web Audio, aucun fichier : tout est synthétisé dans le navigateur, donc aucune question de licence).
 * - musique ORIGINALE : piano (arpèges), nappe de cordes, basses, grosse caisse de cinéma, en ré mineur / fa majeur, 72 bpm ;
 * - ambiances : rue (circulation lointaine) puis hall feutré avec réverbération (murmures, climatisation) ;
 * - bruitages : pas (pierre dehors, marbre dedans), portes coulissantes.
 * Les sections musicales suivent la mise en scène (`setSection`) ; la musique s'estompe à la reprise du jeu (`fadeOut`).
 */
export type Section = "intro" | "approach" | "arrival" | "hall" | "end";
const BPM = 72, BEAT = 60 / BPM, BAR = BEAT * 4;
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
// 4 accords (ré mineur 9, si♭ maj7, fa, do/mi) : basse, accord (cordes), arpège (piano), mélodie
const CHORDS = [
  { bass: 38, pad: [50, 53, 57, 60], arp: [62, 65, 69, 72, 76, 72, 69, 65], mel: [76, 74, 72] },
  { bass: 34, pad: [50, 53, 57, 62], arp: [58, 62, 65, 69, 74, 69, 65, 62], mel: [74, 72, 69] },
  { bass: 41, pad: [48, 53, 57, 60], arp: [60, 65, 69, 72, 77, 72, 69, 65], mel: [72, 77, 76] },
  { bass: 36, pad: [48, 52, 55, 60], arp: [64, 67, 71, 72, 76, 72, 71, 67], mel: [71, 72, 74] },
];

export class IntroAudio {
  private c: AudioContext | null = null;
  private master!: GainNode; private music!: GainNode; private amb!: GainNode; private sfx!: GainNode;
  private rev!: ConvolverNode; private revSend!: GainNode;
  private outside!: GainNode; private inside!: GainNode;
  private noiseBuf!: AudioBuffer;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextBar = 0; private barIdx = 0;
  private section: Section = "intro";
  private nodes: { stop(): void }[] = [];
  private muted = false;
  private disposed = false;

  /** À appeler dans un geste de l'utilisateur si possible (le navigateur peut sinon garder le son suspendu) */
  start(muted = false) {
    if (this.c || typeof window === "undefined") return;
    const AC = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const c = (this.c = new AC()); this.muted = muted;
    this.master = c.createGain(); this.master.gain.value = muted ? 0 : 0.0001; this.master.connect(c.destination);
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; comp.connect(this.master);
    this.music = c.createGain(); this.music.gain.value = 0.55; this.music.connect(comp);
    this.amb = c.createGain(); this.amb.gain.value = 0.5; this.amb.connect(comp);
    this.sfx = c.createGain(); this.sfx.gain.value = 0.8; this.sfx.connect(comp);
    // bruit et réverbération (réponse impulsionnelle fabriquée : bruit qui décroît)
    this.noiseBuf = c.createBuffer(1, c.sampleRate * 3, c.sampleRate); const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const len = Math.floor(c.sampleRate * 3.2), ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const a = ir.getChannelData(ch); for (let i = 0; i < len; i++) a[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    this.rev = c.createConvolver(); this.rev.buffer = ir; this.revSend = c.createGain(); this.revSend.gain.value = 0.22; this.revSend.connect(this.rev);
    const revOut = c.createGain(); revOut.gain.value = 0.9; this.rev.connect(revOut); revOut.connect(comp);
    this.music.connect(this.revSend);
    this.outside = c.createGain(); this.outside.gain.value = 1; this.outside.connect(this.amb);
    this.inside = c.createGain(); this.inside.gain.value = 0; this.inside.connect(this.amb); this.inside.connect(this.revSend);
    void c.resume();
    if (!muted) this.master.gain.exponentialRampToValueAtTime(0.9, c.currentTime + 2.5);
    this.ambience();
    this.nextBar = c.currentTime + 0.15;
    this.timer = setInterval(() => this.schedule(), 400); this.schedule();
  }

  private noise(loop = true) { const s = this.c!.createBufferSource(); s.buffer = this.noiseBuf; s.loop = loop; return s; }

  /** Rue : souffle grave de la ville, circulation qui va et vient. Hall : climatisation feutrée et murmures lointains. */
  private ambience() {
    const c = this.c!;
    const city = this.noise(), f = c.createBiquadFilter(), g = c.createGain(); f.type = "lowpass"; f.frequency.value = 520; g.gain.value = 0.16;
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.09; lg.gain.value = 0.06; lfo.connect(lg); lg.connect(g.gain); lfo.start();
    city.connect(f); f.connect(g); g.connect(this.outside); city.start();
    const hiss = this.noise(), hf = c.createBiquadFilter(), hg = c.createGain(); hf.type = "bandpass"; hf.frequency.value = 2600; hf.Q.value = 0.5; hg.gain.value = 0.012; hiss.connect(hf); hf.connect(hg); hg.connect(this.outside); hiss.start();
    const room = this.noise(), rf = c.createBiquadFilter(), rg = c.createGain(); rf.type = "lowpass"; rf.frequency.value = 280; rg.gain.value = 0.17; room.connect(rf); rf.connect(rg); rg.connect(this.inside); room.start();
    this.nodes.push({ stop: () => { city.stop(); hiss.stop(); room.stop(); lfo.stop(); } });
    // murmures : bouffées de bruit filtrées autour des formants de la voix, dans le hall
    const murmur = () => {
      if (this.disposed) return; const t = c.currentTime;
      if (this.inside.gain.value > 0.3) {
        const s = this.noise(false), bp = c.createBiquadFilter(), gg = c.createGain(); bp.type = "bandpass"; bp.frequency.value = 500 + Math.random() * 900; bp.Q.value = 3.5;
        const d = 0.5 + Math.random() * 0.9; gg.gain.setValueAtTime(0, t); gg.gain.linearRampToValueAtTime(0.03, t + d * 0.4); gg.gain.linearRampToValueAtTime(0, t + d);
        s.connect(bp); bp.connect(gg); gg.connect(this.inside); s.start(t, Math.random() * 2); s.stop(t + d + 0.1);
      }
      setTimeout(murmur, 250 + Math.random() * 500);
    };
    murmur();
    // voitures qui passent dans la rue
    const car = () => {
      if (this.disposed) return; const t = c.currentTime;
      if (this.outside.gain.value > 0.3) {
        const s = this.noise(false), bp = c.createBiquadFilter(), gg = c.createGain(), pan = c.createStereoPanner();
        bp.type = "bandpass"; bp.Q.value = 1.2; bp.frequency.setValueAtTime(380, t); bp.frequency.linearRampToValueAtTime(900, t + 1.6); bp.frequency.linearRampToValueAtTime(420, t + 3.4);
        gg.gain.setValueAtTime(0, t); gg.gain.linearRampToValueAtTime(0.1, t + 1.5); gg.gain.linearRampToValueAtTime(0, t + 3.4);
        const dir = Math.random() < 0.5 ? -1 : 1; pan.pan.setValueAtTime(-0.8 * dir, t); pan.pan.linearRampToValueAtTime(0.8 * dir, t + 3.4);
        s.connect(bp); bp.connect(gg); gg.connect(pan); pan.connect(this.outside); s.start(t, Math.random() * 2); s.stop(t + 3.6);
      }
      setTimeout(car, 2200 + Math.random() * 3200);
    };
    setTimeout(car, 900);
  }

  /** 1 = dehors, 0 = dedans : fondu entre la rue et le hall (à appeler en continu pendant le franchissement des portes) */
  setOutdoor(k: number) {
    if (!this.c) return; const t = this.c.currentTime;
    this.outside.gain.setTargetAtTime(Math.max(0, Math.min(1, k)), t, 0.35); this.inside.gain.setTargetAtTime(Math.max(0, Math.min(1, 1 - k)), t, 0.35);
  }
  setSection(s: Section) { this.section = s; }
  setMuted(m: boolean) { this.muted = m; if (!this.c) return; this.master.gain.cancelScheduledValues(this.c.currentTime); this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.c.currentTime, 0.15); }
  fadeOut(sec = 3) { if (!this.c) return; const t = this.c.currentTime; this.master.gain.cancelScheduledValues(t); this.master.gain.setValueAtTime(this.master.gain.value, t); this.master.gain.linearRampToValueAtTime(0.0001, t + sec); }

  /* ── bruitages ── */
  /** Un pas : claquement sec sur la pierre (dehors) ou résonnant sur le marbre (dedans) */
  step(indoor: boolean, vol = 1) {
    const c = this.c; if (!c || this.muted) return; const t = c.currentTime;
    const s = this.noise(false), bp = c.createBiquadFilter(), g = c.createGain();
    bp.type = "bandpass"; bp.frequency.value = indoor ? 1500 + Math.random() * 500 : 900 + Math.random() * 300; bp.Q.value = indoor ? 1.6 : 0.9;
    const peak = (indoor ? 0.16 : 0.12) * vol; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + (indoor ? 0.12 : 0.08));
    s.connect(bp); bp.connect(g); g.connect(this.sfx); if (indoor) g.connect(this.revSend); s.start(t, Math.random() * 2); s.stop(t + 0.2);
    const th = c.createOscillator(), tg = c.createGain(); th.frequency.value = 95; tg.gain.setValueAtTime(0.05 * vol, t); tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.07); th.connect(tg); tg.connect(this.sfx); th.start(t); th.stop(t + 0.1);
  }
  /** Portes coulissantes : souffle de moteur + petit carillon discret */
  door(opening: boolean) {
    const c = this.c; if (!c || this.muted) return; const t = c.currentTime;
    const s = this.noise(false), bp = c.createBiquadFilter(), g = c.createGain();
    bp.type = "bandpass"; bp.Q.value = 0.8; bp.frequency.setValueAtTime(opening ? 400 : 900, t); bp.frequency.linearRampToValueAtTime(opening ? 1200 : 400, t + 1.1);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.09, t + 0.25); g.gain.linearRampToValueAtTime(0, t + 1.2);
    s.connect(bp); bp.connect(g); g.connect(this.sfx); s.start(t, Math.random() * 2); s.stop(t + 1.3);
    if (opening) this.tone(mtof(88), t, 1.4, 0.035, "sine", this.sfx);
  }

  /* ── musique ── */
  private tone(freq: number, t: number, dur: number, vol: number, type: OscillatorType, dest: AudioNode, attack = 0.005, detune = 0) {
    const c = this.c!, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = freq; o.detune.value = detune;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }
  /** Note de piano : fondamentale + harmoniques qui s'éteignent vite, attaque sèche */
  private piano(m: number, t: number, vol: number, dur = 1.8) {
    const c = this.c!, lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 3600; lp.connect(this.music);
    const f = mtof(m); this.tone(f, t, dur, vol, "triangle", lp); this.tone(f * 2, t, dur * 0.5, vol * 0.28, "sine", lp); this.tone(f * 3, t, dur * 0.3, vol * 0.1, "sine", lp);
    this.tone(f, t, dur * 0.9, vol * 0.3, "sine", lp, 0.005, 5);
  }
  /** Cordes : plusieurs dents de scie légèrement désaccordées, attaque et relâchement lents */
  private strings(notes: number[], t: number, dur: number, vol: number) {
    const c = this.c!, lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(700, t); lp.frequency.linearRampToValueAtTime(2000, t + dur * 0.6); lp.connect(this.music);
    for (const m of notes) for (const dt of [-9, 0, 8]) {
      const o = c.createOscillator(), g = c.createGain(); o.type = "sawtooth"; o.frequency.value = mtof(m); o.detune.value = dt;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.45); g.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(lp); o.start(t); o.stop(t + dur + 0.05);
    }
  }
  private boom(t: number, vol: number) {
    const c = this.c!, o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(34, t + 0.9);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4); o.connect(g); g.connect(this.music); o.start(t); o.stop(t + 2.5);
  }
  private schedule() {
    const c = this.c; if (!c || this.disposed) return;
    while (this.nextBar < c.currentTime + 1.2) { this.bar(this.nextBar, this.barIdx++); this.nextBar += BAR; }
  }
  private bar(t: number, idx: number) {
    const ch = CHORDS[idx % 4], sec = this.section;
    if (idx === 0) this.boom(t, 0.5);
    // basse : toujours présente, très douce au début
    this.tone(mtof(ch.bass), t, BAR * 1.02, sec === "intro" ? 0.12 : 0.2, "triangle", this.music, 0.06);
    this.tone(mtof(ch.bass - 12), t, BAR, 0.08, "sine", this.music, 0.1);
    // cordes : nappes, de plus en plus présentes
    const sv = sec === "intro" ? 0.011 : sec === "approach" ? 0.016 : sec === "arrival" ? 0.022 : sec === "hall" ? 0.028 : 0.014;
    this.strings(ch.pad, t, BAR * 1.05, sv);
    // piano : dès l'approche, arpèges en croches ; en fin de séquence, plus lent
    if (sec !== "intro") {
      const step = sec === "end" ? 2 : 1;
      for (let i = 0; i < 8; i += step) this.piano(ch.arp[i], t + i * BEAT * 0.5, sec === "approach" ? 0.07 : 0.095, 1.7);
    } else this.piano(ch.arp[4], t + BEAT * 2, 0.06, 2.6);
    // mélodie (piano aigu) : arrivée du personnage et hall
    if (sec === "arrival" || sec === "hall") for (let i = 0; i < 3; i++) this.piano(ch.mel[i] + 12, t + BEAT * (i === 0 ? 0 : i === 1 ? 1.5 : 2.5), 0.07, 2.4);
    // montée dramatique à l'ouverture sur le hall : roulement de caisse à la barre qui introduit la section
    if (sec === "hall" && idx % 4 === 0) this.boom(t, 0.3);
  }

  dispose() {
    this.disposed = true; if (this.timer) clearInterval(this.timer);
    try { this.nodes.forEach((n) => n.stop()); } catch { /* déjà arrêtés */ }
    const c = this.c; if (c) { try { this.master.gain.cancelScheduledValues(c.currentTime); this.master.gain.setTargetAtTime(0, c.currentTime, 0.1); } catch { /* */ } setTimeout(() => { void c.close().catch(() => undefined); }, 600); }
    this.c = null;
  }
}

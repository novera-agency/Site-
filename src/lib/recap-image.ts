"use client";
import type { Recap } from "@/engine/recap";

/** Texte brut de la fiche (copier-coller) */
export function recapText(r: Recap): string {
  const L: string[] = [`FINANCIAL EMPIRE — Fiche à retenir`, r.title, `${r.when} · ${r.subtitle}`, `${r.verdict.label}${r.outcome ? " — " + r.outcome : ""}`, ""];
  const sec = (title: string, items: string[]) => { if (items.length) { L.push(title.toUpperCase()); items.forEach((x) => L.push(`• ${x}`)); L.push(""); } };
  sec("À retenir", r.points);
  sec("Chiffres clés", r.facts.map(([a, b]) => `${a} : ${b}`));
  sec("Notions", r.terms.map((t) => `${t.term} : ${t.text}${t.example ? " Exemple : " + t.example : ""}`));
  sec("Vos décisions", r.decisions);
  sec("Réactions de vos interlocuteurs", r.reactions);
  sec("Conseils", r.tips);
  L.push("Simulation pédagogique : monnaie virtuelle, marchés fictifs.");
  return L.join("\n");
}

const W = 1080, PAD = 56, FONT = `"Inter","Segoe UI",system-ui,-apple-system,Roboto,sans-serif`;
const COL = { bg: "#0a0e15", card: "#0e131c", gold: "#d4a94f", text: "#e3e9f2", muted: "#9aa8bf", gain: "#4ade80", warn: "#fbbf24", loss: "#f87171", info: "#7aa2f7", line: "#243046" };

/** Découpe un texte en lignes qui tiennent dans la largeur donnée */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) { out.push(line); line = word; } else line = test;
    }
    out.push(line);
  }
  return out;
}

/** Fiche en image PNG (1080 px de large), prête à être enregistrée ou partagée */
export async function recapPng(r: Recap): Promise<Blob> {
  const measure = document.createElement("canvas").getContext("2d")!;
  type Op = { kind: "text"; text: string; x: number; font: string; color: string; lh: number } | { kind: "gap"; h: number } | { kind: "rule" } | { kind: "pill"; text: string; color: string };
  const ops: Op[] = [];
  const innerW = W - PAD * 2;
  const text = (t: string, font: string, color: string, lh: number, x = PAD, w = innerW) => { measure.font = font; for (const l of wrap(measure, t, w - (x - PAD))) ops.push({ kind: "text", text: l, x, font, color, lh }); };
  const gap = (h: number) => ops.push({ kind: "gap", h });
  text("FINANCIAL EMPIRE  ·  FICHE À RETENIR", `600 22px ${FONT}`, COL.gold, 30);
  gap(14);
  text(r.title, `700 44px ${FONT}`, COL.text, 54);
  gap(8);
  text(`${r.when}  ·  ${r.subtitle}`, `400 22px ${FONT}`, COL.muted, 30);
  gap(18);
  ops.push({ kind: "pill", text: r.verdict.label, color: COL[r.verdict.tone] });
  if (r.outcome) { gap(10); text(r.outcome, `400 24px ${FONT}`, COL.text, 34); }
  const section = (title: string, rows: { head?: string; body: string }[]) => {
    if (!rows.length) return;
    gap(26); ops.push({ kind: "rule" }); gap(16);
    text(title.toUpperCase(), `700 20px ${FONT}`, COL.gold, 28);
    gap(6);
    for (const row of rows) {
      ops.push({ kind: "text", text: "•", x: PAD, font: `700 24px ${FONT}`, color: COL.gold, lh: 0 }); // puce, tracée sur la première ligne du bloc
      if (row.head) { text(row.head, `700 24px ${FONT}`, COL.text, 34, PAD + 28); text(row.body, `400 22px ${FONT}`, COL.muted, 31, PAD + 28); }
      else text(row.body, `400 24px ${FONT}`, COL.text, 34, PAD + 28);
      gap(8);
    }
  };
  section("À retenir", r.points.map((body) => ({ body })));
  section("Chiffres clés", r.facts.map(([head, body]) => ({ head, body })));
  section("Notions employées", r.terms.map((t) => ({ head: t.term, body: `${t.text}${t.example ? " Exemple : " + t.example : ""}` })));
  section("Vos décisions", r.decisions.map((body) => ({ body })));
  section("Réactions de vos interlocuteurs", r.reactions.map((body) => ({ body })));
  section("Conseils", r.tips.map((body) => ({ body })));
  gap(26); ops.push({ kind: "rule" }); gap(14);
  text("Simulation pédagogique : monnaie virtuelle, marchés et entreprises fictifs.", `400 19px ${FONT}`, COL.muted, 28);

  // Hauteur totale
  let h = PAD;
  for (const o of ops) h += o.kind === "text" ? o.lh : o.kind === "gap" ? o.h : o.kind === "rule" ? 2 : 44;
  h += PAD;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = Math.max(h, 420);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = COL.bg; ctx.fillRect(0, 0, W, canvas.height);
  ctx.strokeStyle = COL.gold; ctx.lineWidth = 3; ctx.strokeRect(14, 14, W - 28, canvas.height - 28);
  ctx.textBaseline = "alphabetic";
  let y = PAD;
  for (const o of ops) {
    if (o.kind === "gap") { y += o.h; continue; }
    if (o.kind === "rule") { ctx.fillStyle = COL.line; ctx.fillRect(PAD, y, innerW, 2); y += 2; continue; }
    if (o.kind === "pill") {
      ctx.font = `700 24px ${FONT}`;
      const w = ctx.measureText(o.text).width + 36;
      ctx.fillStyle = o.color + "33"; ctx.strokeStyle = o.color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(PAD, y, w, 40, 20); ctx.fill(); ctx.stroke();
      ctx.fillStyle = o.color; ctx.fillText(o.text, PAD + 18, y + 28); y += 44; continue;
    }
    if (o.lh === 0) { ctx.font = o.font; ctx.fillStyle = o.color; ctx.fillText(o.text, o.x, y + 26); continue; } // puce alignée sur la première ligne du bloc
    ctx.font = o.font; ctx.fillStyle = o.color; ctx.fillText(o.text, o.x, y + o.lh - 8); y += o.lh;
  }
  return await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Image impossible"))), "image/png"));
}

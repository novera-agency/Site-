"use client";
import { useEffect, useRef } from "react";
import { createChart, CandlestickSeries, HistogramSeries, LineSeries, AreaSeries, ColorType, type IChartApi, type UTCTimestamp, type ISeriesApi, type SeriesType } from "lightweight-charts";
import { EPOCH_UTC } from "@/engine/time";
import { sma, ema, bollinger, rsi, macd } from "@/lib/indicators";

export const toTs = (t: number) => Math.floor(EPOCH_UTC / 1000 + t * 60) as UTCTimestamp;
interface Bar { t: number; o: number; h: number; l: number; c: number; v: number; }
const base = (el: HTMLElement, height: number) => createChart(el, {
  height, autoSize: true,
  layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#8b9ab3", fontSize: 11 },
  grid: { vertLines: { color: "rgba(36,48,70,.35)" }, horzLines: { color: "rgba(36,48,70,.35)" } },
  rightPriceScale: { borderColor: "#243046" }, timeScale: { borderColor: "#243046", timeVisible: true, secondsVisible: false },
  crosshair: { mode: 0 },
  // La molette et le glissé vertical font défiler la page (et non zoomer le graphique) ; zoom au pincement / glisser horizontal
  handleScroll: { mouseWheel: false, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
  handleScale: { mouseWheel: false, pinch: true, axisPressedMouseMove: true, axisDoubleClickReset: true },
  localization: { locale: "fr-FR", priceFormatter: (p: number) => (Math.abs(p) >= 100 ? p.toFixed(2) : Math.abs(p) >= 1 ? p.toFixed(3) : p.toPrecision(4)) },
});

export function PriceChart({ bars, kind = "candles", indicators = [], height = 380 }: { bars: Bar[]; kind?: "candles" | "line"; indicators?: string[]; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const subRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const subChart = useRef<IChartApi | null>(null);
  const series = useRef<Record<string, ISeriesApi<SeriesType>>>({});
  const showSub = indicators.includes("rsi") || indicators.includes("macd");
  useEffect(() => {
    if (!ref.current) return;
    const ch = base(ref.current, height);
    chartRef.current = ch;
    if (showSub && subRef.current) subChart.current = base(subRef.current, 120);
    return () => { ch.remove(); subChart.current?.remove(); subChart.current = null; chartRef.current = null; series.current = {}; };
  }, [height, kind, indicators.join(","), showSub]);
  useEffect(() => {
    const ch = chartRef.current;
    if (!ch || !bars.length) return;
    const dedup: Bar[] = [];
    for (const b of bars) { if (dedup.length && toTs(dedup[dedup.length - 1].t) >= toTs(b.t)) dedup[dedup.length - 1] = b; else dedup.push(b); }
    const S = series.current;
    if (!S.main) {
      S.main = kind === "candles" ? ch.addSeries(CandlestickSeries, { upColor: "#22c55e", downColor: "#ef4444", borderVisible: false, wickUpColor: "#22c55e", wickDownColor: "#ef4444" }) : ch.addSeries(AreaSeries, { lineColor: "#3b82f6", topColor: "rgba(59,130,246,.3)", bottomColor: "rgba(59,130,246,0)", lineWidth: 2 });
      S.vol = ch.addSeries(HistogramSeries, { priceScaleId: "vol", priceFormat: { type: "volume" }, color: "rgba(90,106,133,.45)" });
      ch.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    }
    if (kind === "candles") S.main.setData(dedup.map((b) => ({ time: toTs(b.t), open: b.o, high: b.h, low: b.l, close: b.c })));
    else S.main.setData(dedup.map((b) => ({ time: toTs(b.t), value: b.c })));
    S.vol.setData(dedup.map((b) => ({ time: toTs(b.t), value: b.v, color: b.c >= b.o ? "rgba(34,197,94,.35)" : "rgba(239,68,68,.35)" })));
    const closes = dedup.map((b) => b.c);
    const line = (key: string, vals: (number | null)[], color: string, target: IChartApi = ch, width = 1) => {
      if (!S[key]) S[key] = target.addSeries(LineSeries, { color, lineWidth: width as 1, priceLineVisible: false, lastValueVisible: false });
      S[key].setData(vals.map((v, i) => (v === null ? { time: toTs(dedup[i].t) } : { time: toTs(dedup[i].t), value: v })));
    };
    if (indicators.includes("sma20")) line("sma20", sma(closes, 20), "#d4a94f");
    if (indicators.includes("sma50")) line("sma50", sma(closes, 50), "#a78bfa");
    if (indicators.includes("ema20")) line("ema20", ema(closes, 20), "#22d3ee");
    if (indicators.includes("boll")) { const b = bollinger(closes); line("bu", b.map((x) => x?.up ?? null), "rgba(148,163,184,.6)"); line("bl", b.map((x) => x?.lo ?? null), "rgba(148,163,184,.6)"); }
    const sc = subChart.current;
    if (sc) {
      if (indicators.includes("rsi")) line("rsi", rsi(closes), "#f472b6", sc, 2);
      if (indicators.includes("macd")) { const m = macd(closes); line("macd", m.macd, "#3b82f6", sc, 2); line("sig", m.signal, "#f59e0b", sc); }
    }
  }, [bars, kind, indicators.join(",")]);
  return <div><div ref={ref} style={{ height }} />{showSub && <div ref={subRef} style={{ height: 120 }} className="mt-1 border-t border-ink-700" />}</div>;
}

export function LineChart({ series, height = 220 }: { series: { name: string; color: string; data: { t: number; v: number }[] }[]; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const ch = base(ref.current, height);
    for (const s of series) {
      const sr = ch.addSeries(LineSeries, { color: s.color, lineWidth: 2, priceLineVisible: false, title: s.name });
      const pts: { time: UTCTimestamp; value: number }[] = [];
      for (const p of s.data) { const ts = toTs(p.t); if (pts.length && pts[pts.length - 1].time >= ts) pts[pts.length - 1] = { time: ts, value: p.v }; else pts.push({ time: ts, value: p.v }); }
      sr.setData(pts);
    }
    ch.timeScale().fitContent();
    return () => ch.remove();
  }, [JSON.stringify(series.map((s) => [s.name, s.data.length, s.data[s.data.length - 1]?.v]))]);
  return <div ref={ref} style={{ height }} />;
}

/** Graphique de profil de gain (payoff) en SVG */
export function PayoffChart({ points, spot, breakevens = [], height = 220 }: { points: { x: number; y: number; y2?: number }[]; spot: number; breakevens?: number[]; height?: number }) {
  const w = 600, h = height, pad = 30;
  if (!points.length) return null;
  const xs = points.map((p) => p.x), ys = points.flatMap((p) => [p.y, p.y2 ?? p.y]);
  const xmin = Math.min(...xs), xmax = Math.max(...xs), ymin = Math.min(...ys, 0), ymax = Math.max(...ys, 0);
  const X = (x: number) => pad + ((x - xmin) / (xmax - xmin || 1)) * (w - 2 * pad);
  const Y = (y: number) => h - pad - ((y - ymin) / (ymax - ymin || 1)) * (h - 2 * pad);
  const path = (k: "y" | "y2") => points.map((p, i) => `${i ? "L" : "M"}${X(p.x).toFixed(1)},${Y(p[k] ?? p.y).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }}>
      <line x1={pad} x2={w - pad} y1={Y(0)} y2={Y(0)} stroke="#34425c" />
      <line x1={X(spot)} x2={X(spot)} y1={pad / 2} y2={h - pad} stroke="#3b82f6" strokeDasharray="4 3" />
      <text x={X(spot) + 4} y={pad} fill="#3b82f6" fontSize="11">Cours {spot.toFixed(2)}</text>
      {breakevens.map((b) => <g key={b}><line x1={X(b)} x2={X(b)} y1={pad} y2={h - pad} stroke="#d4a94f" strokeDasharray="2 3" /><text x={X(b) + 3} y={h - pad - 4} fill="#d4a94f" fontSize="10">Seuil {b.toFixed(2)}</text></g>)}
      {points[0].y2 !== undefined && <path d={path("y2")} fill="none" stroke="#a78bfa" strokeWidth="1.5" strokeDasharray="5 4" />}
      <path d={path("y")} fill="none" stroke="#22c55e" strokeWidth="2" />
      <text x={pad} y={h - 8} fill="#8b9ab3" fontSize="10">{xmin.toFixed(1)}</text>
      <text x={w - pad - 30} y={h - 8} fill="#8b9ab3" fontSize="10">{xmax.toFixed(1)}</text>
      <text x={4} y={Y(ymax) + 4} fill="#8b9ab3" fontSize="10">{ymax.toFixed(0)}</text>
      <text x={4} y={Y(ymin)} fill="#8b9ab3" fontSize="10">{ymin.toFixed(0)}</text>
    </svg>
  );
}

/** Barres horizontales (expositions) */
export function HBars({ data, unit = "%" }: { data: [string, number][]; unit?: string }) {
  const max = Math.max(1, ...data.map(([, v]) => Math.abs(v)));
  return <div className="space-y-1.5">{data.map(([k, v]) => <div key={k} className="grid grid-cols-[110px_1fr_64px] items-center gap-2 text-xs"><span className="truncate text-ink-300">{k}</span><div className="relative h-2 rounded bg-ink-800"><div className={`absolute top-0 h-2 rounded ${v >= 0 ? "bg-accent" : "bg-loss"}`} style={{ width: `${(Math.abs(v) / max) * 100}%` }} /></div><span className="num text-right text-ink-200">{v.toFixed(1)}{unit}</span></div>)}</div>;
}

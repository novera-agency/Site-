"use client";
import { useMemo, useState } from "react";
import { useAction } from "@/lib/hooks";
import { useGame } from "@/lib/store";
import { Button, Field, inputCls, Badge } from "./ui";
import { fmtEur, fmtPx, fmtNum } from "@/lib/format";

const EXPLAIN: Record<string, string> = {
  market: "Ordre au marché : exécuté immédiatement au meilleur prix disponible (ask à l'achat, bid à la vente), avec un éventuel glissement (slippage) si la taille est importante par rapport à la liquidité.",
  limit: "Ordre limite : exécuté uniquement à votre prix limite ou mieux. Il peut ne jamais être exécuté.",
  stop: "Ordre stop : se déclenche lorsque le cours atteint le seuil, puis devient un ordre au marché. Utile pour couper une perte (stop-loss).",
  stop_limit: "Stop-limite : se déclenche au seuil stop, puis devient un ordre limite. Protège du glissement mais peut ne pas être exécuté en cas de décrochage.",
};

export function OrderTicket({ inst, defaultAccount = "perso" }: { inst: any; defaultAccount?: string }) {
  const act = useAction();
  const explanations = useGame((s) => s.snap?.explanations);
  const def = inst.def;
  const accounts = inst.accounts as any[];
  const [account, setAccount] = useState(accounts.some((a) => a.id === defaultAccount) ? defaultAccount : "perso");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [type, setType] = useState<"market" | "limit" | "stop" | "stop_limit">("market");
  const [qty, setQty] = useState("1");
  const [limit, setLimit] = useState("");
  const [stop, setStop] = useState("");
  const [sl, setSl] = useState(""); const [tp, setTp] = useState("");
  const [duration, setDuration] = useState<"jour" | "gtc" | "date">("gtc");
  const [days, setDays] = useState("5");
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const mult = def.option?.multiplier ?? def.future?.multiplier ?? (def.bond ? def.bond.nominal / 100 : 1);
  const px = side === "buy" ? inst.book.ask : inst.book.bid;
  const refPx = type === "limit" || type === "stop_limit" ? Number(limit) || px : type === "stop" ? Number(stop) || px : px;
  const q = Number(qty) || 0;
  const notional = refPx * q * mult;
  const acc = accounts.find((a) => a.id === account);
  const complex = !!(def.option || def.future || (side === "sell" && !(inst.positions.find((p: any) => p.account === account)?.pos?.qty > 0)));
  const pos = inst.positions.find((p: any) => p.account === account)?.pos;
  const fx = useMemo(() => (def.currency === "EUR" ? 1 : null), [def.currency]);
  const submit = async () => {
    setBusy(true);
    const r = await act({ type: "order", account, instrumentId: def.id, side, orderType: type, qty: q, limit: limit ? Number(limit) : undefined, stop: stop ? Number(stop) : undefined, duration, expiresDays: duration === "date" ? Number(days) : undefined, stopLoss: sl ? Number(sl) : undefined, takeProfit: tp ? Number(tp) : undefined, clientRef: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` });
    setBusy(false);
    if (r.ok) setAck(false);
  };
  const deskBlocked = account === "desk" && inst.deskAllowed && !inst.deskAllowed.ok;
  return <div className="space-y-3" data-testid="order-ticket">
    <div className="grid grid-cols-2 gap-1 rounded-lg bg-ink-900 p-1"><button data-testid="side-buy" onClick={() => setSide("buy")} className={`rounded-md py-1.5 text-sm font-semibold ${side === "buy" ? "bg-green-600 text-white" : "text-ink-300"}`}>Acheter</button><button data-testid="side-sell" onClick={() => setSide("sell")} className={`rounded-md py-1.5 text-sm font-semibold ${side === "sell" ? "bg-red-600 text-white" : "text-ink-300"}`}>Vendre</button></div>
    <div className="grid grid-cols-2 gap-2">
      <Field label="Compte"><select data-testid="order-account" value={account} onChange={(e) => setAccount(e.target.value)} className={inputCls}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select></Field>
      <Field label="Type d'ordre"><select value={type} onChange={(e) => setType(e.target.value as typeof type)} className={inputCls}><option value="market">Au marché</option><option value="limit">Limite</option><option value="stop">Stop</option><option value="stop_limit">Stop-limite</option></select></Field>
      <Field label={`Quantité${mult !== 1 ? ` (×${mult})` : ""}`}><input data-testid="order-qty" value={qty} onChange={(e) => setQty(e.target.value)} className={inputCls} inputMode="decimal" /></Field>
      {(type === "limit" || type === "stop_limit") && <Field label="Prix limite"><input value={limit} onChange={(e) => setLimit(e.target.value)} className={inputCls} placeholder={fmtPx(px)} inputMode="decimal" /></Field>}
      {(type === "stop" || type === "stop_limit") && <Field label="Seuil stop"><input value={stop} onChange={(e) => setStop(e.target.value)} className={inputCls} placeholder={fmtPx(px)} inputMode="decimal" /></Field>}
      {type !== "market" && <Field label="Validité"><select value={duration} onChange={(e) => setDuration(e.target.value as typeof duration)} className={inputCls}><option value="jour">Jour</option><option value="gtc">Jusqu'à annulation</option><option value="date">Durée limitée</option></select></Field>}
      {type !== "market" && duration === "date" && <Field label="Jours"><input value={days} onChange={(e) => setDays(e.target.value)} className={inputCls} /></Field>}
      {side === "buy" && <><Field label="Stop-loss (facultatif)"><input value={sl} onChange={(e) => setSl(e.target.value)} className={inputCls} inputMode="decimal" /></Field><Field label="Take-profit (facultatif)"><input value={tp} onChange={(e) => setTp(e.target.value)} className={inputCls} inputMode="decimal" /></Field></>}
    </div>
    <div className="rounded-md bg-ink-900 p-3 text-xs">
      <div className="flex justify-between"><span className="text-ink-400">Bid / Ask</span><span className="num">{fmtPx(inst.book.bid)} / {fmtPx(inst.book.ask)} <span className="text-ink-500">({fmtNum(inst.book.spreadBps, 1)} pb)</span></span></div>
      <div className="flex justify-between"><span className="text-ink-400">Montant estimé</span><span className="num">{fmtNum(notional, 2)} {def.currency}{fx === null && " (conversion automatique depuis l'euro)"}</span></div>
      {def.future && <div className="flex justify-between"><span className="text-ink-400">Dépôt de garantie estimé</span><span className="num">{fmtNum(notional * def.future.marginPct, 2)} {def.currency}</span></div>}
      <div className="flex justify-between"><span className="text-ink-400">Pouvoir d'achat ({acc?.label})</span><span className="num">{fmtEur(acc?.buyingPower)}</span></div>
      {pos && <div className="flex justify-between"><span className="text-ink-400">Position actuelle</span><span className="num">{fmtNum(pos.qty, def.cls === "crypto" ? 4 : 0)} @ {fmtPx(pos.avgPrice)}</span></div>}
      {!inst.book.open && <div className="mt-1 text-amber-300">Marché fermé : l'ordre sera traité à l'ouverture.</div>}
    </div>
    {explanations && <div className="rounded-md border border-blue-500/30 bg-blue-500/10 p-2 text-xs text-blue-100">💡 {EXPLAIN[type]}{def.option && " Option : la prime payée est la perte maximale pour un acheteur ; un vendeur s'expose à des pertes potentiellement importantes."}{def.future && " Future : vous ne payez pas le notionnel mais un dépôt de garantie ; les gains et pertes sont réglés chaque jour (appels de marge)."}</div>}
    {complex && <label className="flex items-start gap-2 text-xs text-amber-200"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5" />Je comprends que cette opération ({def.option ? "option" : def.future ? "contrat à terme à effet de levier" : "vente à découvert"}) peut entraîner des pertes supérieures à ma mise initiale ou des appels de marge.</label>}
    {deskBlocked && <div className="text-xs text-loss">{inst.deskAllowed.reason}</div>}
    <Button data-testid="submit-order" className="w-full" variant={side === "buy" ? "success" : "danger"} disabled={busy || q <= 0 || (complex && !ack) || deskBlocked} onClick={submit}>{side === "buy" ? "Acheter" : "Vendre"} {q > 0 ? fmtNum(q, def.cls === "crypto" ? 4 : 0) : ""} {def.id}</Button>
    <div className="flex flex-wrap gap-1 text-[11px] text-ink-400"><Badge>Frais inclus au moment de l'exécution</Badge><Badge>Identifiant d'ordre unique</Badge></div>
  </div>;
}

"use client";
import Link from "next/link";
import { useView, useAction } from "@/lib/hooks";
import { useGame } from "@/lib/store";
import { Card, PageTitle, Loading, Button, Badge, Bar } from "@/components/ui";
import { fmtDate, fmtDateTime } from "@/engine/time";

const eur = (v: number) => `${Math.round(v).toLocaleString("fr-FR")} €`;
const BARS: [string, string, string, string][] = [
  ["mental", "Santé mentale", "🧠", "Baisse avec le stress, l'isolement, l'ennui et les soucis d'argent. Trop basse : erreurs au travail, puis arrêt pour épuisement."],
  ["physique", "Forme physique", "💪", "Sport, vélo, repos. Basse : moins d'énergie au bureau."],
  ["social", "Vie sociale", "🫂", "Amis et famille. S'effrite si vous ne voyez personne."],
  ["fun", "Épanouissement", "🎉", "Plaisirs, sorties, passions. S'use vite sans moments pour vous."],
];
const tone = (v: number) => (v >= 60 ? "gain" : v >= 35 ? "warn" : "loss") as "gain" | "warn" | "loss";
const fx = (n: number, l: string) => (n ? <span className={n > 0 ? "text-gain" : "text-loss"}>{n > 0 ? "+" : ""}{n} {l}</span> : null);

export default function Vie() {
  const { data } = useView<any>("life", {}, 4000);
  const act = useAction();
  const snap = useGame((s) => s.snap);
  if (!data) return <Loading />;
  if (!data.enabled) return <><PageTitle env="Vie privée" title="Vie privée" subtitle="La vie privée (salaire, logement, factures, loisirs, santé mentale) est simulée en mode carrière." /><Card><p className="text-sm text-ink-300">Lancez une partie en mode carrière pour gérer votre vie en dehors du travail.</p></Card></>;
  const h = data.housing;
  const canRaise = data.employed && (!data.raiseAt || (snap && snap.t >= data.raiseAt));
  return <>
    <PageTitle env="Vie privée" title="Votre vie en dehors du bureau" subtitle="Votre salaire paie d'abord vos obligations (logement, factures, impôts). Avec le reste, à vous de choisir : épargner, investir, ou profiter de la vie. Négligez votre équilibre, et c'est votre travail qui en souffrira." />

    {data.unpaid > 0 && <div className="mb-4 rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-200" data-testid="unpaid">⚠️ Factures impayées depuis {data.unpaid} mois. Au bout de 3 mois : expulsion. Réduisez vos dépenses (logement moins cher, abonnements) ou vendez des placements.</div>}

    <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4" data-testid="life-bars">
      {BARS.map(([k, label, emoji, help]) => <Card key={k}><div className="flex items-baseline justify-between"><div className="text-sm font-medium text-white">{emoji} {label}</div><div className={`num text-xl font-semibold ${data.bars[k] >= 60 ? "text-gain" : data.bars[k] >= 35 ? "text-amber-300" : "text-loss"}`}>{data.bars[k]}</div></div><div className="mt-2"><Bar value={data.bars[k]} tone={tone(data.bars[k])} /></div><p className="mt-2 text-[11px] leading-snug text-ink-400">{help}</p></Card>)}
    </div>
    <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
      <Card><div className="text-xs text-ink-400">Stress au travail</div><div className={`num text-lg font-semibold ${data.stress > 70 ? "text-loss" : data.stress > 45 ? "text-amber-300" : "text-ink-100"}`}>{data.stress}/100</div></Card>
      <Card><div className="text-xs text-ink-400">Énergie</div><div className="num text-lg font-semibold">{data.energy}/100</div></Card>
      <Card><div className="text-xs text-ink-400">Temps libre aujourd'hui</div><div className="num text-lg font-semibold" data-testid="free-hours">{data.free.left} h <span className="text-xs text-ink-500">/ {data.free.total} h</span></div></Card>
      <Card><div className="text-xs text-ink-400">Compte courant</div><div className={`num text-lg font-semibold ${data.cash < 0 ? "text-loss" : ""}`}>{eur(data.cash)}</div></Card>
    </div>

    <div className="grid gap-4 xl:grid-cols-3">
      <Card title="💶 Votre salaire" right={<Link href="/play/remuneration" className="text-xs text-accent">Rémunération →</Link>}>
        <div className="space-y-1 text-sm" data-testid="payslip">
          <Row l="Salaire brut annuel" v={eur(data.salary)} strong />
          <Row l="Brut mensuel" v={eur(data.pay.gross)} />
          <Row l="Cotisations sociales (≈ 23 %)" v={`−${eur(data.pay.social)}`} />
          <Row l="Net avant impôt" v={eur(data.pay.net)} />
          <Row l="Impôt sur le revenu (prélevé à la source)" v={`−${eur(data.pay.tax)}`} />
          <Row l="Versé sur votre compte chaque mois" v={eur(data.pay.netAfterTax)} strong />
        </div>
        <div className="mt-3 rounded-md bg-ink-900 p-3 text-xs text-ink-300">
          {data.perks.teletravail && <div>🏠 Télétravail deux jours par semaine</div>}
          {data.perks.extraLeave > 0 && <div>🌴 +{data.perks.extraLeave} jours de congés</div>}
          <div>Congés restants cette année : {data.vacationLeft} jours</div>
        </div>
        <div className="mt-3">{canRaise ? <Button data-testid="ask-raise" onClick={() => act({ type: "ask_raise" })}>🤝 Demander un rendez-vous pour négocier</Button> : <p className="text-xs text-ink-400">{data.employed ? `Prochaine négociation possible le ${fmtDate(data.raiseAt, false)}.` : "Sans emploi, pas de négociation."}</p>}<p className="mt-1 text-[11px] text-ink-500">Augmentation, télétravail ou congés : préparez vos arguments (résultats, responsabilités, offres concurrentes).</p></div>
      </Card>

      <Card title="🧾 Budget du mois">
        <div className="space-y-1 text-sm" data-testid="bills">
          <Row l="Salaire net versé" v={eur(data.pay.netAfterTax)} tone="gain" />
          {data.bills.map(([l, v]: [string, number]) => <Row key={l} l={l} v={`−${eur(v)}`} />)}
          <div className="my-1 border-t border-ink-700" />
          <Row l="Reste pour vivre, épargner et vous faire plaisir" v={eur(data.left)} strong tone={data.left < 0 ? "loss" : "gain"} />
        </div>
        <p className="mt-2 text-[11px] text-ink-500">Prélevé automatiquement le premier jour ouvré du mois, juste après le salaire.</p>
      </Card>

      <Card title="🏠 Logement" right={<span className="text-xs text-ink-400">{data.city}</span>}>
        <div className="text-sm"><div className="font-semibold text-white">{h.def.name} {h.owned ? <Badge tone="gold">propriétaire</Badge> : <Badge>locataire</Badge>}</div><div className="text-xs text-ink-400">{h.def.desc}</div></div>
        {h.owned ? <div className="mt-2 space-y-1 text-sm"><Row l="Valeur estimée" v={eur(h.value)} />{h.mortgage && <><Row l="Capital restant dû" v={eur(h.mortgage.principal)} /><Row l="Mensualité" v={`${eur(h.mortgage.monthly)} (${h.mortgage.monthsLeft} mois)`} /></>}<Row l="Patrimoine immobilier net" v={eur(h.equity)} strong /><Button size="sm" variant="ghost" onClick={() => act({ type: "life_sell" })}>Vendre et repartir en location</Button></div> : <div className="mt-2 text-sm"><Row l="Loyer" v={eur(h.rent)} /></div>}
        <div className="mt-3 text-[11px] text-ink-500">Taux de crédit immobilier actuel : {(data.mortgageRate * 100).toFixed(2).replace(".", ",")} % sur 20 ans. Achat : 10 % d'apport + 7,5 % de frais de notaire ; mensualité limitée à 35 % de vos revenus.</div>
      </Card>
    </div>

    <Card title="🎟️ Que faire de votre temps libre ?" className="mt-4" right={<span className="text-xs text-ink-400">{data.weekend ? "Week-end : 14 h de temps libre" : "Soirée : le temps libre est limité en semaine"}</span>}>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-testid="activities">
        {data.activities.map((a: any) => <button key={a.id} data-testid={`act-${a.id}`} disabled={a.hours > data.free.left || (a.weekend && !data.weekend)} onClick={() => act({ type: "life_activity", id: a.id })} className="rounded-lg border border-ink-700 bg-ink-850 p-3 text-left transition enabled:hover:border-gold disabled:opacity-40">
          <div className="flex items-baseline justify-between gap-2"><span className="font-medium text-white">{a.emoji} {a.name}</span><span className="num text-xs text-ink-300">{a.cost ? eur(a.cost) : "gratuit"} · {a.hours} h</span></div>
          <div className="mt-1 text-[11px] text-ink-400">{a.desc}{a.weekend ? " (week-end)" : ""}</div>
          <div className="mt-1 flex flex-wrap gap-x-2 text-[11px]">{fx(a.m, "mental")}{fx(a.p, "forme")}{fx(a.so, "social")}{fx(a.f, "plaisir")}</div>
        </button>)}
      </div>
    </Card>

    <div className="mt-4 grid gap-4 xl:grid-cols-3">
      <Card title="🔑 Déménager ou acheter" className="xl:col-span-2">
        <div className="grid gap-2 md:grid-cols-2">{data.offers.map((o: any) => <div key={o.id} className={`rounded-lg border p-3 text-sm ${o.id === h.id ? "border-gold/60 bg-yellow-500/5" : "border-ink-700 bg-ink-850"}`}>
          <div className="font-medium text-white">{o.name} <span className="text-xs text-ink-500">confort {"★".repeat(o.comfort)}</span></div><div className="text-[11px] text-ink-400">{o.desc}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2"><Button size="sm" variant="ghost" disabled={o.id === h.id && !h.owned} onClick={() => act({ type: "life_move", housing: o.id, buy: false })}>Louer · {eur(o.rentNow)}/mois</Button>{o.priceNow && <Button size="sm" variant="outline" disabled={o.id === h.id && h.owned} onClick={() => act({ type: "life_move", housing: o.id, buy: true })}>Acheter · {eur(o.priceNow)}</Button>}</div>
        </div>)}</div>
      </Card>
      <div className="space-y-4">
        <Card title="🚇 Transport">{data.transports.map((t: any) => <button key={t.id} onClick={() => act({ type: "life_transport", mode: t.id })} className={`mb-1.5 block w-full rounded-md border px-3 py-2 text-left text-sm ${data.transport === t.id ? "border-gold bg-yellow-500/10" : "border-ink-700 bg-ink-850 hover:border-ink-500"}`}><div className="flex justify-between"><span>{t.name}</span><span className="num text-xs">{eur(t.cost)}/mois</span></div><div className="text-[11px] text-ink-400">{t.desc}</div></button>)}</Card>
        <Card title="📋 Abonnements et assurances">{data.subsList.map((x: any) => <label key={x.id} className="mb-2 flex cursor-pointer items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={!!data.subs[x.id]} onChange={(e) => act({ type: "life_sub", key: x.id, on: e.target.checked })} /><span><span className="text-white">{x.name}</span> <span className="num text-xs text-ink-400">{eur(x.cost)}/mois</span><span className="block text-[11px] text-ink-500">{x.desc}</span></span></label>)}</Card>
      </div>
    </div>

    <Card title="📔 Journal de vie" className="mt-4">{data.log.length ? <ul className="space-y-1 text-sm">{data.log.map((x: any, i: number) => <li key={i}><span className="num mr-2 text-xs text-ink-500">{fmtDateTime(x.t)}</span>{x.text}</li>)}</ul> : <p className="text-sm text-ink-400">Rien pour l'instant. Votre vie commence !</p>}</Card>
  </>;
}

function Row({ l, v, strong, tone }: { l: string; v: string; strong?: boolean; tone?: "gain" | "loss" }) {
  return <div className="flex items-baseline justify-between gap-3"><span className={strong ? "font-medium text-white" : "text-ink-300"}>{l}</span><span className={`num whitespace-nowrap ${strong ? "font-semibold" : ""} ${tone === "gain" ? "text-gain" : tone === "loss" ? "text-loss" : "text-ink-100"}`}>{v}</span></div>;
}

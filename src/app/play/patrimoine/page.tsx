"use client";
import { useView, useAction } from "@/lib/hooks";
import { Card, PageTitle, Loading, Stat, Button } from "@/components/ui";
import { LineChart } from "@/components/charts";
import { fmtEur, fmtPct } from "@/lib/format";

const LIFE = ["Frugal", "Modeste", "Confortable", "Aisé", "Luxueux"];
export default function Patrimoine() {
  const { data } = useView<any>("wealth", {}, 4000);
  const act = useAction();
  if (!data) return <Loading />;
  return <>
    <PageTitle env="Espace patrimonial" title="Patrimoine personnel" subtitle="Votre patrimoine = compte personnel (liquidités + placements) + votre part dans votre société. Les fonds de la banque et des clients n'en font jamais partie." />
    <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5"><Card><Stat label="Patrimoine net" value={fmtEur(data.total, 2)} /></Card><Card><Stat label="Compte personnel" value={fmtEur(data.persoEq, 2)} sub={`dont liquidités ${fmtEur(data.perso.cash, 2)}`} /></Card><Card><Stat label="Parts de société" value={fmtEur(data.company)} /></Card><Card><Stat label="Plus haut historique" value={fmtEur(data.peak)} /></Card><Card><Stat label="Repli maximal" value={fmtPct(-data.maxDrawdown * 100)} tone="loss" /></Card></div>
    <div className="grid gap-4 xl:grid-cols-3">
      <Card title="Évolution du compte personnel" className="xl:col-span-2"><LineChart height={240} series={[{ name: "Compte personnel", color: "#d4a94f", data: data.history }]} /></Card>
      <Card title="Flux récents"><div className="space-y-2"><Stat label="Salaires et bonus perçus" value={fmtEur(data.income.salaires, 2)} tone="gain" /><Stat label="Dividendes, coupons, intérêts" value={fmtEur(data.income.dividendes, 2)} tone="gain" /><Stat label="Dépenses de vie" value={fmtEur(-data.income.depenses, 2)} tone="loss" /></div></Card>
      {data.lifeOn ? <Card title="Vie privée" className="xl:col-span-3"><p className="text-sm text-ink-300">Logement, factures, impôts, loisirs et santé mentale se gèrent dans <a href="/play/vie" className="text-gold">Vie privée</a>.{data.housing > 0 ? ` Patrimoine immobilier net : ${Math.round(data.housing).toLocaleString("fr-FR")} € (inclus dans le patrimoine).` : ""}</p></Card> :       <Card title="Train de vie" className="xl:col-span-3"><p className="mb-2 text-sm text-ink-300">{data.livingExpenses ? "Les dépenses de vie mensuelles dépendent de votre train de vie. Un train de vie plus élevé réduit votre stress mais pèse sur votre épargne." : "Les dépenses de vie fictives sont désactivées dans ce mode."}</p><div className="flex flex-wrap gap-2">{LIFE.map((l, i) => <Button key={l} variant={data.lifestyle === i ? "primary" : "ghost"} onClick={() => act({ type: "lifestyle", level: i })}>{l} (≈ {(1800 + i * 900).toLocaleString("fr-FR")} €/mois)</Button>)}</div></Card>}
    </div>
  </>;
}

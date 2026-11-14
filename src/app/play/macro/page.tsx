"use client";
import { useView } from "@/lib/hooks";
import { Card, PageTitle, Loading, Stat } from "@/components/ui";
import { LineChart } from "@/components/charts";
import { fmtNum } from "@/lib/format";

export default function Macro() {
  const { data } = useView<any>("macro", {}, 5000);
  if (!data) return <Loading />;
  return <>
    <PageTitle env="Recherche économique" title="Macroéconomie" subtitle={`Régime : ${data.regimeLabel} · aversion au risque ${Math.round(data.riskAversion * 100)}/100 · liquidité ${Math.round(data.liquidity * 100)}/100 · tensions géopolitiques ${Math.round(data.geopolitics * 100)}/100`} />
    <div className="grid gap-4 xl:grid-cols-2">{Object.values(data.zones).map((z: any) => <Card key={z.id} title={z.name} right={z.cbName}>
      <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
        <Stat label="Croissance" value={`${fmtNum(z.growth, 1)} %`} tone={z.growth < 0 ? "loss" : "neutral"} /><Stat label="Inflation" value={`${fmtNum(z.inflation, 1)} %`} tone={z.inflation > 4 ? "loss" : "neutral"} /><Stat label="Chômage" value={`${fmtNum(z.unemployment, 1)} %`} /><Stat label="Taux directeur" value={`${fmtNum(z.policyRate, 2)} %`} /><Stat label="Taux 2 / 10 / 30 ans" value={`${fmtNum(z.y2, 2)} / ${fmtNum(z.y10, 2)}`} sub={`30 ans ${fmtNum(z.y30, 2)} %`} /><Stat label="Pente 2-10" value={`${Math.round((z.y10 - z.y2) * 100)} pb`} tone={z.y10 < z.y2 ? "loss" : "neutral"} />
        <Stat label="PIB" value={`${fmtNum(z.gdp / 1000, 1)} k Md`} /><Stat label="Dette publique" value={`${fmtNum(z.debt, 0)} % PIB`} /><Stat label="Déficit" value={`${fmtNum(z.deficit, 1)} %`} /><Stat label="Balance commerciale" value={`${fmtNum(z.tradeBalance, 1)} %`} /><Stat label="Confiance conso." value={fmtNum(z.confidence, 0)} /><Stat label="Production indus." value={`${fmtNum(z.industrial, 1)} %`} />
      </div>
      <div className="mt-3"><LineChart height={150} series={[{ name: "Inflation", color: "#ef4444", data: z.history.map((h: any) => ({ t: h.day * 1440, v: h.inflation })) }, { name: "Croissance", color: "#22c55e", data: z.history.map((h: any) => ({ t: h.day * 1440, v: h.growth })) }, { name: "Taux directeur", color: "#3b82f6", data: z.history.map((h: any) => ({ t: h.day * 1440, v: h.policyRate })) }]} /></div>
      <p className="mt-2 text-[11px] text-ink-400">Conditions financières : {fmtNum(z.finConditions, 2)} (positif = resserrées). Anticipations d'inflation : {fmtNum(z.inflationExp, 1)} %. Prochaine réunion monétaire : jour {z.nextCbDay}.</p>
    </Card>)}</div>
  </>;
}

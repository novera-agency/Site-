"use client";
import { useState } from "react";
import { useView, useAction } from "@/lib/hooks";
import { Card, PageTitle, Loading, Button, Badge, inputCls } from "@/components/ui";

const eur = (v: number) => `${Math.round(v).toLocaleString("fr-FR")} €`;
const pct = (v: number) => `${(v * 100).toFixed(1).replace(".", ",")} %`;
const STATUS: Record<string, [string, "gain" | "warn" | "info" | "loss" | "gold"]> = { vacant: ["Vide", "loss"], en_location: ["En recherche de locataire", "warn"], loue: ["Loué", "gain"], en_vente: ["En vente", "gold"], travaux: ["Travaux en cours", "info"] };

export default function Immobilier() {
  const [city, setCity] = useState("lyon");
  const { data } = useView<any>("realestate", { city }, 4000);
  const act = useAction();
  const [inputs, setInputs] = useState<Record<string, string>>({});
  if (!data) return <Loading />;
  if (!data.enabled) return <><PageTitle env="Vie personnelle" title="Investissement immobilier" /><Card><p className="text-sm text-ink-300">Disponible en mode carrière.</p></Card></>;
  const c = data.cities.find((x: any) => x.id === data.city);
  const val = (k: string, d: number) => inputs[k] ?? String(d);
  return <>
    <PageTitle env="Vie personnelle" title="Investissement immobilier" subtitle="Achetez un logement dans une ville française, puis louez-le ou revendez-le au prix que vous fixez. C'est le marché qui décide : trop cher, personne ne signe ; moins cher, plus de candidats, mais la demande de chaque ville a ses limites." />
    <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
      <Card><div className="text-xs text-ink-400">Vos biens</div><div className="num text-lg font-semibold">{data.properties.length}</div></Card>
      <Card><div className="text-xs text-ink-400">Patrimoine immobilier net</div><div className="num text-lg font-semibold">{eur(data.equity)}</div></Card>
      <Card><div className="text-xs text-ink-400">Compte courant</div><div className="num text-lg font-semibold">{eur(data.cash)}</div></Card>
      <Card><div className="text-xs text-ink-400">Taux de crédit · mensualités</div><div className="num text-lg font-semibold">{pct(data.rate)} · {eur(data.burden)}</div><div className="text-[11px] text-ink-500">plafond : 35 % de {eur(data.income)}</div></Card>
    </div>

    <Card title="🏘️ Mes biens" className="mb-4">
      {data.properties.length === 0 ? <p className="text-sm text-ink-400">Aucun bien pour l'instant. Choisissez une ville ci-dessous et achetez votre premier logement.</p> :
        <div className="grid gap-3 lg:grid-cols-2" data-testid="my-properties">{data.properties.map((p: any) => <div key={p.id} className="rounded-lg border border-ink-700 bg-ink-850 p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2"><div className="font-semibold text-white">{p.typeName} · {p.surface} m² · {p.cityName}</div><Badge tone={STATUS[p.status][1]}>{STATUS[p.status][0]}</Badge></div>
          <div className="text-[11px] text-ink-400">{p.condName} · DPE {p.dpe} · acheté {eur(p.buyPrice)}</div>
          <div className="mt-2 grid grid-cols-2 gap-x-3 text-xs"><span className="text-ink-400">Valeur estimée</span><span className="num text-right">{eur(p.value)}</span><span className="text-ink-400">Loyer du marché</span><span className="num text-right">{eur(p.marketRent)}/mois</span>{p.cap && <><span className="text-ink-400">Plafond légal (encadrement)</span><span className="num text-right">{eur(p.cap)}/mois</span></>}{p.status === "loue" && <><span className="text-ink-400">Loyer perçu</span><span className="num text-right text-gain">{eur(p.rent)}/mois</span></>}{p.loan && <><span className="text-ink-400">Crédit restant</span><span className="num text-right">{eur(p.loan.principal)} ({eur(p.loan.monthly)}/mois)</span></>}</div>
          {p.status === "en_location" && <div className="mt-2 rounded bg-ink-900 p-2 text-xs">Annonce à <b>{eur(p.askRent)}</b> : {Math.round(p.pRent * 100)} % de chances de signer dans le mois.</div>}
          {p.askPrice && <div className="mt-2 rounded bg-ink-900 p-2 text-xs">En vente à <b>{eur(p.askPrice)}</b> : {Math.round(p.pSale * 100)} % de chances de vendre dans la semaine.</div>}
          {p.status !== "travaux" && <div className="mt-3 space-y-2">
            {p.status !== "loue" && <div className="flex flex-wrap items-center gap-2"><input type="number" inputMode="numeric" data-testid={`rent-${p.id}`} className={inputCls + " w-28 py-1 text-xs"} value={val(`r${p.id}`, p.askRent ?? p.marketRent)} onChange={(e) => setInputs({ ...inputs, [`r${p.id}`]: e.target.value })} /><span className="text-xs text-ink-400">€/mois</span><Button size="sm" data-testid={`do-rent-${p.id}`} onClick={() => act({ type: "re_rent", id: p.id, rent: Number(val(`r${p.id}`, p.askRent ?? p.marketRent)) })}>Mettre en location</Button></div>}
            <div className="flex flex-wrap items-center gap-2"><input type="number" inputMode="numeric" data-testid={`price-${p.id}`} className={inputCls + " w-32 py-1 text-xs"} value={val(`s${p.id}`, p.askPrice ?? p.value)} onChange={(e) => setInputs({ ...inputs, [`s${p.id}`]: e.target.value })} /><span className="text-xs text-ink-400">€</span><Button size="sm" variant="outline" data-testid={`do-sell-${p.id}`} onClick={() => act({ type: "re_sell", id: p.id, price: Number(val(`s${p.id}`, p.askPrice ?? p.value)) })}>Mettre en vente</Button></div>
            <div className="flex flex-wrap gap-2">{(p.status === "en_location" || p.askPrice) && <Button size="sm" variant="ghost" onClick={() => act({ type: "re_withdraw", id: p.id })}>Retirer l'annonce</Button>}{p.condition !== "neuf" && p.status !== "loue" && <Button size="sm" variant="ghost" onClick={() => act({ type: "re_renovate", id: p.id })}>🔨 Faire des travaux</Button>}</div>
          </div>}
          {p.log?.length > 0 && <div className="mt-2 text-[11px] text-ink-500">{p.log.slice(0, 3).map((x: any) => x.text).join(" · ")}</div>}
        </div>)}</div>}
      <p className="mt-3 text-[11px] text-ink-500">Chaque mois : loyer encaissé (sauf impayé), taxe foncière, copropriété et assurance, mensualité du crédit, impôt et prélèvements sociaux sur les loyers. À la vente : remboursement du crédit, frais d'agence (4 %) et impôt sur la plus-value (36,2 %, dégressif après 5 ans de détention).</p>
    </Card>

    <Card title="📍 Choisir une ville">
      <div className="mb-3 flex flex-wrap gap-1.5" data-testid="cities">{data.cities.map((x: any) => <button key={x.id} onClick={() => setCity(x.id)} className={`rounded-full px-3 py-1 text-xs ${x.id === data.city ? "bg-gold font-semibold text-black" : "bg-ink-800 text-ink-200 hover:bg-ink-700"}`}>{x.name}</button>)}</div>
      {c && <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-2 text-sm">
          <div className="text-lg font-semibold text-white">{c.name}</div>
          <div className="grid grid-cols-2 gap-x-3 text-xs"><span className="text-ink-400">Prix moyen</span><span className="num text-right">{eur(c.priceNow)}/m²</span><span className="text-ink-400">Loyer moyen</span><span className="num text-right">{c.rentNow.toLocaleString("fr-FR")} €/m²/mois</span><span className="text-ink-400">Rendement brut</span><span className="num text-right">{pct(c.yieldGross)}</span><span className="text-ink-400">Demande locative</span><span className="num text-right">{Math.round(c.tension * 100)}/100</span></div>
          <div className="text-xs"><div className="text-gain">✔ {c.pros.join(" · ")}</div><div className="mt-1 text-loss">✘ {c.cons.join(" · ")}</div>{c.cap && <div className="mt-1 text-amber-300">⚖️ Encadrement des loyers : impossible de louer au-dessus du plafond légal.</div>}</div>
        </div>
        <div className="lg:col-span-2"><div className="mb-1 text-xs uppercase tracking-wider text-ink-400">Annonces du mois</div>
          <div className="grid gap-2 md:grid-cols-2" data-testid="listings">{data.listings.length === 0 ? <p className="text-sm text-ink-400">Plus d'annonce ce mois-ci : revenez le mois prochain.</p> : data.listings.map((li: any) => <div key={li.id} className="rounded-lg border border-ink-700 bg-ink-850 p-3 text-sm">
            <div className="flex justify-between gap-2"><span className="font-medium text-white">{li.typeName} · {li.surface} m²</span><span className="num font-semibold">{eur(li.price)}</span></div>
            <div className="text-[11px] text-ink-400">{li.desc}</div>
            <div className="mt-1 text-[11px] text-ink-300">Loyer de marché ≈ {eur(li.marketRent)}/mois · rendement brut {pct(li.marketRent * 12 / li.price)}{li.dpe === "G" && <span className="text-loss"> · DPE G : interdit à la location sans travaux</span>}</div>
            <div className="mt-2 flex flex-wrap gap-2"><Button size="sm" data-testid={`buy-cash-${li.id}`} onClick={() => act({ type: "re_buy", listing: li.id, credit: false })}>Acheter comptant</Button><Button size="sm" variant="outline" data-testid={`buy-credit-${li.id}`} onClick={() => act({ type: "re_buy", listing: li.id, credit: true })}>Acheter à crédit</Button></div>
          </div>)}</div>
          <p className="mt-2 text-[11px] text-ink-500">Frais de notaire : 7,5 %. Crédit sur 20 ans avec 10 % d'apport ; la banque refuse si vos mensualités dépassent 35 % de vos revenus (70 % de vos loyers comptent).</p>
        </div>
      </div>}
    </Card>
  </>;
}

"use client";
import { SoundTest } from "@/components/SoundTest";
import { useView, useAction } from "@/lib/hooks";
import { Card, PageTitle, Loading, Field, inputCls, Badge } from "@/components/ui";

export default function Parametres() {
  const { data, reload } = useView<any>("settings", {}, 60000);
  const act = useAction();
  if (!data) return <Loading />;
  const s = data.settings;
  const set = async (patch: Record<string, unknown>) => { await act({ type: "settings", ...patch }); reload(); };
  const Toggle = ({ k, label, hint, disabled }: { k: string; label: string; hint: string; disabled?: boolean }) => <label className={`flex items-start gap-3 rounded-md bg-ink-900 p-3 ${disabled ? "opacity-50" : ""}`}><input type="checkbox" disabled={disabled} checked={!!s[k]} onChange={(e) => set({ [k]: e.target.checked })} className="mt-1" /><span><span className="block text-sm font-medium">{label}</span><span className="text-xs text-ink-400">{hint}</span></span></label>;
  return <>
    <PageTitle env="Système" title="Paramètres de la partie" subtitle={`Partie « ${data.name} » — ${data.mode} · difficulté ${data.difficulty} · version de sauvegarde ${data.version}`} />
    <div className="grid gap-4 xl:grid-cols-2">
      <Card title="Temps simulé"><Field label="Minutes simulées par seconde réelle à x1" hint="x1 = 1 min/s par défaut. Les vitesses x2…x100 multiplient ce ratio. Le moteur avance par pas fixes de 5 minutes : la vitesse ne change jamais le résultat économique."><input type="number" min={0.25} max={60} step={0.25} defaultValue={s.minutesPerSecond} onBlur={(e) => set({ minutesPerSecond: Number(e.target.value) })} className={inputCls} /></Field><div className="mt-3"><Toggle k="autoPauseImportant" label="Pause automatique sur événement important" hint="Décisions surprises des banques centrales, crises, appels de marge, réunions." /></div></Card>
      <Card title="Jeu"><div className="space-y-2"><Toggle k="explanations" label="Explications pédagogiques" hint="Affiche des conseils avant les opérations complexes et des indices en réunion." /><Toggle k="livingExpenses" label="Dépenses de vie fictives" hint="Loyer, transport et alimentation prélevés chaque mois (mode carrière)." disabled={data.mode !== "carriere"} /><Toggle k="allowShort" label="Vente à découvert sur le compte personnel" hint="Soumise à marge initiale (50 %) et de maintenance. Indisponible en difficulté Débutant." disabled={data.difficulty === "debutant"} /><Toggle k="aiEnabled" label="Dialogues IA des personnages" hint="Utilisés seulement si une clé API est configurée sur le serveur ; sinon dialogues scénarisés." /></div></Card>
      <Card title="Informations"><div className="space-y-1 text-sm"><div>Personnage : {data.profile.firstName} {data.profile.lastName} ({data.profile.nationality}, {data.profile.age} ans)</div><div>Formation : {data.profile.education}</div><div>Graine de simulation : <Badge>{data.seed}</Badge></div><div>Créée le {new Date(data.created).toLocaleString("fr-FR")} · date de jeu : {data.date}</div></div><Field label="Nom de la partie"><input defaultValue={data.name} onBlur={(e) => e.target.value && set({ name: e.target.value })} className={inputCls} /></Field></Card>
      <Card title="🔔 Notifications et ambiance"><Field label="Notifications affichées" hint="Les notifications répétées du même type sont regroupées (×3…)."><select data-testid="notif-level" defaultValue={s.notifLevel ?? "importantes"} onChange={(e) => set({ notifLevel: e.target.value })} className={inputCls}><option value="toutes">Toutes</option><option value="importantes">Importantes seulement (alertes, réussites, urgences)</option><option value="critiques">Urgences seulement</option></select></Field><Field label="Musique d'ambiance et effets sonores" hint="Ambiance discrète et sons d'interface (réussite, alerte, encaissement)."><select data-testid="sound-setting" defaultValue={s.sound === false ? "off" : "on"} onChange={(e) => set({ sound: e.target.value === "on" })} className={inputCls}><option value="on">Activés</option><option value="off">Coupés</option></select></Field></Card>
      <Card title="🔊 Son et voix des réunions"><SoundTest /></Card>
      <Card title="Avertissement"><p className="text-sm text-ink-300">FINANCIAL EMPIRE est une simulation pédagogique. Monnaie virtuelle, cotations fictives, aucune transaction réelle, aucun moyen de paiement. Le jeu n'est pas une plateforme de courtage et ne fournit aucun conseil en investissement.</p></Card>
    </div>
  </>;
}

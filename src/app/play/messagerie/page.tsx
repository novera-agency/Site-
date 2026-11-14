"use client";
import { useState } from "react";
import { useView, useAction } from "@/lib/hooks";
import { Card, PageTitle, Loading, Button, Empty, Badge } from "@/components/ui";
import { fmtDateTime } from "@/engine/time";

export default function Messagerie() {
  const { data, reload } = useView<any>("messages", {}, 4000);
  const act = useAction();
  const [sel, setSel] = useState<string | null>(null);
  if (!data) return <Loading />;
  const m = data.messages.find((x: any) => x.id === sel) ?? data.messages[0];
  return <>
    <PageTitle env="Bureau" title="Messagerie professionnelle" subtitle="Messages internes, recruteurs, clients et contacts. Certaines décisions ont des conséquences durables." />
    {data.messages.length === 0 ? <Empty>Boîte vide.</Empty> : <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      <Card pad={false}><ul className="divide-y divide-ink-800">{data.messages.map((x: any) => <li key={x.id}><button onClick={() => { setSel(x.id); if (!x.read) act({ type: "read", what: "messages", id: x.id }, { silent: true }); }} className={`w-full px-3 py-2 text-left hover:bg-ink-800 ${m?.id === x.id ? "bg-ink-800" : ""}`}><div className="flex justify-between text-xs"><span className={x.read ? "text-ink-400" : "font-semibold text-white"}>{x.from}</span><span className="num text-ink-500">{fmtDateTime(x.t).slice(0, 10)}</span></div><div className={`truncate text-sm ${x.read ? "text-ink-300" : "text-white"}`}>{x.subject}</div>{x.actions && !x.handled && <Badge tone="warn">décision attendue</Badge>}</button></li>)}</ul></Card>
      {m && <Card title={m.subject} right={fmtDateTime(m.t)}><div className="mb-2 text-xs text-ink-400">De : {m.from}</div><div className="whitespace-pre-line text-sm leading-relaxed text-ink-100">{m.body}</div>{m.actions && !m.handled && <div className="mt-4 flex flex-wrap gap-2">{m.actions.map((a: any) => <Button key={a.action} onClick={async () => { await act({ type: "message_action", messageId: m.id, action: a.action, payload: a.payload }); reload(); }}>{a.label}</Button>)}</div>}</Card>}
    </div>}
  </>;
}

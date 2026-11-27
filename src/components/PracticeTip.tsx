"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

const KEY = "fe_tip_practice";
/** Mode d'emploi de l'apprentissage par la pratique : affiché jusqu'à ce que le joueur le ferme */
export function PracticeTip() {
  const [show, setShow] = useState(false);
  useEffect(() => { try { setShow(localStorage.getItem(KEY) !== "1"); } catch { setShow(true); } }, []);
  if (!show) return null;
  const close = () => { try { localStorage.setItem(KEY, "1"); } catch { /* */ } setShow(false); };
  return <aside data-testid="practice-tip" aria-label="Comment apprendre ici" className="mb-4 rounded-xl border border-gold/40 bg-gradient-to-r from-yellow-900/20 to-transparent p-4">
    <div className="flex items-start justify-between gap-3"><h2 className="text-sm font-semibold text-gold">Ici, on apprend en faisant</h2><button type="button" data-testid="practice-tip-close" onClick={close} className="rounded bg-ink-700 px-2 py-0.5 text-xs text-ink-100 hover:bg-ink-600">Compris ✕</button></div>
    <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink-100">
      <li>Vos missions sont des <b>cas concrets</b> : un calcul à faire, un ordre à passer, un risque à réduire. Pas de cours à lire avant.</li>
      <li>Un mot vous bloque ? <b>Touchez-le</b> (souligné en pointillés) : définition en mots simples et exemple. Une question vous bloque ? Bouton <b>🤔 Je ne comprends pas</b> : la question autrement, la méthode, deux exemples résolus.</li>
      <li>Votre bilan de pratique est dans <Link href="/play/competences" className="text-accent underline">Compétences</Link> : les types de problèmes que vous ratez reviennent plus souvent, jusqu'à les maîtriser.</li>
      <li>Envie de vous tester en conditions réelles ? Les <b>défis de crise</b> (krach, panique bancaire, choc de taux…) vous mettent aux commandes avec un bilan commenté à la fin.</li>
    </ol>
  </aside>;
}

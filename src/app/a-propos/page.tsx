import { FeedbackBox } from "@/components/FeedbackBox";
import Link from "next/link";
export default function About() {
  return <div className="mx-auto max-w-3xl space-y-4 p-6 text-sm leading-relaxed text-ink-200">
    <h1 className="text-2xl font-semibold text-white">À propos de FINANCIAL EMPIRE</h1>
    <p>FINANCIAL EMPIRE est une simulation pédagogique. Toutes les sociétés, banques, personnes, cotations et cryptoactifs sont fictifs. L&apos;argent du jeu est virtuel : il n&apos;existe aucun dépôt, aucun paiement, aucune conversion possible en monnaie réelle.</p>
    <p>Le moteur de marché est un modèle stochastique multi-facteurs (régimes de marché markoviens, volatilité variable, corrélations, facteurs macroéconomiques, chocs d&apos;actualité). Il vise la crédibilité pédagogique, pas la reproduction des marchés réels. Aucun cours affiché n&apos;est une cotation réelle.</p>
    <p className="font-semibold text-gold">Simulation — monnaie virtuelle — aucune transaction réelle.</p>
    <FeedbackBox />
    <Link href="/" className="text-accent">← Retour</Link>
  </div>;
}

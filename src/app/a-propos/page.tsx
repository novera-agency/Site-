import Link from "next/link";
export default function About() {
  return <div className="mx-auto max-w-3xl space-y-4 p-6 text-sm leading-relaxed text-ink-200">
    <h1 className="text-2xl font-semibold text-white">À propos de FINANCIAL EMPIRE</h1>
    <p>FINANCIAL EMPIRE est une simulation pédagogique. Toutes les sociétés, banques, personnes, cotations et cryptoactifs sont fictifs. L&apos;argent du jeu est virtuel : il n&apos;existe aucun dépôt, aucun paiement, aucune conversion possible en monnaie réelle.</p>
    <p>Le moteur de marché est un modèle stochastique multi-facteurs (régimes de marché markoviens, volatilité variable, corrélations, facteurs macroéconomiques, chocs d&apos;actualité). Il vise la crédibilité pédagogique, pas la reproduction des marchés réels. Aucun cours affiché n&apos;est une cotation réelle.</p>
    <p className="font-semibold text-gold">Simulation — monnaie virtuelle — aucune transaction réelle.</p>
    <section aria-labelledby="credits" className="rounded-lg border border-ink-700 bg-ink-900/60 p-4">
      <h2 id="credits" className="text-base font-semibold text-white">Crédits des ressources 3D</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>Personnage 3D : avatar <i>Ready Player Me</i> (fichier d&apos;exemple du dépôt three.js, MIT), utilisé ici sous les conditions de Ready Player Me (licence CC BY-NC 4.0 pour un usage non commercial). Les couleurs du costume, la peau, les cheveux, la cravate et les accessoires sont recréés par code ; les animations (marche, course, gestes, assise) sont générées en direct, sans fichier d&apos;animation externe.</li>
        <li>Moteur 3D : <a className="text-accent underline" href="https://threejs.org" rel="noreferrer">three.js</a> (MIT). Décors (hall, ascenseurs, atelier du tailleur) : modélisés par code.</li>
      </ul>
      <p className="mt-2 text-xs text-ink-400">Ce jeu est un projet non commercial. Voir aussi public/models/LICENSES.md dans le dépôt.</p>
    </section>
    <Link href="/" className="text-accent">← Retour</Link>
  </div>;
}

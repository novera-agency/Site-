/** Organisation unique des écrans : 5 catégories, utilisées par la barre du bas (mobile) et le menu latéral (ordinateur). */
export interface NavItem { href: string; label: string; icon: string; desc: string; badge?: "missions" | "msgs" | "meeting" }
export interface NavSection { title?: string; items: NavItem[] }
export interface NavCategory { id: string; label: string; short: string; icon: string; intro: string; hub: string; sections: NavSection[] }

export const CATEGORIES: NavCategory[] = [
  {
    id: "bureau", hub: "/play", label: "Bureau", short: "Bureau", icon: "🏢", intro: "Votre journée : ce qui vous attend aujourd'hui.",
    sections: [{ items: [
      { href: "/play", label: "Mon bureau", icon: "🏢", desc: "Résumé de la journée et prochains rendez-vous" },
      { href: "/play/missions", label: "Missions", icon: "🎯", desc: "Les tâches du jour confiées par votre hiérarchie", badge: "missions" },
      { href: "/play/agenda", label: "Agenda", icon: "🗓️", desc: "Votre emploi du temps" },
      { href: "/play/reunions", label: "Réunions", icon: "🤝", desc: "Rejoindre ou relire vos réunions", badge: "meeting" },
      { href: "/play/messagerie", label: "Messagerie", icon: "✉️", desc: "Messages et décisions à prendre", badge: "msgs" },
      { href: "/play/actualites", label: "Actualités", icon: "📰", desc: "Ce qui fait bouger les marchés" },
    ] }],
  },
  {
    id: "pro", hub: "/play/pro", label: "Vie professionnelle", short: "Vie pro", icon: "💼", intro: "Marchés, portefeuilles et progression de carrière.",
    sections: [
      { title: "Marchés", items: [
        { href: "/play/terminal", label: "Salle des marchés", icon: "📈", desc: "Cours en direct et graphiques" },
        { href: "/play/recherche", label: "Rechercher un titre", icon: "🔎", desc: "Plus de 1 200 actions, ETF, obligations…" },
        { href: "/play/ordres", label: "Passer un ordre", icon: "🧾", desc: "Acheter ou vendre" },
        { href: "/play/options", label: "Options", icon: "🎛️", desc: "Chaînes d'options et grecques" },
        { href: "/play/structures", label: "Produits structurés", icon: "🧩", desc: "Autocalls, capital protégé…" },
      ] },
      { title: "Portefeuille et risques", items: [
        { href: "/play/portefeuille", label: "Portefeuille", icon: "💼", desc: "Vos positions et le book du desk" },
        { href: "/play/transactions", label: "Transactions", icon: "📒", desc: "Historique et grand livre" },
        { href: "/play/risques", label: "Risques", icon: "🛡️", desc: "VaR, limites, scénarios de crise" },
      ] },
      { title: "Économie", items: [
        { href: "/play/calendrier", label: "Calendrier économique", icon: "📅", desc: "Publications et banques centrales" },
        { href: "/play/macro", label: "Macroéconomie", icon: "🌍", desc: "Croissance, inflation, taux par zone" },
      ] },
      { title: "Carrière", items: [
        { href: "/play/carriere", label: "Ma carrière", icon: "🏆", desc: "Évaluations, promotion, objectifs" },
        { href: "/play/competences", label: "Compétences", icon: "🧠", desc: "Vos points forts à développer" },
        { href: "/play/formation", label: "Formation", icon: "🎓", desc: "Modules pour apprendre la finance" },
        { href: "/play/dictionnaire", label: "Dictionnaire", icon: "📖", desc: "Définitions des termes financiers" },
        { href: "/play/entreprise", label: "Créer sa société", icon: "🚀", desc: "Entrepreneuriat" },
      ] },
    ],
  },
  {
    id: "perso", hub: "/play/perso", label: "Vie personnelle", short: "Vie perso", icon: "🏠", intro: "Votre argent et votre équilibre en dehors du bureau.",
    sections: [{ items: [
      { href: "/play/vie", label: "Vie privée", icon: "🏠", desc: "Santé mentale, loisirs, logement, factures" },
      { href: "/play/remuneration", label: "Salaire", icon: "💶", desc: "Fiche de paie, bonus, grille salariale" },
      { href: "/play/immobilier", label: "Investissement immobilier", icon: "🏘️", desc: "Acheter, louer, revendre dans 13 villes" },
      { href: "/play/patrimoine", label: "Patrimoine", icon: "🏦", desc: "Épargne, placements, immobilier" },
    ] }],
  },
  {
    id: "relations", hub: "/play/relations", label: "Relations", short: "Relations", icon: "👥", intro: "Les personnes qui comptent dans votre carrière.",
    sections: [{ items: [
      { href: "/play/reseau", label: "Collègues et réseau", icon: "🕸️", desc: "Ce que chacun pense de vous" },
      { href: "/play/clients", label: "Clients", icon: "👥", desc: "Appeler, conseiller, fidéliser" },
      { href: "/play/reputation", label: "Réputation", icon: "⭐", desc: "Votre image et vos décisions passées" },
      { href: "/play/rh", label: "Ressources humaines", icon: "📋", desc: "Congés, offres d'emploi, démission" },
      { href: "/play/banques", label: "Établissements", icon: "🏛️", desc: "Les banques et leurs cultures" },
    ] }],
  },
  {
    id: "options", hub: "/play/reglages", label: "Options", short: "Options", icon: "⚙️", intro: "Réglages de la partie.",
    sections: [{ items: [
      { href: "/play/parametres", label: "Paramètres et son", icon: "⚙️", desc: "Vitesse, aides, test des voix" },
      { href: "/play/sauvegardes", label: "Sauvegardes", icon: "💾", desc: "Sauvegarder, charger, exporter" },
      { href: "/", label: "Menu principal", icon: "🚪", desc: "Quitter la partie (elle est sauvegardée)" },
    ] }],
  },
];

const norm = (p: string) => (p.length > 1 ? p.replace(/\/$/, "") : p);
/** Catégorie de la page courante */
export function categoryOf(path: string): string {
  const p = norm(path);
  if (p.startsWith("/play/actif")) return "pro";
  for (const c of CATEGORIES) if (norm(c.hub) === p) return c.id;
  for (const c of CATEGORIES) for (const s of c.sections) for (const it of s.items) if (norm(it.href) === p) return c.id;
  return "bureau";
}
export function itemOf(path: string): NavItem | undefined {
  const p = norm(path);
  for (const c of CATEGORIES) for (const s of c.sections) for (const it of s.items) if (norm(it.href) === p) return it;
  return undefined;
}

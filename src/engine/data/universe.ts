/**
 * Univers étendu : plus de 1 100 sociétés cotées FICTIVES, générées de façon déterministe (identiques dans toutes les parties).
 * Répartition calquée sur une cote mondiale réelle : pays, poids sectoriels, distribution des capitalisations
 * (beaucoup de petites valeurs, peu de géants), fondamentaux cohérents par secteur (PER, marges, dividendes, volatilité, bêta).
 * Les noms sont inventés par assemblage de syllabes ; toute ressemblance avec une société existante serait fortuite.
 */
import type { Sector } from "../types";

export type Ctry = "FR" | "DE" | "NL" | "IT" | "ES" | "CH" | "UK" | "US" | "JP" | "CN" | "KR" | "IN" | "BR";
/** [ticker, nom, secteur, pays, actions(M), CA(M), marge, dette nette(M), payout, croissance, PER, vol, bêta, liquidité, description, perspectives, risques] */
export type GenRow = [string, string, Sector, Ctry, number, number, number, number, number, number, number, number, number, number, string, string, string[]];

// Générateur pseudo-aléatoire déterministe (indépendant de la graine de partie)
function mulberry(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** Nombre de sociétés générées par pays */
const COUNTS: Record<Ctry, number> = { US: 520, FR: 80, DE: 70, UK: 110, CH: 35, NL: 25, IT: 35, ES: 30, JP: 110, CN: 70, KR: 20, IN: 25, BR: 15 };
/** Capitalisation médiane (milliards USD) : les cotes américaine et japonaise comptent plus de grandes valeurs */
const CAP_MED: Record<Ctry, number> = { US: 9, FR: 6, DE: 6, UK: 4, CH: 8, NL: 6, IT: 3, ES: 3.5, JP: 4, CN: 6, KR: 4, IN: 5, BR: 3 };
/** Prix de l'action en devise locale pour 1 USD de valeur « typique » (les actions japonaises/coréennes cotent en milliers) */
const PX_SCALE: Record<Ctry, number> = { US: 1, FR: 0.92, DE: 0.92, UK: 0.79, CH: 0.88, NL: 0.92, IT: 0.92, ES: 0.92, JP: 150, CN: 7.2, KR: 1, IN: 1, BR: 1 };
/** Devise des comptes (CA, dette) par rapport au dollar */
const FX_LOCAL: Record<Ctry, number> = { US: 1, FR: 0.92, DE: 0.92, UK: 0.79, CH: 0.88, NL: 0.92, IT: 0.92, ES: 0.92, JP: 150, CN: 7.2, KR: 1, IN: 1, BR: 1 };

const SECTOR_W: Record<Ctry, Partial<Record<Sector, number>>> = {
  US: { Technologie: 26, Santé: 13, Banque: 10, Distribution: 10, Industrie: 10, Énergie: 6, Télécoms: 4, Immobilier: 5, Assurance: 5, Automobile: 3, Matériaux: 5, Luxe: 3 },
  FR: { Luxe: 10, Industrie: 20, Banque: 8, Assurance: 6, Énergie: 6, Santé: 8, Distribution: 10, Télécoms: 5, Automobile: 6, Immobilier: 7, Matériaux: 6, Technologie: 8 },
  DE: { Industrie: 25, Automobile: 12, Technologie: 12, Matériaux: 10, Banque: 6, Assurance: 7, Santé: 8, Distribution: 7, Énergie: 5, Télécoms: 4, Immobilier: 4 },
  UK: { Banque: 12, Énergie: 10, Matériaux: 12, Distribution: 12, Santé: 8, Assurance: 8, Industrie: 12, Télécoms: 5, Immobilier: 8, Technologie: 8, Luxe: 3 },
  CH: { Santé: 25, Banque: 15, Assurance: 12, Luxe: 10, Industrie: 15, Matériaux: 8, Distribution: 7, Technologie: 8 },
  NL: { Technologie: 25, Distribution: 15, Banque: 12, Industrie: 15, Assurance: 10, Matériaux: 10, Énergie: 5, Santé: 8 },
  IT: { Banque: 20, Énergie: 12, Luxe: 12, Assurance: 10, Industrie: 15, Automobile: 8, Télécoms: 6, Distribution: 7, Immobilier: 5, Technologie: 5 },
  ES: { Banque: 20, Énergie: 15, Télécoms: 10, Industrie: 15, Distribution: 10, Immobilier: 10, Assurance: 7, Technologie: 5, Santé: 8 },
  JP: { Industrie: 22, Automobile: 12, Technologie: 20, Banque: 8, Distribution: 10, Santé: 8, Matériaux: 8, Télécoms: 5, Immobilier: 5, Assurance: 2 },
  CN: { Technologie: 20, Banque: 15, Immobilier: 10, Distribution: 12, Industrie: 12, Énergie: 8, Automobile: 8, Matériaux: 8, Santé: 7 },
  KR: { Technologie: 40, Automobile: 15, Industrie: 20, Matériaux: 10, Banque: 10, Distribution: 5 },
  IN: { Technologie: 30, Banque: 25, Distribution: 10, Industrie: 10, Énergie: 10, Santé: 10, Matériaux: 5 },
  BR: { Énergie: 25, Matériaux: 25, Banque: 25, Distribution: 10, Industrie: 10, Télécoms: 5 },
};

/** Fourchettes par secteur : PER, marge nette, vol, bêta, payout, croissance, dette nette / CA */
const SEC: Record<Sector, { pe: [number, number]; margin: [number, number]; vol: [number, number]; beta: [number, number]; payout: [number, number]; growth: [number, number]; debt: [number, number] }> = {
  Technologie: { pe: [15, 45], margin: [0.05, 0.3], vol: [0.28, 0.6], beta: [1.0, 1.5], payout: [0, 0.3], growth: [0.05, 0.25], debt: [-0.3, 0.2] },
  Banque: { pe: [6, 12], margin: [0.1, 0.25], vol: [0.22, 0.4], beta: [1.1, 1.5], payout: [0.3, 0.6], growth: [0, 0.05], debt: [0, 0] },
  Assurance: { pe: [8, 15], margin: [0.05, 0.12], vol: [0.16, 0.28], beta: [0.7, 1.0], payout: [0.4, 0.7], growth: [0.01, 0.05], debt: [0, 0] },
  Industrie: { pe: [12, 25], margin: [0.05, 0.14], vol: [0.2, 0.36], beta: [0.9, 1.3], payout: [0.25, 0.5], growth: [0.02, 0.08], debt: [0, 0.5] },
  Énergie: { pe: [6, 15], margin: [0.05, 0.15], vol: [0.22, 0.42], beta: [0.8, 1.2], payout: [0.3, 0.6], growth: [-0.02, 0.05], debt: [0.1, 0.6] },
  Santé: { pe: [14, 35], margin: [0.08, 0.25], vol: [0.16, 0.5], beta: [0.5, 1.0], payout: [0, 0.55], growth: [0.03, 0.15], debt: [0, 0.5] },
  Luxe: { pe: [18, 40], margin: [0.1, 0.28], vol: [0.2, 0.36], beta: [0.9, 1.2], payout: [0.3, 0.5], growth: [0.04, 0.1], debt: [-0.1, 0.3] },
  Distribution: { pe: [10, 30], margin: [0.02, 0.06], vol: [0.16, 0.32], beta: [0.5, 0.95], payout: [0.3, 0.6], growth: [0.01, 0.08], debt: [0, 0.3] },
  Télécoms: { pe: [8, 16], margin: [0.05, 0.12], vol: [0.15, 0.26], beta: [0.5, 0.8], payout: [0.5, 0.8], growth: [-0.01, 0.03], debt: [0.5, 1.5] },
  Automobile: { pe: [5, 12], margin: [0.03, 0.09], vol: [0.25, 0.42], beta: [1.0, 1.4], payout: [0.2, 0.4], growth: [0, 0.06], debt: [0.2, 0.6] },
  Immobilier: { pe: [10, 22], margin: [0.2, 0.45], vol: [0.2, 0.33], beta: [0.8, 1.1], payout: [0.7, 0.95], growth: [0, 0.04], debt: [3, 7] },
  Matériaux: { pe: [7, 16], margin: [0.05, 0.15], vol: [0.25, 0.42], beta: [1.0, 1.4], payout: [0.3, 0.6], growth: [0, 0.05], debt: [0.1, 0.5] },
};

type Lang = "fr" | "de" | "en" | "it" | "es" | "nl" | "jp" | "cn" | "kr" | "in" | "br";
const LANG: Record<Ctry, Lang> = { FR: "fr", DE: "de", CH: "de", UK: "en", US: "en", NL: "nl", IT: "it", ES: "es", JP: "jp", CN: "cn", KR: "kr", IN: "in", BR: "br" };
const SYL: Record<Lang, [string[], string[]]> = {
  fr: [["Ver", "Mont", "Bel", "Cha", "Lu", "Sa", "Mar", "Val", "Ros", "Gal", "Bre", "Ari", "Cor", "Dau", "Fon", "Jou", "Lan", "Mer", "Nor", "Pra", "Quin", "Riv", "Sol", "Tal", "Vau", "Aub", "Clo", "Esc", "Gir", "Hau"], ["vie", "tal", "mont", "lis", "nac", "sac", "vent", "ville", "ris", "dor", "lac", "bert", "mard", "tier", "gny", "val", "rac", "zon", "lieu", "roy", "mas", "seau"]],
  de: [["Hoch", "Stern", "Wald", "Berg", "Rhein", "Nord", "Kraft", "Licht", "Eisen", "Weiss", "Fels", "Brunn", "Linden", "Adler", "Falk", "Hammer", "Kessel", "Sonnen", "Tann", "Wolf"], ["mann", "werk", "hof", "bach", "stein", "burg", "feld", "haus", "tal", "dorf", "brück", "wald", "eck", "au"]],
  en: [["Ash", "Brook", "Cedar", "Clear", "Crest", "Ever", "Fair", "Glen", "Grand", "Harbor", "High", "Iron", "Lake", "Maple", "North", "Oak", "Pine", "River", "Rock", "Silver", "Star", "Summit", "Sun", "West", "Wolf", "Amber", "Bright", "Cobalt", "Copper", "Falcon", "Granite", "Hawk", "Juniper", "Kestrel", "Lumen", "Meridian", "Nova", "Orchard", "Pioneer", "Quarry", "Raven", "Sable", "Thistle", "Vale", "Willow", "Zenith"], ["field", "ford", "gate", "ton", "wood", "well", "bridge", "view", "point", "mark", "line", "haven", "ridge", "dale", "way", "crest", "moor", "port", "vale", "wick"]],
  it: [["Ro", "Fe", "Ma", "Lu", "Ve", "To", "Ca", "Pa", "Si", "Bo", "Gra", "Mon", "Ser", "Tor", "Ar"], ["sari", "lini", "netti", "dena", "valli", "ranti", "gnoli", "marca", "vello", "bardi", "cchio", "renza"]],
  es: [["Al", "Bar", "Cas", "Mon", "San", "Val", "Ver", "Sol", "Tor", "Ri", "Can"], ["cera", "toro", "nueva", "mar", "dosa", "rillo", "vega", "llano", "sierra", "dalia"]],
  nl: [["Van", "Oost", "Zee", "Hol", "Dijk", "Wester", "Ber", "Grev", "Lin"], ["stra", "land", "berg", "haven", "veld", "dam", "hoek", "mond"]],
  jp: [["Asa", "Fuji", "Hiro", "Kawa", "Naka", "Oka", "Taka", "Yama", "Kita", "Shima", "Sora", "Hana", "Mori", "Tsuki", "Kaze", "Aoi"], ["moto", "no", "ta", "shi", "ka", "zawa", "gawa", "mura", "saki", "hara", "kura", "yama"]],
  cn: [["Hua", "Zhong", "Jin", "Long", "Tian", "Xin", "Hong", "Guang", "Hai", "Feng", "Rui", "Bao"], ["xing", "tai", "sheng", "yuan", "da", "an", "kang", "fu", "rong", "ming"]],
  kr: [["Han", "Dae", "Sam", "Hyun", "Seo", "Kum", "Shin", "Jin"], ["jin", "sung", "woo", "il", "do", "kwang", "yeon"]],
  in: [["Bha", "Raj", "Sur", "Kri", "Vi", "Ma", "Shri", "Ana", "Deva", "Indra"], ["rat", "esh", "ya", "dha", "jay", "nova", "pur", "veda", "tara"]],
  br: [["Ita", "Bra", "Ama", "Cer", "Rio", "Sol", "Pau", "Ver"], ["sil", "zonia", "rado", "verde", "mar", "lista", "nordeste"]],
};
const WORD: Record<Lang, Partial<Record<Sector, string[]>> & { _: string[] }> = {
  fr: { _: ["Groupe", "SA", "Industries"], Technologie: ["Systèmes", "Numérique", "Logiciels", "Data"], Banque: ["Banque", "Crédit", "Financière"], Assurance: ["Assurances", "Prévoyance", "Mutuelle Cotée"], Énergie: ["Énergies", "Pétrole", "Renouvelables"], Santé: ["Pharma", "Santé", "Biotech", "Diagnostics"], Luxe: ["Maison", "Joaillerie", "Parfums"], Distribution: ["Distribution", "Commerce", "Restauration"], Télécoms: ["Télécom", "Réseaux"], Automobile: ["Automobiles", "Équipementier"], Immobilier: ["Foncière", "Immobilier"], Matériaux: ["Matériaux", "Chimie", "Métaux"], Industrie: ["Industrie", "Aéronautique", "Ingénierie", "Construction"] },
  de: { _: ["AG", "Holding", "Gruppe"], Technologie: ["Software AG", "Technik", "Elektronik"], Banque: ["Bank", "Kredit AG"], Assurance: ["Versicherung", "Rück"], Énergie: ["Energie", "Stadtwerke AG"], Santé: ["Pharma", "Medizintechnik", "Biotech"], Luxe: ["Uhren", "Mode AG"], Distribution: ["Handel", "Markt AG"], Télécoms: ["Telekom", "Netz AG"], Automobile: ["Automobil", "Fahrzeugbau", "Zulieferer AG"], Immobilier: ["Immobilien", "Wohnen AG"], Matériaux: ["Chemie", "Stahl", "Werkstoffe"], Industrie: ["Maschinenbau", "Werke", "Anlagenbau"] },
  en: { _: ["Holdings", "Group", "Corp."], Technologie: ["Systems", "Software", "Semiconductor", "Networks", "Cloud", "Digital"], Banque: ["Bancorp", "Financial", "Capital", "Bank"], Assurance: ["Insurance", "Assurance", "Re"], Énergie: ["Energy", "Petroleum", "Resources", "Power"], Santé: ["Pharmaceuticals", "Therapeutics", "Medical", "Health", "Biosciences"], Luxe: ["Brands", "Jewelers", "Couture"], Distribution: ["Retail", "Foods", "Stores", "Outfitters", "Logistics"], Télécoms: ["Communications", "Telecom", "Wireless"], Automobile: ["Motors", "Automotive", "Mobility"], Immobilier: ["Realty", "Properties", "REIT"], Matériaux: ["Materials", "Chemicals", "Mining", "Metals"], Industrie: ["Industries", "Aerospace", "Machinery", "Engineering"] },
  it: { _: ["SpA", "Gruppo"], Banque: ["Banca", "Credito"], Assurance: ["Assicurazioni"], Énergie: ["Energia", "Petroli"], Luxe: ["Moda", "Gioielli"], Industrie: ["Industrie", "Meccanica"], Automobile: ["Motori"], Distribution: ["Commercio"], Télécoms: ["Telecomunicazioni"], Technologie: ["Sistemi"], Immobilier: ["Immobiliare"] },
  es: { _: ["SA", "Grupo"], Banque: ["Banco", "Caja"], Énergie: ["Energía", "Renovables"], Immobilier: ["Inmobiliaria"], Télécoms: ["Telecom"], Industrie: ["Construcciones", "Infraestructuras"], Distribution: ["Comercial"], Assurance: ["Seguros"], Technologie: ["Sistemas"], Santé: ["Farma"] },
  nl: { _: ["NV", "Groep", "Holding"], Technologie: ["Technologies", "Systems"], Banque: ["Bank"], Assurance: ["Verzekeringen"], Distribution: ["Retail"], Industrie: ["Industries"], Matériaux: ["Chemie"] },
  jp: { _: ["Holdings", "Corporation"], Technologie: ["Electric", "Electronics", "Precision"], Industrie: ["Heavy Industries", "Machinery", "Robotics"], Automobile: ["Motor", "Auto Parts"], Banque: ["Bank", "Financial Group"], Santé: ["Pharmaceutical"], Distribution: ["Trading", "Retail"], Matériaux: ["Chemical", "Steel"], Télécoms: ["Telecom"], Immobilier: ["Estate"], Assurance: ["Life"] },
  cn: { _: ["Group", "Holdings"], Technologie: ["Technology", "Digital"], Banque: ["Bank"], Immobilier: ["Properties", "Land"], Énergie: ["Energy", "Power"], Automobile: ["Motors", "Auto"], Distribution: ["Commerce"], Industrie: ["Industrial"], Matériaux: ["Materials"], Santé: ["Pharma"] },
  kr: { _: ["Corp."], Technologie: ["Electronics", "Semicon"], Automobile: ["Motors"], Industrie: ["Heavy Industries"], Matériaux: ["Chemical"], Banque: ["Financial"], Distribution: ["Retail"] },
  in: { _: ["Ltd."], Technologie: ["Infotech", "Software"], Banque: ["Finance", "Bank"], Distribution: ["Consumer"], Industrie: ["Industries"], Énergie: ["Energy"], Santé: ["Pharma"], Matériaux: ["Metals"] },
  br: { _: ["SA"], Énergie: ["Energia", "Petróleo"], Matériaux: ["Mineração", "Siderurgia"], Banque: ["Banco"], Distribution: ["Varejo"], Industrie: ["Industrial"], Télécoms: ["Telecom"] },
};
/** Assemblages à éviter (proches de marques réelles connues) */
const BLACKLIST = new Set(["Rockwell", "Fairfield", "Starbridge", "Sunpower", "Northpoint", "Oakwood", "Silverline", "Brookfield", "Glenmark", "Highmark", "Lakeview", "Westfield", "Rockport", "Sunway", "Clearview", "Westport", "Ashford", "Eversource", "Granite", "Summitview", "Sanmar", "Fujita", "Hanjin", "Samsung", "Hyundai", "Kawasaki", "Takashi", "Yamamoto", "Nakamura", "Okamoto"]);

const DESC: Record<Sector, [string[], string[], string[][]]> = {
  Technologie: [["Éditeur de logiciels pour entreprises", "Fabricant de composants électroniques", "Spécialiste de la cybersécurité", "Plateforme de services en ligne", "Concepteur de semi-conducteurs", "Intégrateur de systèmes informatiques", "Fournisseur d'équipements réseau"], ["Croissance soutenue des abonnements.", "Nouveaux contrats avec de grands comptes.", "Marges en amélioration.", "Investissements lourds en recherche."], [["Concurrence intense", "Valorisation élevée"], ["Cycle des semi-conducteurs"], ["Dépendance à quelques clients"], ["Rythme d'innovation"]]],
  Banque: [["Banque de détail régionale", "Banque commerciale", "Établissement de crédit à la consommation", "Banque d'investissement de taille moyenne", "Banque privée"], ["Marge d'intérêt stable.", "Coût du risque maîtrisé.", "Programme de rachat d'actions."], [["Qualité du crédit", "Exposition aux taux"], ["Risque réglementaire"], ["Exposition immobilière"]]],
  Assurance: [["Assureur dommages", "Assureur vie et épargne", "Courtier en assurances", "Réassureur de niche"], ["Tarifs en hausse.", "Solvabilité confortable.", "Collecte nette positive."], [["Sinistralité climatique"], ["Marchés financiers"], ["Concurrence tarifaire"]]],
  Industrie: [["Fabricant de machines industrielles", "Groupe de construction et concessions", "Équipementier aéronautique", "Spécialiste de l'automatisation", "Fabricant de matériel électrique", "Logisticien et transporteur", "Groupe de services à l'industrie"], ["Carnet de commandes solide.", "Gains de productivité.", "Contrats publics en hausse."], [["Cycle industriel"], ["Coût des matières premières"], ["Exécution des contrats"]]],
  Énergie: [["Producteur de pétrole et de gaz", "Raffineur", "Producteur d'électricité", "Développeur d'énergies renouvelables", "Services parapétroliers", "Distributeur de gaz"], ["Flux de trésorerie élevés.", "Investissements dans la transition.", "Dividende généreux."], [["Prix du pétrole"], ["Réglementation climatique"], ["Volatilité des prix de l'énergie"]]],
  Santé: [["Laboratoire pharmaceutique", "Biotech en phase clinique", "Fabricant de dispositifs médicaux", "Exploitant de cliniques", "Spécialiste du diagnostic", "Laboratoire de génériques"], ["Pipeline prometteur.", "Lancement d'un nouveau traitement.", "Croissance régulière."], [["Échecs cliniques"], ["Pression sur les prix"], ["Expiration de brevets"]]],
  Luxe: [["Maison de maroquinerie", "Joaillier", "Groupe de cosmétiques et parfums", "Horloger", "Maison de prêt-à-porter haut de gamme", "Producteur de vins et spiritueux"], ["Demande asiatique soutenue.", "Hausse des prix bien acceptée.", "Ouvertures de boutiques."], [["Ralentissement chinois"], ["Change"], ["Dépendance au tourisme"]]],
  Distribution: [["Chaîne de supermarchés", "Distributeur spécialisé", "Groupe de restauration", "Commerçant en ligne", "Fabricant de produits alimentaires", "Grossiste"], ["Parts de marché stables.", "Développement du commerce en ligne.", "Plan d'économies."], [["Marges faibles"], ["Consommation des ménages"], ["Concurrence des discounters"]]],
  Télécoms: [["Opérateur de téléphonie mobile", "Opérateur de fibre optique", "Gestionnaire d'infrastructures télécoms", "Groupe de médias et télécoms"], ["Flux de trésorerie stables.", "Déploiement de la fibre.", "Consolidation du marché."], [["Endettement"], ["Guerre des prix"], ["Régulation"]]],
  Automobile: [["Constructeur automobile", "Équipementier automobile", "Fabricant de pneumatiques", "Constructeur de véhicules utilitaires", "Fabricant de batteries"], ["Transition vers l'électrique.", "Reprise des volumes.", "Gamme renouvelée."], [["Concurrence chinoise"], ["Droits de douane"], ["Coût de la transition électrique"]]],
  Immobilier: [["Foncière de bureaux", "Foncière de commerces", "Promoteur immobilier", "Foncière logistique", "Bailleur résidentiel"], ["Taux d'occupation élevé.", "Loyers indexés.", "Cessions d'actifs."], [["Sensibilité aux taux"], ["Refinancement"], ["Vacance des bureaux"]]],
  Matériaux: [["Groupe chimique", "Sidérurgiste", "Producteur de ciment", "Groupe minier", "Producteur d'aluminium", "Fabricant d'emballages"], ["Prix de vente en hausse.", "Réduction des coûts énergétiques.", "Demande liée aux infrastructures."], [["Coûts de l'énergie"], ["Cyclicité"], ["Prix des métaux"]]],
};

const pick = <T,>(r: () => number, a: T[]) => a[Math.floor(r() * a.length)];
const range = (r: () => number, [a, b]: [number, number]) => a + (b - a) * r();
const norm = (r: () => number) => { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const cap1 = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Génère l'univers étendu (exclut les tickers déjà pris par l'univers de base) */
export function generateUniverse(taken: Set<string>): GenRow[] {
  const r = mulberry(20000103);
  const rows: GenRow[] = [];
  const names = new Set<string>();
  for (const ctry of Object.keys(COUNTS) as Ctry[]) {
    const lang = LANG[ctry];
    const weights = Object.entries(SECTOR_W[ctry]) as [Sector, number][];
    const tot = weights.reduce((a, [, w]) => a + w, 0);
    for (let i = 0; i < COUNTS[ctry]; i++) {
      // secteur
      let u = r() * tot, sector: Sector = weights[0][0];
      for (const [sec, w] of weights) { if ((u -= w) <= 0) { sector = sec; break; } }
      // nom
      let base = "", tries = 0;
      do {
        const [a, b] = SYL[lang];
        base = cap1(pick(r, a) + pick(r, b).toLowerCase());
        if (lang === "en" && r() < 0.25) base = pick(r, a) + " " + cap1(pick(r, b));
        tries++;
      } while ((names.has(base) || BLACKLIST.has(base.replace(" ", ""))) && tries < 50);
      names.add(base);
      const words = WORD[lang][sector] ?? WORD[lang]._;
      const name = `${base} ${pick(r, r() < 0.8 ? words : WORD[lang]._)}`;
      // ticker
      const letters = base.normalize("NFD").replace(/[^A-Za-z]/g, "").toUpperCase();
      let tk = letters.slice(0, 4);
      for (let k = 0; taken.has(tk) || tk.length < 3; k++) tk = (letters.slice(0, 3) + "ABCDEFGHJKLMNPRSTUVWXYZ"[k % 23] + (k >= 23 ? String(Math.floor(k / 23)) : "")).slice(0, 5);
      taken.add(tk);
      // taille : loi log-normale (queue épaisse : quelques géants)
      const capUsdBn = Math.min(900, Math.max(0.15, CAP_MED[ctry] * Math.exp(1.25 * norm(r))));
      const p = SEC[sector];
      const pe = range(r, p.pe) * (capUsdBn > 50 ? 1.1 : 1);
      const margin = range(r, p.margin);
      const px = Math.max(1, Math.exp(Math.log(15) + 1.1 * norm(r)) * (capUsdBn > 20 ? 2.5 : 1)) * PX_SCALE[ctry];
      const capLocalM = capUsdBn * 1000 * FX_LOCAL[ctry];
      const shares = Math.max(1, Math.round((capLocalM / px) * 10) / 10);
      const revenue = Math.round(capLocalM / (pe * margin));
      const debt = Math.round(revenue * range(r, p.debt));
      const small = capUsdBn < 2;
      const vol = Math.round(range(r, p.vol) * (small ? 1.25 : capUsdBn > 50 ? 0.85 : 1) * 100) / 100;
      const beta = Math.round(range(r, p.beta) * 100) / 100;
      const liquidity = Math.round(Math.min(0.98, Math.max(0.15, 0.35 + 0.17 * Math.log10(capUsdBn * 10))) * 100) / 100;
      const [descs, outs, risks] = DESC[sector];
      const capTxt = capUsdBn >= 200 ? "Géant mondial" : capUsdBn >= 10 ? "Grande capitalisation" : capUsdBn >= 2 ? "Valeur moyenne" : "Petite capitalisation";
      rows.push([tk, name, sector, ctry, shares, revenue, Math.round(margin * 1000) / 1000, debt, Math.round(range(r, p.payout) * 100) / 100, Math.round(range(r, p.growth) * 1000) / 1000, Math.round(pe * 10) / 10, vol, beta, liquidity,
        `${pick(r, descs)} (${capTxt.toLowerCase()}).`, pick(r, outs), pick(r, risks)]);
    }
  }
  return rows;
}

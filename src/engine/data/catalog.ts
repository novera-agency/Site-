/**
 * Univers d'instruments fictifs. Toutes les sociétés, banques et cryptoactifs sont INVENTÉS.
 * Les fondamentaux (CA, marges, dette) servent au calcul de la valeur fondamentale et des résultats.
 */
import type { Currency, InstrumentDef, Sector, ZoneId } from "../types";
import type { SessionId } from "../time";

type Ctry = "FR" | "DE" | "NL" | "IT" | "ES" | "CH" | "UK" | "US" | "JP" | "CN" | "KR" | "IN" | "BR";
const COUNTRY: Record<Ctry, { zone: ZoneId; cur: Currency; session: SessionId; label: string }> = {
  FR: { zone: "EZ", cur: "EUR", session: "EU", label: "France" },
  DE: { zone: "EZ", cur: "EUR", session: "EU", label: "Allemagne" },
  NL: { zone: "EZ", cur: "EUR", session: "EU", label: "Pays-Bas" },
  IT: { zone: "EZ", cur: "EUR", session: "EU", label: "Italie" },
  ES: { zone: "EZ", cur: "EUR", session: "EU", label: "Espagne" },
  CH: { zone: "EZ", cur: "CHF", session: "EU", label: "Suisse" },
  UK: { zone: "UK", cur: "GBP", session: "EU", label: "Royaume-Uni" },
  US: { zone: "US", cur: "USD", session: "US", label: "États-Unis" },
  JP: { zone: "JP", cur: "JPY", session: "ASIA", label: "Japon" },
  CN: { zone: "CN", cur: "CNY", session: "ASIA", label: "Chine" },
  KR: { zone: "EM", cur: "USD", session: "US", label: "Corée du Sud (ADR)" },
  IN: { zone: "EM", cur: "USD", session: "US", label: "Inde (ADR)" },
  BR: { zone: "EM", cur: "USD", session: "US", label: "Brésil (ADR)" },
};

// [ticker, nom, secteur, pays, actions(M), CA(M), marge, dette nette(M), payout, croissance, PER, vol, beta, liquidité, description, perspectives, risques, banque du jeu]
type Row = [string, string, Sector, Ctry, number, number, number, number, number, number, number, number, number, number, string, string, string[], string?];
const STOCKS: Row[] = [
  // Banques (dont celles du jeu)
  ["LUTB", "Banque Lutèce & Associés", "Banque", "FR", 800, 48000, 0.14, 0, 0.5, 0.02, 8, 0.27, 1.25, 0.9, "Grande banque universelle française, forte en banque de financement et d'investissement.", "Marges d'intérêt stables, BFI en croissance.", ["Exposition aux taux", "Risque réglementaire"], "lutece"],
  ["HDMP", "Hudson Meridian Partners", "Banque", "US", 1500, 52000, 0.22, 0, 0.3, 0.05, 12, 0.29, 1.35, 0.95, "Banque d'investissement américaine de premier rang (M&A, marchés).", "Reprise des opérations de fusions-acquisitions.", ["Cyclicité des commissions", "Risque de marché"], "hudson"],
  ["LAAR", "Lindqvist & Aar Banquiers Privés", "Banque", "CH", 120, 6200, 0.27, 0, 0.6, 0.03, 15, 0.2, 0.8, 0.6, "Banque privée suisse centenaire spécialisée dans la gestion de fortune.", "Collecte nette solide auprès des grandes fortunes.", ["Dépendance aux marchés", "Risque de réputation"], "lindqvist"],
  ["UBCE", "Union Bancaire Continentale", "Banque", "DE", 1900, 41000, 0.1, 0, 0.45, 0.01, 7.5, 0.3, 1.3, 0.85, "Banque universelle européenne basée à Francfort.", "Restructuration en cours, coûts en baisse.", ["Rentabilité faible", "Exposition immobilière"], "ubc"],
  ["SEIR", "Seiryu Markets Holdings", "Banque", "JP", 2100, 3_100_000, 0.15, 0, 0.35, 0.03, 10, 0.27, 1.2, 0.8, "Groupe asiatique spécialisé dans les marchés de capitaux.", "Normalisation monétaire favorable aux marges.", ["Risque de change", "Concurrence régionale"], "seiryu"],
  ["PCBK", "Pacific Crest Bancorp", "Banque", "US", 300, 5200, 0.2, 0, 0.35, 0.02, 9, 0.38, 1.5, 0.5, "Banque régionale américaine très exposée aux dépôts d'entreprises technologiques.", "Croissance des dépôts ralentie.", ["Portefeuille obligataire en moins-value", "Concentration des dépôts", "Risque de liquidité"], "pacific"],
  ["BADR", "Banca Adriatica", "Banque", "IT", 650, 14000, 0.12, 0, 0.5, 0.01, 7, 0.33, 1.4, 0.6, "Banque commerciale italienne de taille moyenne.", "Coût du risque en hausse.", ["Exposition à la dette souveraine italienne"], "adriatica"],
  ["ASGR", "Assurances Générales Rhodanienne", "Assurance", "FR", 700, 55000, 0.07, 0, 0.6, 0.02, 11, 0.2, 0.9, 0.7, "Assureur vie et dommages de premier plan.", "Hausse des taux favorable aux réinvestissements.", ["Catastrophes naturelles"]],
  ["HELV", "Helvetia Rück Global", "Assurance", "CH", 300, 42000, 0.08, 0, 0.6, 0.03, 13, 0.18, 0.75, 0.6, "Réassureur mondial.", "Tarification en hausse.", ["Sinistralité climatique"]],
  // Technologie
  ["NOVX", "Novexa Systems", "Technologie", "US", 7400, 210000, 0.27, -40000, 0.15, 0.12, 30, 0.32, 1.25, 1, "Leader mondial des semi-conducteurs pour l'intelligence artificielle.", "Demande en accélération pour les puces IA.", ["Valorisation élevée", "Tensions géopolitiques sur les chaînes d'approvisionnement"]],
  ["QBIT", "Qubitron Cloud", "Technologie", "US", 3600, 140000, 0.24, -20000, 0.1, 0.14, 32, 0.34, 1.3, 1, "Plateforme de cloud computing et logiciels d'entreprise.", "Migration vers le cloud soutenue.", ["Concurrence tarifaire", "Régulation antitrust"]],
  ["ORBI", "Orbis Social", "Technologie", "US", 2600, 160000, 0.33, -30000, 0.05, 0.1, 22, 0.36, 1.35, 1, "Réseaux sociaux et publicité en ligne.", "Monétisation de l'IA générative.", ["Régulation des données", "Dépendance publicitaire"]],
  ["HALO", "Halo Devices", "Technologie", "US", 15000, 390000, 0.25, -60000, 0.15, 0.06, 28, 0.26, 1.1, 1, "Appareils électroniques grand public et services.", "Cycle de renouvellement des terminaux.", ["Dépendance à la Chine", "Saturation du marché"]],
  ["VRTX", "Vertexa Software", "Technologie", "DE", 1200, 34000, 0.2, 2000, 0.3, 0.09, 30, 0.28, 1.2, 0.8, "Éditeur européen de progiciels de gestion (ERP).", "Transition vers l'abonnement achevée.", ["Exécution commerciale"]],
  ["LUMI", "Lumina Semiconductors", "Technologie", "NL", 400, 29000, 0.28, -3000, 0.3, 0.13, 30, 0.34, 1.35, 0.85, "Équipementier de lithographie pour l'industrie des puces.", "Carnet de commandes record.", ["Restrictions à l'export"]],
  ["PIXA", "Pixalia Interactive", "Technologie", "FR", 140, 2400, 0.12, 300, 0.1, 0.15, 25, 0.45, 1.4, 0.4, "PME cotée de jeux vidéo et réalité augmentée.", "Lancement d'un titre majeur attendu.", ["Retards de développement", "Concentration sur un titre"]],
  ["KAZE", "Kazemura Electronics", "Technologie", "JP", 1700, 9_000_000, 0.08, 400_000, 0.3, 0.04, 16, 0.27, 1.1, 0.8, "Conglomérat électronique japonais.", "Restructuration des activités de capteurs.", ["Yen fort"]],
  ["HNTE", "Hanjin Tech Electronics", "Technologie", "KR", 6000, 230000, 0.12, -20000, 0.2, 0.08, 13, 0.33, 1.25, 0.8, "Fabricant coréen de mémoires et d'écrans.", "Reprise du cycle des mémoires.", ["Cyclicité extrême"]],
  ["DRGN", "Longwei Digital", "Technologie", "CN", 9000, 600000, 0.16, -50000, 0.2, 0.1, 14, 0.38, 1.3, 0.8, "Plateforme chinoise de commerce en ligne et de paiement.", "Consommation intérieure en reprise.", ["Régulation chinoise", "Tensions commerciales"]],
  ["INFY2", "Indus Infotech", "Technologie", "IN", 4100, 19000, 0.18, -2000, 0.5, 0.09, 25, 0.25, 1.0, 0.7, "Société indienne de services informatiques.", "Contrats d'externalisation en hausse.", ["Pression salariale"]],
  // Énergie
  ["TERA", "TerraVolt Énergies", "Énergie", "FR", 2400, 210000, 0.08, 30000, 0.5, 0.01, 8, 0.24, 0.9, 0.9, "Major pétrolière et gazière en transition vers les renouvelables.", "Investissements massifs dans l'électricité verte.", ["Prix du pétrole", "Transition énergétique"]],
  ["APXO", "Apex Oil Corporation", "Énergie", "US", 4000, 340000, 0.1, 40000, 0.45, 0.01, 11, 0.27, 0.95, 0.95, "Producteur pétrolier intégré américain.", "Rachats d'actions soutenus.", ["Volatilité du brut"]],
  ["NRDW", "Nordwind Renewables", "Énergie", "DE", 600, 12000, 0.07, 9000, 0.3, 0.12, 22, 0.35, 1.1, 0.6, "Développeur de parcs éoliens offshore.", "Appels d'offres publics favorables.", ["Sensibilité aux taux", "Coûts des matériaux"]],
  ["NSPE", "North Sea Petroleum", "Énergie", "UK", 15000, 230000, 0.06, 45000, 0.5, 0.0, 9, 0.24, 0.9, 0.85, "Groupe pétrolier britannique.", "Dividende élevé.", ["Taxe exceptionnelle", "Prix du gaz"]],
  ["PTRB", "Petrobrasilia", "Énergie", "BR", 6500, 100000, 0.18, 30000, 0.5, 0.02, 5, 0.4, 1.2, 0.7, "Compagnie pétrolière brésilienne contrôlée par l'État.", "Production en hausse.", ["Risque politique", "Change BRL"]],
  // Santé
  ["CURA", "Curalis Pharma", "Santé", "FR", 1250, 45000, 0.2, 10000, 0.5, 0.04, 14, 0.18, 0.65, 0.85, "Laboratoire pharmaceutique diversifié.", "Pipeline en oncologie prometteur.", ["Expiration de brevets", "Échecs cliniques"]],
  ["BIOH", "BioHelix Therapeutics", "Santé", "US", 900, 21000, 0.18, 5000, 0.0, 0.18, 28, 0.42, 1.1, 0.7, "Biotech spécialisée dans les thérapies géniques.", "Décision réglementaire clé attendue.", ["Risque binaire réglementaire"]],
  ["MEDT", "Medtrona Devices", "Santé", "US", 1300, 34000, 0.16, 15000, 0.45, 0.05, 20, 0.2, 0.75, 0.8, "Dispositifs médicaux (cardiologie, diabète).", "Croissance stable.", ["Rappels de produits"]],
  ["ALPN", "Alpenrose Pharma", "Santé", "CH", 2200, 64000, 0.24, 20000, 0.55, 0.04, 16, 0.16, 0.6, 0.85, "Groupe pharmaceutique suisse.", "Plusieurs lancements de produits dans les deux ans.", ["Pression sur les prix"]],
  ["SAKU", "Sakura Life Sciences", "Santé", "JP", 1600, 4_000_000, 0.1, 500_000, 0.4, 0.04, 22, 0.22, 0.7, 0.7, "Pharmacie japonaise.", "Expansion américaine.", ["Endettement après acquisition"]],
  // Luxe
  ["MAIS", "Maison Valombre", "Luxe", "FR", 500, 86000, 0.2, 10000, 0.5, 0.07, 24, 0.24, 1.0, 0.95, "Premier groupe mondial du luxe (maroquinerie, mode, vins).", "Demande chinoise en reprise.", ["Ralentissement chinois", "Change"]],
  ["CHVR", "Chevreuse Haute Couture", "Luxe", "FR", 105, 14000, 0.28, -3000, 0.35, 0.09, 40, 0.24, 0.95, 0.8, "Maison de luxe ultra-premium.", "Pouvoir de fixation des prix exceptionnel.", ["Valorisation élevée"]],
  ["GLAC", "Glacier Horlogerie", "Luxe", "CH", 150, 11000, 0.17, 0, 0.4, 0.04, 20, 0.25, 0.95, 0.6, "Horloger suisse haut de gamme.", "Exportations stabilisées.", ["Franc suisse fort"]],
  ["BELL", "Bellaria Moda", "Luxe", "IT", 270, 3200, 0.13, 900, 0.3, 0.08, 18, 0.33, 1.05, 0.35, "PME italienne de prêt-à-porter haut de gamme.", "Ouverture de boutiques en Asie.", ["Taille limitée"]],
  // Distribution / conso
  ["CARV", "Carvalis Distribution", "Distribution", "FR", 750, 88000, 0.02, 9000, 0.6, 0.01, 12, 0.2, 0.7, 0.75, "Groupe de grande distribution alimentaire.", "Pression concurrentielle des discounters.", ["Marges faibles"]],
  ["MKTS", "MegaMart Stores", "Distribution", "US", 2700, 680000, 0.03, 40000, 0.35, 0.04, 30, 0.17, 0.55, 0.95, "Premier distributeur mondial.", "Croissance du e-commerce.", ["Coûts salariaux"]],
  ["PRCL", "Parcelio Logistics", "Distribution", "US", 1050, 610000, 0.06, 50000, 0.0, 0.1, 40, 0.3, 1.2, 1, "Commerce en ligne et logistique.", "Rentabilité du cloud logistique.", ["Régulation", "Coûts logistiques"]],
  ["BRTN", "Britannia Grocers", "Distribution", "UK", 7000, 70000, 0.03, 9000, 0.5, 0.02, 12, 0.19, 0.65, 0.7, "Supermarchés britanniques.", "Parts de marché stables.", ["Consommation britannique"]],
  // Industrie
  ["AERO", "Aerovia Industries", "Industrie", "FR", 790, 69000, 0.08, 1000, 0.3, 0.08, 28, 0.25, 1.05, 0.9, "Constructeur aéronautique européen.", "Carnet de commandes de 9 ans.", ["Chaîne d'approvisionnement"]],
  ["SIGA", "Sigmaris Elektrik", "Industrie", "DE", 790, 76000, 0.1, 20000, 0.45, 0.04, 17, 0.22, 1.0, 0.85, "Conglomérat industriel (automatismes, réseaux).", "Électrification des industries.", ["Cycle industriel"]],
  ["ATLS", "Atlas Heavy Machinery", "Industrie", "US", 500, 64000, 0.15, 30000, 0.3, 0.04, 16, 0.28, 1.15, 0.85, "Engins de chantier et mines.", "Plans d'infrastructures.", ["Cyclicité"]],
  ["TKRA", "Takara Robotics", "Industrie", "JP", 1300, 8_000_000, 0.09, 600_000, 0.3, 0.06, 18, 0.28, 1.15, 0.7, "Robotique industrielle.", "Automatisation des usines.", ["Demande chinoise"]],
  ["MTRA", "Metra Ferroviaire", "Industrie", "FR", 380, 17000, 0.03, 3000, 0.25, 0.05, 20, 0.33, 1.15, 0.4, "PME de matériel ferroviaire.", "Contrats publics en hausse.", ["Exécution des contrats", "Endettement"]],
  // Automobile
  ["VOLK", "Voltkraft Automobile", "Automobile", "DE", 500, 320000, 0.05, 150000, 0.3, 0.02, 5, 0.29, 1.2, 0.85, "Constructeur automobile généraliste allemand.", "Transition électrique coûteuse.", ["Concurrence chinoise", "Droits de douane"]],
  ["ELEC", "Electra Motors", "Automobile", "US", 3200, 100000, 0.08, -20000, 0.0, 0.18, 60, 0.55, 1.6, 1, "Constructeur de véhicules électriques.", "Robotaxis et stockage d'énergie.", ["Valorisation spéculative", "Guerre des prix"]],
  ["SHIN", "Shinkai Motor", "Automobile", "JP", 13000, 45_000_000, 0.09, 20_000_000, 0.35, 0.03, 9, 0.24, 1.0, 0.85, "Premier constructeur automobile japonais.", "Hybrides très demandés.", ["Yen", "Droits de douane américains"]],
  ["BYDN", "Huanyu Auto", "Automobile", "CN", 2900, 780000, 0.05, 50000, 0.2, 0.2, 18, 0.42, 1.3, 0.8, "Constructeur chinois de véhicules électriques et batteries.", "Expansion internationale rapide.", ["Guerre des prix", "Droits de douane"]],
  // Télécoms
  ["TELO", "Télorange Group", "Télécoms", "FR", 2650, 41000, 0.06, 28000, 0.7, 0.0, 12, 0.17, 0.6, 0.85, "Opérateur télécom européen.", "Consolidation du marché.", ["Endettement", "Concurrence"]],
  ["SKYW", "Skywire Communications", "Télécoms", "US", 4200, 135000, 0.12, 120000, 0.6, 0.01, 9, 0.18, 0.55, 0.9, "Opérateur américain mobile et fibre.", "Flux de trésorerie stables.", ["Dette élevée"]],
  // Immobilier / matériaux
  ["FONC", "Foncière Haussmann", "Immobilier", "FR", 140, 2400, 0.4, 14000, 0.85, 0.01, 14, 0.27, 1.0, 0.55, "Foncière de bureaux parisiens.", "Taux d'occupation en reprise.", ["Sensibilité aux taux", "Télétravail"]],
  ["SKYL", "Skyline REIT", "Immobilier", "US", 900, 9000, 0.3, 30000, 0.9, 0.02, 20, 0.28, 1.05, 0.65, "Foncière commerciale américaine (bureaux, entrepôts).", "Logistique dynamique.", ["Bureaux vacants", "Refinancement"]],
  ["CIME", "Cimentis Matériaux", "Matériaux", "CH", 560, 28000, 0.12, 9000, 0.5, 0.03, 14, 0.24, 1.05, 0.7, "Cimentier mondial.", "Décarbonation des procédés.", ["Coûts énergétiques"]],
  ["ACER", "Acerro Steel", "Matériaux", "IT", 900, 22000, 0.05, 6000, 0.3, 0.01, 7, 0.36, 1.3, 0.5, "Sidérurgiste européen.", "Protection douanière européenne.", ["Prix de l'énergie", "Cyclicité"]],
  ["MINX", "Minerva Mining", "Matériaux", "UK", 1300, 54000, 0.18, 15000, 0.6, 0.02, 9, 0.3, 1.2, 0.85, "Groupe minier (cuivre, fer).", "Demande de cuivre liée à l'électrification.", ["Prix des métaux", "Chine"]],
];

function makeStock(r: Row): InstrumentDef {
  const [id, name, sector, ctry, shares, revenue, margin, debt, payout, growth, pe, vol, beta, liquidity, description, outlook, risks, bankId] = r;
  const c = COUNTRY[ctry];
  return {
    id, name, cls: "action", currency: c.cur, session: c.session, zone: c.zone, sector, country: c.label,
    vol, beta, sectorBeta: 0.8, liquidity, baseSpreadBps: Math.round(3 + (1 - liquidity) * 25),
    shares, revenue, margin, debt, payout, growth, fairPE: pe, description, outlook, risks, issuerOf: bankId,
  };
}

export function stockInitialPrice(d: InstrumentDef) {
  const eps = (d.revenue! * d.margin!) / d.shares!;
  return { eps, price: eps * d.fairPE! };
}

const BONDS: InstrumentDef[] = [];
function bond(id: string, name: string, issuer: string, zone: ZoneId, cur: Currency, coupon: number, years: number, rating: string, gov: boolean, spreadBps: number, opts: Partial<InstrumentDef["bond"]> = {}, liquidity = 0.8) {
  const maturityDay = Math.round(3 + years * 365);
  BONDS.push({
    id, name, cls: "obligation", currency: cur, session: cur === "USD" ? "US" : cur === "JPY" ? "ASIA" : "EU", zone, vol: 0, beta: 0, liquidity, baseSpreadBps: gov ? 2 : 8 + spreadBps / 40,
    bond: { issuer, couponRate: coupon, maturityDay, freq: cur === "USD" ? 2 : 1, rating, gov, nominal: 1000, spreadBps, ...opts },
    description: `${gov ? "Obligation d'État" : "Obligation d'entreprise"} ${issuer}, coupon ${(coupon * 100).toFixed(2)} %, échéance ${2027 + Math.floor(years)}. Notation ${rating}.`,
  });
}
bond("US2Y", "Trésor US 2 ans 3,50 %", "Trésor américain", "US", "USD", 0.035, 2, "AA+", true, 0, {}, 1);
bond("US10Y", "Trésor US 10 ans 4,00 %", "Trésor américain", "US", "USD", 0.04, 10, "AA+", true, 0, {}, 1);
bond("US30Y", "Trésor US 30 ans 4,50 %", "Trésor américain", "US", "USD", 0.045, 30, "AA+", true, 0, {}, 0.9);
bond("DE2Y", "Allemagne 2 ans 2,00 %", "République fédérale d'Allemagne", "EZ", "EUR", 0.02, 2, "AAA", true, 0, {}, 1);
bond("DE10Y", "Allemagne 10 ans 2,50 %", "République fédérale d'Allemagne", "EZ", "EUR", 0.025, 10, "AAA", true, 0, {}, 1);
bond("FR10Y", "France OAT 10 ans 3,25 %", "République française", "EZ", "EUR", 0.0325, 10, "AA-", true, 75, {}, 0.95);
bond("IT10Y", "Italie BTP 10 ans 3,75 %", "République italienne", "EZ", "EUR", 0.0375, 10, "BBB", true, 110, {}, 0.9);
bond("UK10Y", "Gilt britannique 10 ans 4,25 %", "Royaume-Uni", "UK", "GBP", 0.0425, 10, "AA", true, 0, {}, 0.95);
bond("JP10Y", "JGB Japon 10 ans 1,50 %", "Japon", "JP", "JPY", 0.015, 10, "A+", true, 0, {}, 0.9);
bond("LUTB30", "Banque Lutèce 4,00 % 2030", "Banque Lutèce & Associés", "EZ", "EUR", 0.04, 3.5, "A", false, 110, { issuerStock: "LUTB" }, 0.7);
bond("HDMP32", "Hudson Meridian 5,25 % 2032", "Hudson Meridian Partners", "US", "USD", 0.0525, 5.5, "A-", false, 130, { issuerStock: "HDMP" }, 0.7);
bond("PCBK29", "Pacific Crest 7,50 % 2029", "Pacific Crest Bancorp", "US", "USD", 0.075, 2.5, "BB", false, 380, { issuerStock: "PCBK" }, 0.45);
bond("SIGA31", "Sigmaris 3,25 % 2031", "Sigmaris Elektrik", "EZ", "EUR", 0.0325, 4.5, "A+", false, 80, { issuerStock: "SIGA" }, 0.65);
bond("QBIT34", "Qubitron 4,60 % 2034", "Qubitron Cloud", "US", "USD", 0.046, 7.5, "AA-", false, 60, { issuerStock: "QBIT" }, 0.7);
bond("CARV29", "Carvalis 6,75 % 2029 (High Yield)", "Carvalis Distribution", "EZ", "EUR", 0.0675, 2.5, "BB-", false, 420, { issuerStock: "CARV" }, 0.45);
bond("VOLK33", "Voltkraft 4,25 % 2033", "Voltkraft Automobile", "EZ", "EUR", 0.0425, 6.5, "BBB", false, 160, { issuerStock: "VOLK" }, 0.6);
bond("UBCFRN", "UBC taux variable Euribor+1,20 % 2030", "Union Bancaire Continentale", "EZ", "EUR", 0.012, 3.5, "BBB+", false, 120, { floating: true, issuerStock: "UBCE" }, 0.55);
bond("SKYL28", "Skyline REIT 8,00 % 2028 (High Yield)", "Skyline REIT", "US", "USD", 0.08, 1.8, "B+", false, 520, { issuerStock: "SKYL" }, 0.4);

const FX: [string, string, Currency, number, number][] = [
  // paire, nom, devise de cotation, vol, liquidité
  ["EURUSD", "Euro / Dollar US", "USD", 0.075, 1],
  ["GBPUSD", "Livre sterling / Dollar US", "USD", 0.085, 1],
  ["USDJPY", "Dollar US / Yen", "JPY", 0.1, 1],
  ["EURCHF", "Euro / Franc suisse", "CHF", 0.06, 0.95],
  ["USDCAD", "Dollar US / Dollar canadien", "CAD", 0.07, 0.95],
  ["AUDUSD", "Dollar australien / Dollar US", "USD", 0.1, 0.95],
  ["EURGBP", "Euro / Livre sterling", "GBP", 0.06, 0.95],
  ["EURJPY", "Euro / Yen", "JPY", 0.1, 0.95],
  ["USDCNY", "Dollar US / Yuan", "CNY", 0.04, 0.8],
];

const COMMODITIES: [string, string, number, number, number, number, string][] = [
  // id, nom, prix initial USD, vol, beta (risque), retour à la moyenne, unité
  ["GOLD", "Or (once)", 2650, 0.15, -0.2, 0.0, "once troy"],
  ["SILV", "Argent (once)", 31, 0.27, 0.3, 0.0, "once troy"],
  ["BRENT", "Pétrole Brent (baril)", 78, 0.32, 0.5, 0.5, "baril"],
  ["WTI", "Pétrole WTI (baril)", 74, 0.34, 0.5, 0.5, "baril"],
  ["NGAS", "Gaz naturel (MMBtu)", 3.2, 0.55, 0.2, 0.8, "MMBtu"],
  ["COPR", "Cuivre (tonne)", 9200, 0.22, 0.7, 0.3, "tonne"],
  ["WHEA", "Blé (boisseau)", 5.8, 0.28, 0.1, 0.6, "boisseau"],
];

const CRYPTO: [string, string, number, number, string][] = [
  ["AURC", "Aurum Chain", 64000, 0.65, "Cryptoactif fictif « réserve de valeur », le plus capitalisé du marché simulé."],
  ["NEBL", "Nebula Network", 3100, 0.8, "Plateforme fictive de contrats intelligents."],
  ["QNTA", "Quanta Coin", 140, 1.0, "Jeton fictif d'une blockchain à haut débit."],
  ["HLIO", "Helios Meme", 0.18, 1.6, "Jeton spéculatif fictif sans fondamentaux — extrêmement volatil."],
];

export interface Catalog { defs: InstrumentDef[]; initialPrices: Record<string, number>; fxInit: Record<Currency, number>; units: Record<string, string>; }

export const FX_INIT_LOG: Record<Currency, number> = {
  USD: 0, EUR: Math.log(1.08), GBP: Math.log(1.27), CHF: Math.log(1.08 / 0.94), JPY: Math.log(1 / 152), CAD: Math.log(1 / 1.37), AUD: Math.log(0.66), CNY: Math.log(1 / 7.2),
};

export function buildCatalog(): Catalog {
  const defs: InstrumentDef[] = [];
  const initialPrices: Record<string, number> = {};
  const units: Record<string, string> = {};
  for (const r of STOCKS) {
    const d = makeStock(r);
    defs.push(d);
    initialPrices[d.id] = stockInitialPrice(d).price;
  }
  for (const b of BONDS) { defs.push(b); initialPrices[b.id] = 100; }
  for (const [id, name, quote, vol, liq] of FX) {
    defs.push({ id, name, cls: "devise", currency: quote, session: "FX", zone: "US", vol, beta: 0, liquidity: liq, baseSpreadBps: liq > 0.9 ? 0.8 : 2, lot: 1000, description: `Paire de devises ${name}. Acheter ${id} = acheter ${id.slice(0, 3)} contre ${id.slice(3)}.` });
  }
  for (const [id, name, price, vol, beta, mr, unit] of COMMODITIES) {
    defs.push({ id, name, cls: "matiere", currency: "USD", session: "COMMO", zone: "US", vol, beta, liquidity: 0.85, baseSpreadBps: 4, meanRevert: mr, description: `Matière première cotée en dollars par ${unit}.` });
    initialPrices[id] = price; units[id] = unit;
  }
  for (const [id, name, price, vol, desc] of CRYPTO) {
    defs.push({ id, name, cls: "crypto", currency: "USD", session: "CRYPTO", zone: "US", vol, beta: 1.5, liquidity: id === "HLIO" ? 0.3 : 0.75, baseSpreadBps: id === "HLIO" ? 60 : 8, description: desc + " Simulation : aucun lien avec un cryptoactif réel." });
    initialPrices[id] = price;
  }
  // Indices et ETF (paniers) — pondérations déterminées à l'initialisation par capitalisation
  const sel = (f: (d: InstrumentDef) => boolean) => defs.filter((d) => d.cls === "action" && f(d)).map((d) => d.id);
  const indexSpecs: [string, string, string[], Currency, string][] = [
    ["IDX-EU", "Indice EUROPA 50", sel((d) => d.zone === "EZ" || d.zone === "UK"), "EUR", "Indice des grandes capitalisations européennes (simulé)."],
    ["IDX-US", "Indice AMERICA 100", sel((d) => d.zone === "US"), "USD", "Indice des grandes capitalisations américaines (simulé)."],
    ["IDX-AS", "Indice ASIA PACIFIC", sel((d) => d.zone === "JP" || d.zone === "CN"), "USD", "Indice Asie-Pacifique (simulé)."],
    ["IDX-WD", "Indice MONDE", sel(() => true), "USD", "Indice mondial toutes zones — benchmark du jeu."],
  ];
  for (const [id, name, members, cur, desc] of indexSpecs) {
    defs.push({ id, name, cls: "indice", currency: cur, session: id === "IDX-EU" ? "EU" : id === "IDX-AS" ? "ASIA" : "US", zone: id === "IDX-EU" ? "EZ" : "US", vol: 0, beta: 1, liquidity: 1, baseSpreadBps: 1, basket: members.map((m) => ({ id: m, w: 0 })), description: desc + " Non négociable directement : utilisez les ETF ou les futures." });
    initialPrices[id] = id === "IDX-EU" ? 5000 : id === "IDX-US" ? 6000 : id === "IDX-AS" ? 3000 : 4000;
  }
  const etfSpecs: [string, string, string[], Currency, string][] = [
    ["XWLD", "ETF Monde Grandes Capitalisations", sel(() => true), "EUR", "Réplique l'indice MONDE (toutes actions du jeu, pondérées par la capitalisation)."],
    ["XUSA", "ETF États-Unis 100", sel((d) => d.zone === "US"), "USD", "Réplique l'indice AMERICA 100."],
    ["XEUR", "ETF Europe 50", sel((d) => d.zone === "EZ" || d.zone === "UK"), "EUR", "Réplique l'indice EUROPA 50."],
    ["XEMG", "ETF Marchés émergents", sel((d) => d.zone === "EM" || d.zone === "CN"), "USD", "Actions des économies émergentes et de Chine."],
    ["XTEC", "ETF Technologie mondiale", sel((d) => d.sector === "Technologie"), "USD", "Valeurs technologiques mondiales."],
    ["XNRG", "ETF Énergie", sel((d) => d.sector === "Énergie"), "USD", "Producteurs d'énergie mondiaux."],
    ["XBNK", "ETF Banques européennes", sel((d) => d.sector === "Banque" && (d.zone === "EZ")), "EUR", "Banques cotées de la zone euro et de Suisse."],
  ];
  for (const [id, name, members, cur, desc] of etfSpecs) {
    defs.push({ id, name, cls: "etf", currency: cur, session: cur === "EUR" ? "EU" : "US", zone: cur === "EUR" ? "EZ" : "US", vol: 0, beta: 1, liquidity: 0.95, baseSpreadBps: 3, basket: members.map((m) => ({ id: m, w: 0 })), description: desc });
    initialPrices[id] = 100;
  }
  const bondEtf: [string, string, string[], string][] = [
    ["XAGG", "ETF Obligations agrégées euro", ["DE2Y", "DE10Y", "FR10Y", "IT10Y", "LUTB30", "SIGA31", "VOLK33", "UBCFRN"], "Obligations d'État et d'entreprises de la zone euro (investment grade)."],
    ["XHYD", "ETF Obligations haut rendement", ["PCBK29", "CARV29", "SKYL28", "VOLK33"], "Obligations spéculatives (high yield) — rendement élevé, risque de crédit élevé."],
  ];
  for (const [id, name, members, desc] of bondEtf) {
    defs.push({ id, name, cls: "etf", currency: "EUR", session: "EU", zone: "EZ", vol: 0, beta: 0, liquidity: 0.9, baseSpreadBps: 5, basket: members.map((m) => ({ id: m, w: 1 / members.length })), description: desc });
    initialPrices[id] = 100;
  }
  defs.push({ id: "XGLD", name: "ETC Or physique", cls: "etf", currency: "USD", session: "US", zone: "US", vol: 0, beta: 0, liquidity: 0.9, baseSpreadBps: 4, basket: [{ id: "GOLD", w: 1 }], description: "Réplique le cours de l'or." });
  initialPrices["XGLD"] = 100;
  defs.push({ id: "XCOM", name: "ETF Matières premières diversifiées", cls: "etf", currency: "USD", session: "US", zone: "US", vol: 0, beta: 0, liquidity: 0.85, baseSpreadBps: 6, basket: ["GOLD", "BRENT", "COPR", "NGAS", "WHEA", "SILV"].map((id) => ({ id, w: 1 / 6 })), description: "Panier équipondéré de matières premières." });
  initialPrices["XCOM"] = 100;
  return { defs, initialPrices, fxInit: Object.fromEntries(Object.entries(FX_INIT_LOG).map(([k, v]) => [k, Math.exp(v)])) as Record<Currency, number>, units };
}

/** Futures cotés (échéance trimestrielle ; règlement en espèces) */
export const FUTURE_SPECS: { root: string; name: string; underlying: string; multiplier: number; marginPct: number }[] = [
  { root: "FEU", name: "Future EUROPA 50", underlying: "IDX-EU", multiplier: 10, marginPct: 0.08 },
  { root: "FUS", name: "Future AMERICA 100", underlying: "IDX-US", multiplier: 5, marginPct: 0.08 },
  { root: "FBD", name: "Future Bund 10 ans", underlying: "DE10Y", multiplier: 1000, marginPct: 0.03 },
  { root: "FCL", name: "Future Brent", underlying: "BRENT", multiplier: 100, marginPct: 0.12 },
  { root: "FGC", name: "Future Or", underlying: "GOLD", multiplier: 10, marginPct: 0.07 },
];

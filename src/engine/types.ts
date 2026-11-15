import type { RngState } from "./rng";
import type { SessionId, Speed } from "./time";
import type { Cents } from "./money";

export const SAVE_VERSION = 2;

export type Currency = "EUR" | "USD" | "GBP" | "CHF" | "JPY" | "CAD" | "AUD" | "CNY";
export const CURRENCIES: Currency[] = ["EUR", "USD", "GBP", "CHF", "JPY", "CAD", "AUD", "CNY"];
export type ZoneId = "US" | "EZ" | "UK" | "JP" | "CN" | "EM";
export type Sector = "Technologie" | "Banque" | "Industrie" | "Énergie" | "Santé" | "Luxe" | "Distribution" | "Télécoms" | "Automobile" | "Immobilier" | "Assurance" | "Matériaux";
export type AssetClass = "action" | "etf" | "obligation" | "devise" | "matiere" | "crypto" | "indice" | "option" | "future";

export type RegimeId = "haussier" | "baissier" | "lateral" | "volatil" | "crise" | "reprise" | "bulle" | "recession" | "expansion" | "stagflation";
export type Difficulty = "debutant" | "normal" | "expert" | "simulation";
export type GameMode = "carriere" | "bac_a_sable" | "defi";
export type Track = "trader" | "sales" | "structurer" | "analyste" | "gerant" | "risk" | "ib" | "entrepreneur";
export type SkillBranch = "analyse" | "marches" | "maths" | "macro" | "risque" | "client" | "management" | "entrepreneuriat";
export type RepKey = "professionnelle" | "commerciale" | "clients" | "interne" | "fiabilite" | "risque" | "conformite" | "leadership";

/* ───────────── Instruments (définition statique + état dynamique) ───────────── */
export interface InstrumentDef {
  id: string;            // ticker unique
  name: string;
  cls: AssetClass;
  currency: Currency;
  session: SessionId;
  zone: ZoneId;
  sector?: Sector;
  country?: string;
  vol: number;           // volatilité annuelle de base
  beta: number;          // sensibilité au facteur régional / de classe
  sectorBeta?: number;
  liquidity: number;     // 0..1 (1 = très liquide)
  baseSpreadBps: number;
  lot?: number;          // taille minimale
  description?: string;
  // Actions
  shares?: number;       // nombre d'actions (millions)
  revenue?: number;      // CA annuel (millions, devise)
  margin?: number;       // marge nette
  debt?: number;         // dette nette (millions)
  payout?: number;       // taux de distribution
  growth?: number;       // croissance anticipée du CA
  fairPE?: number;       // PER « normal » du secteur/entreprise
  risks?: string[];
  outlook?: string;
  issuerOf?: string;     // id de banque concurrente si la société est une banque du jeu
  /** Valeur de l'univers étendu (stockage allégé : historique court, pas de barres 15 min sauf si suivie) */
  lite?: boolean;
  // Obligations
  bond?: { issuer: string; couponRate: number; maturityDay: number; freq: 1 | 2 | 4; floating?: boolean; rating: string; gov: boolean; nominal: number; issuerStock?: string; spreadBps: number };
  // ETF / indices
  basket?: { id: string; w: number }[];
  // Matières premières
  meanRevert?: number;
  // Dérivés
  option?: { underlying: string; type: "call" | "put"; strike: number; expiryDay: number; multiplier: number };
  future?: { underlying: string; expiryDay: number; multiplier: number; marginPct: number };
}

export interface Bar { t: number; o: number; h: number; l: number; c: number; v: number; }

export interface InstrumentState {
  price: number;
  prevClose: number;
  dayOpen: number;
  dayHigh: number;
  dayLow: number;
  dayVolume: number;
  fair?: number;        // valeur fondamentale (actions)
  eps?: number;         // BPA courant
  dividend?: number;    // dividende annuel par action
  ivBump: number;       // choc de volatilité implicite / réalisée spécifique
  stress: number;       // détresse spécifique 0..1 (crédit, liquidité)
  defaulted?: boolean;
  daily: Bar[];         // barres journalières
  intraday: Bar[];      // barres 15 minutes (fenêtre glissante)
  lastEarningsDay?: number;
  nextEarningsDay?: number;
  nextDivDay?: number;
  halted?: boolean;
  pending: number;      // rendement log en attente d'intégration (chocs d'actualité)
  rv: number;           // volatilité réalisée 60 j (annualisée)
  lastBarDay: number;   // jour de la dernière barre journalière
}

/* ───────────── Macroéconomie ───────────── */
export interface Zone {
  id: ZoneId; name: string; currency: Currency;
  gdp: number;            // PIB (milliards)
  growth: number;         // croissance annuelle (%)
  inflation: number;      // %
  unemployment: number;   // %
  policyRate: number;     // %
  y2: number; y10: number; y30: number; // courbe des taux souveraine (%)
  debt: number;           // % du PIB
  deficit: number;        // % du PIB
  tradeBalance: number;   // % du PIB
  confidence: number;     // indice confiance consommateurs (100 = neutre)
  industrial: number;     // production industrielle (% a/a)
  finConditions: number;  // conditions financières (0 = neutre, >0 resserrées)
  inflationExp: number;
  nextCbDay: number;      // prochaine réunion de politique monétaire
  cbName: string;
  history: { day: number; growth: number; inflation: number; unemployment: number; policyRate: number; y10: number }[];
}

export interface MacroState {
  zones: Record<ZoneId, Zone>;
  regime: RegimeId;
  regimeSinceDay: number;
  riskAversion: number;   // 0..1+
  liquidity: number;      // 1 = normal, <1 tensions
  geopolitics: number;    // 0..1 tension
  oilSupplyShock: number;
  fxLog: Record<Currency, number>; // log-valeur de chaque devise vs USD (USD = 0)
  factors: Record<string, number>; // niveaux de facteurs cumulés (diagnostic)
  regimeHistory: { day: number; regime: RegimeId }[];
}

/** Impulsion de dérive appliquée progressivement (événements → prix) */
export interface Impulse {
  id: string;
  target: { kind: "instrument" | "sector" | "zone" | "class" | "global"; id: string };
  totalLogReturn: number;  // rendement log total à distribuer
  remainingSteps: number;
  volBoost: number;        // multiplicateur additionnel de volatilité
  source: string;
}

/* ───────────── Comptabilité / comptes ───────────── */
export interface LedgerEntry {
  id: number; t: number; debit: string; credit: string; amount: Cents; cur: Currency; memo: string; ref?: string;
}
export type AccountKind = "personnel" | "desk" | "client" | "societe";
export interface Position {
  instrumentId: string;
  qty: number;           // >0 long, <0 short
  avgPrice: number;      // prix moyen (devise de l'instrument)
  realized: Cents;       // P&L réalisé cumulé (EUR)
  openedT: number;
  marginLocked?: Cents;  // marge initiale bloquée (futures)
  lastSettle?: number;   // dernier prix de règlement (futures)
}
export type OrderType = "market" | "limit" | "stop" | "stop_limit";
export type OrderStatus = "en_attente" | "partiel" | "execute" | "annule" | "expire" | "rejete";
export interface Order {
  id: string; account: string; instrumentId: string; side: "buy" | "sell";
  type: OrderType; qty: number; filled: number; limit?: number; stop?: number;
  triggered?: boolean; status: OrderStatus; createdT: number; updatedT: number; expiresT?: number;
  avgFill?: number; fees: Cents; reason?: string; tag?: "stop_loss" | "take_profit" | "liquidation" | "rebalance";
  ocoWith?: string; clientRef?: string;
}
export interface Fill { id: string; orderId: string; account: string; instrumentId: string; side: "buy" | "sell"; qty: number; price: number; fees: Cents; t: number; slippageBps: number; realized: Cents; }
export interface Account {
  id: string; kind: AccountKind; label: string; baseCurrency: Currency;
  positions: Record<string, Position>;
  allowShort: boolean; maxLeverage: number;
  equityHistory: { t: number; v: number }[];  // valeur journalière (EUR)
  marginCall?: { sinceT: number; deadlineT: number };
  capitalAllocated?: Cents; // capital initial alloué (desk/client)
  realizedTotal: Cents;
  feesTotal: Cents;
  incomeTotal: Cents; // dividendes + coupons + intérêts
}
export interface StructuredHolding {
  id: string; productId: string; account: string; nominal: Cents; t: number;
  status: "actif" | "rembourse_anticipe" | "echu" | "defaut";
  couponsPaid: Cents; missedCoupons: number; redemption?: Cents; log: string[];
}
export interface StructuredProduct {
  id: string; name: string; kind: "autocall" | "phoenix" | "reverse_convertible" | "capital_protege" | "participation" | "barriere";
  issuer: string; issuerStock?: string; underlyings: string[]; launchDay: number; maturityDay: number;
  initial: Record<string, number>; protectionBarrier: number; couponBarrier: number; autocallLevel: number;
  couponRate: number; memory: boolean; freqMonths: number; observationDays: number[]; capitalProtection: number;
  participation: number; subscriptionEndDay: number; minTicket: Cents; description: string;
  observationsDone: number;
}

/* ───────────── Carrière, PNJ, clients ───────────── */
export interface Profile {
  firstName: string; lastName: string; nationality: string; age: number; education: string;
  knowledge: "debutant" | "etudiant" | "analyste" | "trader" | "entrepreneur" | "expert";
  goal: string; specialization: string; riskProfile: "prudent" | "equilibre" | "dynamique" | "agressif";
}
export interface Review { t: number; kind: "hebdo" | "trimestrielle" | "annuelle"; score: number; details: Record<string, number>; outcome: string; bonus?: Cents; promoted?: boolean; comment: string; }
export interface Career {
  track: Track; bankId: string; rank: number; salaryAnnual: Cents; hiredT: number;
  employed: boolean; deskLimitVaR: Cents; deskMaxPosition: number;
  objectives: { label: string; key: string; target: number }[];
  reviews: Review[]; warnings: number; stress: number; energy: number;
  missionsDone: number; missionsFailed: number; breaches: number; lastBreachT?: number;
  pendingOffers: { id: string; bankId: string; rank: number; salary: Cents; expiresT: number; track: Track }[];
  history: { t: number; text: string }[];
  ytdBonusPool: Cents; weekStartEquity: number; quarterStartEquity: number; yearStartEquity: number;
}
export interface Npc {
  id: string; name: string; role: string; personality: string; bankId?: string; avatar: string;
  trust: number; riskTolerance: number; mood: number; goals: string[];
  opinion: string; memory: { t: number; text: string; impact: number }[]; relation: "hierarchie" | "collegue" | "client" | "externe" | "conformite" | "risque";
}
export interface Client {
  id: string; name: string; kind: "particulier" | "institutionnel" | "entreprise"; npcId: string;
  wealth: Cents; income: Cents; objective: string; horizonYears: number; riskTolerance: number; // 1..7
  liquidityNeed: number; knowledge: number; demands: string; satisfaction: number; trust: number;
  accountId: string; targetAllocation: Record<string, number>; expectedReturn: number; feeBps: number;
  constraints: string[]; history: { t: number; text: string }[]; lastContactT: number; lost?: boolean; joinedT: number;
}
export interface Prospect {
  id: string; name: string; kind: Client["kind"]; desc: string; source: string; warm: boolean;
  wealth: number; potential: number; risk: number; horizon: number; objective: string; knowledge: number; avatar: string;
  status: "a_appeler" | "rappel" | "refus" | "converti"; attempts: number; lastCallT?: number; givenT: number; givenBy?: string; note?: string;
}
export interface MeetingInstance {
  id: string; templateId: string; nodeId: string; startedT: number; vars: Record<string, number | string>;
  score: { finance: number; risque: number; communication: number; ethique: number }; log: { who: string; text: string }[];
  done: boolean; outcome?: string; context?: Record<string, string>;
}
export interface AgendaItem { id: string; t: number; durationMin: number; title: string; kind: "reunion" | "appel" | "publication" | "marche" | "echeance" | "personnel"; meetingTemplate?: string; params?: Record<string, string>; status: "prevu" | "fait" | "manque" | "annule"; important?: boolean; }
export interface Mission {
  id: string; templateId: string; title: string; category: SkillBranch | "conformite" | "trading";
  description: string; criteria: string[]; params: Record<string, number | string>; startT: number; deadlineT: number;
  status: "active" | "reussie" | "echouee"; reward: { xp: number; rep: Partial<Record<RepKey, number>>; trust?: { npc: string; delta: number } };
  progress: number; baseline?: Record<string, number>; giver?: string;
  /** Mission du jour (générée automatiquement) et niveau d'enjeu : 1 faible · 2 moyen · 3 élevé */
  daily?: boolean; stakes?: 1 | 2 | 3;
}
export interface Notification { id: string; t: number; level: "info" | "succes" | "alerte" | "critique"; title: string; body?: string; link?: string; read: boolean; count?: number; }
export interface Message { id: string; t: number; from: string; subject: string; body: string; read: boolean; actions?: { label: string; action: string; payload?: Record<string, string> }[]; handled?: boolean; }
export interface NewsItem { id: string; t: number; category: "macro" | "entreprises" | "banques_centrales" | "geopolitique" | "matieres" | "marches" | "reglementation" | "crises"; title: string; body: string; impact: "faible" | "moyen" | "fort"; tickers: string[]; zones: ZoneId[]; sentiment: number; }
export interface CalendarEvent { id: string; day: number; minute: number; title: string; zone?: ZoneId; kind: "banque_centrale" | "statistique" | "resultats" | "echeance" | "observation" | "dividende"; ref?: string; importance: 1 | 2 | 3; done?: boolean; consensus?: string; actual?: string; }

export interface CrisisState {
  id: string; kind: CrisisKind; phase: number; phaseSinceT: number; startT: number; target?: string; zone?: ZoneId; severity: number; resolved: boolean; log: { t: number; text: string }[]; meetingDone?: boolean;
}
export type CrisisKind = "liquidite_bancaire" | "krach" | "hausse_taux" | "bulle_tech" | "crise_energie" | "defaut_souverain" | "crise_change" | "faillite_entreprise" | "recession" | "inflation" | "immobilier";

export interface CompetitorBank {
  id: string; name: string; aum: Cents; capitalRatio: number; health: number; riskAppetite: number; strategy: string; reputation: number; stockId?: string; tradingPnlYtd: Cents; bondLosses: number; deposits: number;
}
export interface Company {
  name: string; kind: "conseil" | "gestion" | "fonds" | "hedge_fund" | "fintech" | "banque_affaires"; foundedT: number; accountId: string; strategy: string;
  employees: { id: string; name: string; role: string; salary: Cents; skill: number; morale: number }[];
  office: "coworking" | "bureau" | "siege"; tools: string[]; aum: Cents; clientsCount: number; feeBps: number; perfFeePct: number;
  reputation: number; marketingBudget: Cents; monthly: { month: number; revenue: Cents; expenses: Cents; net: Cents; cash: Cents; aum: Cents }[];
  equityRaised: Cents; debt: Cents; bankrupt: boolean; negativeMonths: number; complianceScore: number; products: string[]; retainedEarnings: Cents;
}
export interface Decision { t: number; kind: string; text: string; }

export interface GameSettings {
  /** Notifications affichées : toutes, importantes (alertes, succès, critiques) ou critiques seulement */
  notifLevel?: "toutes" | "importantes" | "critiques";
  /** Ambiance sonore (nature) et petits bruits */
  sound?: boolean;
  minutesPerSecond: number;     // ratio temps réel → simulé à x1
  autoPauseImportant: boolean;
  livingExpenses: boolean;
  allowShort: boolean;
  aiEnabled: boolean;
  explanations: boolean;
}

export interface Property {
  id: string; city: string; type: "studio" | "t2" | "t3" | "maison"; surface: number;
  condition: "neuf" | "bon" | "renover"; dpe: "A" | "B" | "C" | "D" | "E" | "F" | "G";
  buyPrice: number; buyT: number;
  status: "vacant" | "en_location" | "loue" | "en_vente" | "travaux";
  askRent?: number; rent?: number; tenantSince?: number; askPrice?: number; worksUntil?: number; unpaid?: number;
  loan?: { principal: number; rate: number; monthly: number; monthsLeft: number };
  log?: { t: number; text: string }[];
}
export interface LifeState {
  /** Jauges 0-100 */
  mental: number; physique: number; social: number; fun: number;
  housing: { id: string; owned: boolean; since: number; value?: number; mortgage?: { principal: number; rate: number; monthly: number; monthsLeft: number } };
  transport: "commun" | "velo" | "occasion" | "neuve";
  subs: { mutuelle: boolean; assurance: boolean; sport: boolean; streaming: boolean };
  free: { day: number; used: number };
  unpaid: number;
  perks: { teletravail: boolean; extraLeave: number };
  lastRaiseAskT?: number;
  log: { t: number; text: string }[];
  budget: { month: number; bills: number; net: number }[];
  /** Vie sentimentale et familiale */
  partner?: { name: string; since: number; bond: number; married?: boolean };
  children?: number;
  pets?: number;
  /** Investissements locatifs */
  properties?: Property[];
  reBought?: string[];
  /** Planning : horaires de travail et heure de réveil (minutes depuis minuit) */
  plan?: { start: number; end: number; wake: number };
  /** Dernier sommeil */
  sleep?: { startT: number; endT: number; hours: number };
  /** Heures d'avance prises sur le lendemain (heures supplémentaires « pour demain ») */
  ahead?: number;
  /** Départ anticipé du jour grâce à l'avance */
  early?: { day: number; hours: number };
  /** Heures supplémentaires de la semaine */
  ot?: { week: number; hours: number; today: { day: number; hours: number } };
}
export interface GameState {
  version: number;
  /** Parcours, succès et fin de partie */
  progress?: { chapters: string[]; objectives: string[]; achievements: string[] };
  /** Quiz de culture économique */
  quiz?: { done: Record<string, 0 | 1>; last?: Record<string, number>; streak: number; best: number; answered: number; correct: number; today?: { day: number; ids: string[]; answered: string[] }; dailyDone?: number; dailyStreak?: number; dailyBest?: number; lastDaily?: number };
  ended?: { id: "retraite" | "faillite" | "fortune"; t: number; score: number };
  /** Prospects à démarcher (donnés par le N+1 ou recommandés) */
  prospects?: Prospect[];
  /** Vie privée (mode carrière) */
  life?: LifeState;
  /** Année de départ du calendrier (2027 : monde fictif ; 2000 : mode historique) */
  epochYear?: number;
  /** Mode historique 2000 → novembre 2026 : événements réels datés et trajectoires de marché approchées */
  historical?: boolean;
  id: string;
  ownerId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  mode: GameMode;
  difficulty: Difficulty;
  challengeId?: string;
  seed: string;
  rng: RngState;
  t: number;
  speed: Speed;
  paused: boolean;
  pauseReason?: string;
  settings: GameSettings;
  profile: Profile;
  career: Career;
  skills: Record<SkillBranch, number>; // XP
  skillLog: { t: number; branch: SkillBranch; xp: number; reason: string }[];
  reputation: Record<RepKey, number>; // 0..100
  macro: MacroState;
  instruments: Record<string, InstrumentDef>;
  quotes: Record<string, InstrumentState>;
  impulses: Impulse[];
  accounts: Record<string, Account>;
  ledger: LedgerEntry[];
  ledgerArchive: { count: number; checksum: Record<string, number> };
  balances: Record<string, Cents>; // clé "compte|devise"
  orders: Order[];
  fills: Fill[];
  structuredProducts: StructuredProduct[];
  structuredHoldings: StructuredHolding[];
  npcs: Record<string, Npc>;
  clients: Client[];
  banks: CompetitorBank[];
  meetings: MeetingInstance[];
  activeMeetingId?: string;
  agenda: AgendaItem[];
  missions: Mission[];
  notifications: Notification[];
  messages: Message[];
  news: NewsItem[];
  calendar: CalendarEvent[];
  crises: CrisisState[];
  company?: Company;
  decisions: Decision[];
  learning: { completed: string[]; attempts: Record<string, number> };
  watchlist: string[];
  alerts: { id: string; instrumentId: string; above: boolean; level: number; triggered: boolean }[];
  eventCooldowns: Record<string, number>;
  seq: number;
  flags: Record<string, number | string | boolean>;
  tutorial: { step: number; done: boolean };
  challenge?: { id: string; target: number; deadlineT: number; status: "en_cours" | "reussi" | "echoue"; startEquity: number };
  stats: { tradesCount: number; meetingsCount: number; daysPlayed: number; maxDrawdown: number; peakWealth: number };
  lastDay: number;
}

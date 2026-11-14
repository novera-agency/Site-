export const fmtEur = (v: number | null | undefined, d = 0) => v === null || v === undefined || !Number.isFinite(v) ? "—" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: d, minimumFractionDigits: d }).format(v);
export const fmtCur = (v: number, cur: string, d = 2) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: cur, maximumFractionDigits: d, minimumFractionDigits: Math.min(d, 2) }).format(v);
export const fmtNum = (v: number | null | undefined, d = 2) => v === null || v === undefined || !Number.isFinite(v) ? "—" : new Intl.NumberFormat("fr-FR", { maximumFractionDigits: d, minimumFractionDigits: d }).format(v);
export const fmtCompact = (v: number) => new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 }).format(v);
export const fmtPct = (v: number | null | undefined, d = 2, sign = true) => v === null || v === undefined || !Number.isFinite(v) ? "—" : `${sign && v > 0 ? "+" : ""}${v.toFixed(d).replace(".", ",")} %`;
export const fmtPx = (p: number) => !Number.isFinite(p) ? "—" : p >= 1000 ? fmtNum(p, 2) : p >= 1 ? fmtNum(p, p >= 100 ? 2 : 3) : fmtNum(p, 5);
export const clsChange = (v: number) => (v > 0 ? "text-gain" : v < 0 ? "text-loss" : "text-ink-300");
export const CLS_LABEL: Record<string, string> = { action: "Action", etf: "ETF", obligation: "Obligation", devise: "Devise", matiere: "Matière première", crypto: "Crypto (fictif)", indice: "Indice", option: "Option", future: "Future" };
export const ZONE_LABEL: Record<string, string> = { US: "États-Unis", EZ: "Zone euro", UK: "Royaume-Uni", JP: "Japon", CN: "Chine", EM: "Émergents" };

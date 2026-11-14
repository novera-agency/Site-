/**
 * AccountingLedger — grand livre en partie double.
 * Chaque écriture débite un compte et en crédite un autre du même montant (entier, en centimes) dans la même devise.
 * Invariant : pour chaque devise, la somme des soldes de tous les comptes est nulle → aucune création monétaire.
 * Convention : solde = Σ débits − Σ crédits. Un compte d'actif du joueur (trésorerie) a donc un solde positif.
 */
import type { Currency, GameState, LedgerEntry } from "./types";
import { type Cents, toCents } from "./money";

const MAX_LIVE_ENTRIES = 4000;

export function bal(s: GameState, account: string, cur: Currency): Cents { return s.balances[`${account}|${cur}`] ?? 0; }
export const cashAcc = (accountId: string) => `${accountId}:cash`;
export const marginAcc = (accountId: string) => `${accountId}:marge`;
export function cashOf(s: GameState, accountId: string, cur: Currency) { return bal(s, cashAcc(accountId), cur); }

export function post(s: GameState, debit: string, credit: string, amount: Cents, cur: Currency, memo: string, ref?: string): LedgerEntry | null {
  if (!Number.isSafeInteger(amount)) throw new Error(`Montant comptable invalide : ${amount}`);
  if (amount === 0) return null;
  if (amount < 0) return post(s, credit, debit, -amount, cur, memo, ref);
  if (debit === credit) throw new Error("Écriture invalide : débit = crédit");
  const e: LedgerEntry = { id: ++s.seq, t: s.t, debit, credit, amount, cur, memo, ref };
  s.balances[`${debit}|${cur}`] = (s.balances[`${debit}|${cur}`] ?? 0) + amount;
  s.balances[`${credit}|${cur}`] = (s.balances[`${credit}|${cur}`] ?? 0) - amount;
  s.ledger.push(e);
  if (s.ledger.length > MAX_LIVE_ENTRIES) {
    const removed = s.ledger.splice(0, s.ledger.length - MAX_LIVE_ENTRIES);
    s.ledgerArchive.count += removed.length;
    for (const r of removed) s.ledgerArchive.checksum[r.cur] = (s.ledgerArchive.checksum[r.cur] ?? 0) + r.amount;
  }
  return e;
}
export function postAmount(s: GameState, debit: string, credit: string, amount: number, cur: Currency, memo: string, ref?: string) {
  return post(s, debit, credit, toCents(amount), cur, memo, ref);
}

/** Balance de vérification : somme des soldes par devise (doit être 0 partout) */
export function trialBalance(s: GameState): Record<string, Cents> {
  const out: Record<string, Cents> = {};
  for (const [k, v] of Object.entries(s.balances)) { const cur = k.split("|")[1]; out[cur] = (out[cur] ?? 0) + v; }
  return out;
}
export function isBalanced(s: GameState) { return Object.values(trialBalance(s)).every((v) => v === 0); }

/** Liste des soldes de trésorerie d'un compte joueur */
export function cashBalances(s: GameState, accountId: string): Partial<Record<Currency, Cents>> {
  const out: Partial<Record<Currency, Cents>> = {};
  const prefix = `${cashAcc(accountId)}|`;
  for (const [k, v] of Object.entries(s.balances)) if (k.startsWith(prefix) && v !== 0) out[k.slice(prefix.length) as Currency] = v;
  return out;
}
export function accountEntries(s: GameState, accountId: string, limit = 200) {
  const out: LedgerEntry[] = [];
  for (let i = s.ledger.length - 1; i >= 0 && out.length < limit; i--) {
    const e = s.ledger[i];
    if (e.debit.startsWith(accountId + ":") || e.credit.startsWith(accountId + ":")) out.push(e);
  }
  return out;
}

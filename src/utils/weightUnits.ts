import i18n from '@/i18n';

export type WeightUnit = 'kg' | 'lb';

/** Short suffix for weight fields (kg / lb). */
export function weightUnitSuffix(unit: WeightUnit): string {
  return unit === 'kg' ? 'kg' : 'lb';
}

/** Profile / settings label for the measurement system. */
export function weightSystemLabel(unit: WeightUnit): string {
  return unit === 'kg' ? i18n.t('common.metric') : i18n.t('common.imperial');
}

/** Placeholder example weight for inputs. */
export function weightPlaceholder(unit: WeightUnit): string {
  return unit === 'kg' ? '100' : '225';
}


/** Exact IEEE conversion — display rounded per caller. */
export const LB_PER_KG = 2.2046226218;

export function clampMass(amount: number, unit: WeightUnit): number {
  if (!Number.isFinite(amount)) return unit === 'kg' ? 20 : 45;
  const rounded = Math.round(amount * 10) / 10;
  if (unit === 'kg') return Math.min(450, Math.max(1, rounded));
  return Math.min(1000, Math.max(2, rounded));
}

/** Normalize draft string → number or null if empty/invalid. */
export function parseMassDraft(raw: string): number | null {
  const t = raw.replace(',', '.').trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Amount currently in `from`; returns equivalent amount clamped in `to`. */
export function convertMass(amount: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return clampMass(amount, to);
  if (from === 'kg' && to === 'lb') return clampMass(amount * LB_PER_KG, 'lb');
  return clampMass(amount / LB_PER_KG, 'kg');
}

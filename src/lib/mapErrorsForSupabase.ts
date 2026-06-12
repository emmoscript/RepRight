import type { BiomechanicalError } from '@/modules/analyzer';
import type { BiomechanicalErrorInput } from '@/lib/supabaseTypes';

const SEVERITY_MAP = {
  critical: 'high',
  warning: 'medium',
  info: 'low',
} as const satisfies Record<BiomechanicalError['severity'], BiomechanicalErrorInput['severity']>;

/** Map in-app analyzer errors to Supabase RPC / biomechanical_errors rows. */
export function mapErrorsForSupabase(errors: BiomechanicalError[]): BiomechanicalErrorInput[] {
  const byType = new Map<string, BiomechanicalErrorInput>();

  for (const e of errors) {
    const existing = byType.get(e.errorId);
    const mapped: BiomechanicalErrorInput = {
      error_type: e.errorId,
      timestamp_ms: Math.round(e.frameTimestamp),
      confidence: e.confidence,
      severity: SEVERITY_MAP[e.severity],
    };
    if (!existing || e.confidence > existing.confidence) {
      byType.set(e.errorId, mapped);
    }
  }

  return [...byType.values()];
}

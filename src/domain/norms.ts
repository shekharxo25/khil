/**
 * Reference framework — `age_band_expected_range` from spec §4.
 *
 * READ THIS BEFORE CHANGING ANY NUMBER IN THIS FILE.
 *
 * The spec is explicit that these bands must eventually come from a citable
 * published source rather than being invented. They have NOT been sourced yet.
 * Every band below is therefore marked `provenance: 'prototype-placeholder'`
 * and the app surfaces that status wherever a comparison is shown to an adult
 * (see `ReferenceNote`). Swapping in sourced values is a one-file change; the
 * flag engine reads only from here.
 *
 * Shape of the bands is grounded in the uncontroversial direction of travel in
 * the child-development literature — simple choice-reaction and task-switch
 * times fall steeply between ages 2 and 6, and variability falls with them.
 * The direction is safe; the exact millisecond cut-points are not, which is why
 * the flag engine never fires on a single metric or a single session.
 *
 * One band deserves a specific note. `taskSwitchCostMs` is NOT the raw
 * `task_switch_time_ms` column from spec §4. That column, defined literally as
 * "gap between round-end and next first-tap", unavoidably contains the next
 * round's spoken instruction — which is device text-to-speech time, not child
 * time. Banding it would be banding the phone. The signal therefore uses a
 * switch *cost*: the child's own latency on rule-change rounds minus their own
 * latency on rule-repeat rounds, within the same visit. The raw column is still
 * recorded and still shown to the clinician; it just isn't what the flag engine
 * reads. See signals.ts.
 */

export type MetricId =
  | 'responseLatencyMs'
  | 'taskSwitchCostMs'
  | 'accuracy'
  | 'repeatErrorRate'
  | 'rhythmDeviationMs';

export type Provenance = 'prototype-placeholder' | 'sourced';

export type Band = {
  /** Typical range for the age band. Outside it = "unusual", not "wrong". */
  low: number;
  high: number;
  /** Which end of the range is the concerning one. */
  concernDirection: 'above' | 'below';
};

export type AgeBand = {
  id: string;
  label: string;
  minMonths: number;
  maxMonths: number;
  metrics: Record<MetricId, Band>;
};

export const REFERENCE_PROVENANCE: Provenance = 'prototype-placeholder';

export const REFERENCE_NOTE =
  'Comparison ranges in this prototype are placeholders, not published norms. ' +
  'They show how the comparison works; they are not a clinical threshold.';

/** Named so a reviewer can see exactly what still needs sourcing. */
export const REFERENCE_SOURCES_NEEDED = [
  'Age-banded simple/choice reaction-time norms for ages 2–6',
  'Age-banded task-switching cost norms for ages 3–6',
  'Age-banded perseverative-response rates for a 3-choice visual task',
  'Age-banded rhythmic tapping deviation norms for ages 3–6',
];

export const AGE_BANDS: AgeBand[] = [
  {
    id: 'm24_35',
    label: '2 years',
    minMonths: 24,
    maxMonths: 35,
    metrics: {
      responseLatencyMs: { low: 1200, high: 3000, concernDirection: 'above' },
      taskSwitchCostMs: { low: 0, high: 900, concernDirection: 'above' },
      accuracy: { low: 0.45, high: 1, concernDirection: 'below' },
      repeatErrorRate: { low: 0, high: 0.35, concernDirection: 'above' },
      rhythmDeviationMs: { low: 0, high: 420, concernDirection: 'above' },
    },
  },
  {
    id: 'm36_47',
    label: '3 years',
    minMonths: 36,
    maxMonths: 47,
    metrics: {
      responseLatencyMs: { low: 1000, high: 2400, concernDirection: 'above' },
      taskSwitchCostMs: { low: 0, high: 700, concernDirection: 'above' },
      accuracy: { low: 0.55, high: 1, concernDirection: 'below' },
      repeatErrorRate: { low: 0, high: 0.3, concernDirection: 'above' },
      rhythmDeviationMs: { low: 0, high: 360, concernDirection: 'above' },
    },
  },
  {
    id: 'm48_59',
    label: '4 years',
    minMonths: 48,
    maxMonths: 59,
    metrics: {
      responseLatencyMs: { low: 850, high: 2000, concernDirection: 'above' },
      taskSwitchCostMs: { low: 0, high: 560, concernDirection: 'above' },
      accuracy: { low: 0.65, high: 1, concernDirection: 'below' },
      repeatErrorRate: { low: 0, high: 0.25, concernDirection: 'above' },
      rhythmDeviationMs: { low: 0, high: 300, concernDirection: 'above' },
    },
  },
  {
    id: 'm60_83',
    label: '5–6 years',
    minMonths: 60,
    maxMonths: 83,
    metrics: {
      responseLatencyMs: { low: 700, high: 1700, concernDirection: 'above' },
      taskSwitchCostMs: { low: 0, high: 450, concernDirection: 'above' },
      accuracy: { low: 0.72, high: 1, concernDirection: 'below' },
      repeatErrorRate: { low: 0, high: 0.2, concernDirection: 'above' },
      rhythmDeviationMs: { low: 0, high: 260, concernDirection: 'above' },
    },
  },
];

export function bandForAge(ageMonths: number): AgeBand {
  const clamped = Math.max(24, Math.min(83, ageMonths));
  return (
    AGE_BANDS.find(b => clamped >= b.minMonths && clamped <= b.maxMonths) ??
    AGE_BANDS[AGE_BANDS.length - 1]
  );
}

export function formatBand(metric: MetricId, band: Band): string {
  if (metric === 'accuracy' || metric === 'repeatErrorRate') {
    return `${Math.round(band.low * 100)}–${Math.round(band.high * 100)}%`;
  }
  // A switch cost is a difference between two of the child's own timings, so
  // reading it as a plain range would be misleading — it is an extra, not a total.
  if (metric === 'taskSwitchCostMs') {
    return `up to ${band.high} ms extra`;
  }
  return `${band.low}–${band.high} ms`;
}

/**
 * How far outside the typical range a value sits, in units of the range's own
 * width. 0 = inside the range. 1 = a full range-width outside it.
 *
 * Using range-width rather than a z-score is deliberate: we do not have the
 * distributions that a z-score would imply, and pretending we do would be the
 * exact kind of overclaiming the spec forbids.
 */
export function deviation(metric: MetricId, band: Band, value: number): number {
  const width = Math.max(1e-6, band.high - band.low);
  if (band.concernDirection === 'above') {
    return value <= band.high ? 0 : (value - band.high) / width;
  }
  return value >= band.low ? 0 : (band.low - value) / width;
}

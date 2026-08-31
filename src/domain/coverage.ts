/**
 * PIN-code → pediatrician mapping (wireframe 01, note 2).
 *
 *   "PIN code is the mapping key that assigns this family to a tied-up
 *    pediatrician for their area. Should validate against covered PIN codes at
 *    launch and show a waitlist state if uncovered."
 *
 * At launch Khil covers a handful of clusters only. Anything outside them gets
 * an honest waitlist state rather than a silent fallback to a random doctor.
 */

export type Specialist = {
  id: string;
  name: string;
  clinic: string;
  /** Straight-line distance shown in the auto-match row. */
  distanceKm: number;
  city: string;
  /** Families already mapped to this cluster — the capacity indicator on wireframe 05. */
  familiesMapped: number;
};

export type Cluster = {
  pin: string;
  area: string;
  specialist: Specialist;
};

export const CLUSTERS: Cluster[] = [
  {
    pin: '380015',
    area: 'Ambawadi, Ahmedabad',
    specialist: {
      id: 'dr_mehta',
      name: 'Dr. Mehta',
      clinic: 'Child Development Clinic',
      distanceKm: 1.8,
      city: 'Ahmedabad',
      familiesMapped: 12,
    },
  },
  {
    pin: '380009',
    area: 'Navrangpura, Ahmedabad',
    specialist: {
      id: 'dr_shah',
      name: 'Dr. Shah',
      clinic: 'Little Steps Paediatrics',
      distanceKm: 2.4,
      city: 'Ahmedabad',
      familiesMapped: 9,
    },
  },
  {
    pin: '560034',
    area: 'Koramangala, Bengaluru',
    specialist: {
      id: 'dr_iyer',
      name: 'Dr. Iyer',
      clinic: 'Growing Minds Centre',
      distanceKm: 3.1,
      city: 'Bengaluru',
      familiesMapped: 17,
    },
  },
  {
    pin: '400050',
    area: 'Bandra West, Mumbai',
    specialist: {
      id: 'dr_dsouza',
      name: 'Dr. D’Souza',
      clinic: 'Seaside Child Health',
      distanceKm: 1.2,
      city: 'Mumbai',
      familiesMapped: 21,
    },
  },
];

export type CoverageResult =
  | { covered: true; cluster: Cluster }
  | { covered: false; reason: 'incomplete' | 'uncovered' };

export function lookupPin(pin: string): CoverageResult {
  const trimmed = pin.trim();
  if (!/^\d{6}$/.test(trimmed)) return { covered: false, reason: 'incomplete' };
  const cluster = CLUSTERS.find(c => c.pin === trimmed);
  if (!cluster) return { covered: false, reason: 'uncovered' };
  return { covered: true, cluster };
}

export function clusterByPin(pin: string): Cluster | undefined {
  return CLUSTERS.find(c => c.pin === pin);
}

/** The PIN codes a demo can type in and get a match. Shown on the onboarding hint. */
export const COVERED_PINS = CLUSTERS.map(c => c.pin);

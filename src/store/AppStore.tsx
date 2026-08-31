import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import { evaluateFlag, type Flag, type FlagOutcome } from '../domain/flagEngine';
import type { SessionRecord } from '../domain/telemetry';
import { clearState, loadState, saveState } from './storage';
import {
  CONSENT_COPY_VERSION,
  DEFAULT_SETTINGS,
  INITIAL_STATE,
  SCHEMA_VERSION,
  type AppState,
  type ChildProfile,
  type ClusterPatient,
  type ConsentRecord,
  type PersistedState,
  type Settings,
} from './types';
import { clusterPatientsFor, seedSessions, type SeedMode } from './demoSeed';

type Action =
  | { type: 'hydrate'; payload: PersistedState | null }
  | { type: 'onboard'; child: ChildProfile; consent: ConsentRecord; patients: ClusterPatient[] }
  | { type: 'add-session'; session: SessionRecord }
  | { type: 'add-flag'; flag: Flag }
  | { type: 'patch-flag'; id: string; patch: Partial<Flag> }
  | { type: 'settings'; patch: Partial<Settings> }
  | { type: 'replace'; state: PersistedState }
  | { type: 'reset' };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'hydrate':
      return action.payload
        ? { ...action.payload, hydrated: true }
        : { ...INITIAL_STATE, hydrated: true };

    case 'onboard':
      return {
        ...state,
        child: action.child,
        consent: action.consent,
        clusterPatients: action.patients,
      };

    case 'add-session':
      return { ...state, sessions: [...state.sessions, action.session] };

    case 'add-flag':
      return { ...state, flags: [...state.flags, action.flag] };

    case 'patch-flag':
      return {
        ...state,
        flags: state.flags.map(f => (f.id === action.id ? { ...f, ...action.patch } : f)),
      };

    case 'settings':
      return { ...state, settings: { ...state.settings, ...action.patch } };

    case 'replace':
      return { ...action.state, hydrated: true };

    case 'reset':
      return { ...INITIAL_STATE, hydrated: true };

    default:
      return state;
  }
}

type OnboardInput = {
  name: string;
  dobIso: string;
  pin: string;
  specialistId: string;
  consentClipSharing: boolean;
  consentScreeningNotDiagnosis: boolean;
};

export type AppApi = {
  state: AppState;
  onboard: (input: OnboardInput) => void;
  /**
   * Records a finished session and immediately re-runs the flag engine.
   * Returns the flag if this session completed a qualifying cluster.
   */
  completeSession: (session: SessionRecord) => Flag | null;
  patchFlag: (id: string, patch: Partial<Flag>) => void;
  bookAppointment: (flagId: string) => void;
  snoozeFlag: (flagId: string, days: number) => void;
  markOutcome: (flagId: string, outcome: FlagOutcome, by: string) => void;
  setSettings: (patch: Partial<Settings>) => void;
  seedDemoHistory: (mode: SeedMode) => void;
  resetAll: () => void;
};

const AppContext = createContext<AppApi | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    loadState().then(payload => {
      if (alive) dispatch({ type: 'hydrate', payload });
    });
    return () => {
      alive = false;
    };
  }, []);

  // Debounced persistence — a child mid-session should never wait on a write.
  useEffect(() => {
    if (!state.hydrated) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const { hydrated: _hydrated, ...persisted } = state;
      void saveState(persisted);
    }, 250);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state]);

  const onboard = useCallback((input: OnboardInput) => {
    const child: ChildProfile = {
      child_id: `child_${input.pin}_${Date.now().toString(36)}`,
      name: input.name.trim(),
      dob_iso: input.dobIso,
      pin: input.pin,
      specialist_id: input.specialistId,
      created_at: Date.now(),
    };
    const consent: ConsentRecord = {
      flagged_clip_sharing: input.consentClipSharing,
      screening_not_diagnosis: input.consentScreeningNotDiagnosis,
      accepted_at: Date.now(),
      copy_version: CONSENT_COPY_VERSION,
    };
    dispatch({
      type: 'onboard',
      child,
      consent,
      patients: clusterPatientsFor(input.pin),
    });
  }, []);

  // Kept in a ref so `completeSession` can read fresh state without being
  // re-created on every session append (which would restart in-flight games).
  const stateRef = useRef(state);
  stateRef.current = state;

  const completeSession = useCallback((session: SessionRecord): Flag | null => {
    dispatch({ type: 'add-session', session });

    const current = stateRef.current;
    if (!current.child) return null;
    const sessions = [...current.sessions, session];
    const evaluation = evaluateFlag(current.child.child_id, sessions, current.flags);
    if (evaluation.flag) {
      dispatch({ type: 'add-flag', flag: evaluation.flag });
      return evaluation.flag;
    }
    return null;
  }, []);

  const patchFlag = useCallback((id: string, patch: Partial<Flag>) => {
    dispatch({ type: 'patch-flag', id, patch });
  }, []);

  const bookAppointment = useCallback((flagId: string) => {
    dispatch({ type: 'patch-flag', id: flagId, patch: { status: 'booked', booked_at: Date.now() } });
  }, []);

  const snoozeFlag = useCallback((flagId: string, days: number) => {
    dispatch({
      type: 'patch-flag',
      id: flagId,
      patch: { status: 'snoozed', snooze_until: Date.now() + days * 86400000 },
    });
  }, []);

  const markOutcome = useCallback((flagId: string, outcome: FlagOutcome, by: string) => {
    dispatch({
      type: 'patch-flag',
      id: flagId,
      patch: {
        status: outcome === 'needs_visit' ? 'closed_needs_visit' : 'closed_not_concerning',
        outcome: { outcome, marked_at: Date.now(), by },
      },
    });
  }, []);

  const setSettings = useCallback((patch: Partial<Settings>) => {
    dispatch({ type: 'settings', patch });
  }, []);

  const seedDemoHistory = useCallback((mode: SeedMode) => {
    const current = stateRef.current;
    if (!current.child) return;
    const sessions = seedSessions({
      childId: current.child.child_id,
      dobIso: current.child.dob_iso,
      mode,
    });
    const evaluation = evaluateFlag(current.child.child_id, sessions, []);
    dispatch({
      type: 'replace',
      state: {
        schema_version: SCHEMA_VERSION,
        child: current.child,
        consent: current.consent,
        sessions,
        flags: evaluation.flag ? [evaluation.flag] : [],
        settings: current.settings,
        clusterPatients: current.clusterPatients,
      },
    });
  }, []);

  const resetAll = useCallback(() => {
    void clearState();
    dispatch({ type: 'reset' });
  }, []);

  const value = useMemo<AppApi>(
    () => ({
      state,
      onboard,
      completeSession,
      patchFlag,
      bookAppointment,
      snoozeFlag,
      markOutcome,
      setSettings,
      seedDemoHistory,
      resetAll,
    }),
    [
      state,
      onboard,
      completeSession,
      patchFlag,
      bookAppointment,
      snoozeFlag,
      markOutcome,
      setSettings,
      seedDemoHistory,
      resetAll,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppApi {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}

export { DEFAULT_SETTINGS };

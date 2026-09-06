import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import { applyOutcome, evaluateFlag, type Flag, type FlagOutcome } from '../domain/flagEngine';
import type { SessionRecord } from '../domain/telemetry';
import { makeId } from '../lib/id';
import { disableDailyReminder, enableDailyReminder } from '../lib/reminders';
import { setVoiceLocale } from '../lib/speech';
import { clearState, loadState, saveState } from './storage';
import {
  AVATAR_COLORS,
  AVATAR_GLYPHS,
  CONSENT_COPY_VERSION,
  DEFAULT_PLAN,
  DEFAULT_SETTINGS,
  INITIAL_STATE,
  PLANS,
  SCHEMA_VERSION,
  planFor,
  type Account,
  type AppState,
  type Avatar,
  type ChildProfile,
  type ChatMessage,
  type ChatOrigin,
  type ClusterPatient,
  type ConsentRecord,
  type Message,
  type PersistedState,
  type PlanId,
  type Settings,
  type UserRole,
  sameOrigin,
} from './types';
import { clusterPatientsFor, seedSessions, type SeedMode } from './demoSeed';

type Action =
  | { type: 'hydrate'; payload: PersistedState | null }
  | { type: 'set-role'; role: UserRole; clinicianId?: string }
  | {
      type: 'create-account';
      account: Account;
      consent: ConsentRecord;
      patients: ClusterPatient[];
    }
  | { type: 'add-profile'; profile: ChildProfile }
  | { type: 'update-profile'; id: string; patch: Partial<ChildProfile> }
  | { type: 'remove-profile'; id: string }
  | { type: 'select-profile'; id: string | null }
  | { type: 'set-plan'; plan: PlanId }
  | { type: 'add-session'; session: SessionRecord }
  | { type: 'add-flag'; flag: Flag }
  | { type: 'patch-flag'; id: string; patch: Partial<Flag> }
  | { type: 'send-message'; message: Message }
  | { type: 'send-chat-message'; message: ChatMessage }
  | { type: 'settings'; patch: Partial<Settings> }
  | { type: 'replace'; state: PersistedState }
  | { type: 'reset' };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'hydrate':
      return action.payload
        ? {
            ...action.payload,
            // Defensive merge: a persisted state from before a settings field
            // existed must not resolve that field to `undefined` at runtime.
            settings: { ...DEFAULT_SETTINGS, ...action.payload.settings },
            messages: action.payload.messages ?? [],
            hydrated: true,
          }
        : { ...INITIAL_STATE, hydrated: true };

    case 'set-role':
      return {
        ...state,
        userRole: action.role,
        clinicianId: action.clinicianId ?? null,
      };

    case 'create-account':
      return {
        ...state,
        account: action.account,
        consent: action.consent,
        clusterPatients: action.patients,
      };

    case 'add-profile':
      return {
        ...state,
        profiles: [...state.profiles, action.profile],
        activeProfileId: state.activeProfileId ?? action.profile.child_id,
      };

    case 'update-profile':
      return {
        ...state,
        profiles: state.profiles.map(p =>
          p.child_id === action.id ? { ...p, ...action.patch } : p,
        ),
      };

    case 'remove-profile': {
      const profiles = state.profiles.filter(p => p.child_id !== action.id);
      return {
        ...state,
        profiles,
        // A removed child takes their history with them. Leaving orphaned
        // sessions behind would quietly keep feeding the flag engine.
        sessions: state.sessions.filter(s => s.child_id !== action.id),
        flags: state.flags.filter(f => f.child_id !== action.id),
        messages: state.messages.filter(m => m.child_id !== action.id),
        activeProfileId:
          state.activeProfileId === action.id ? (profiles[0]?.child_id ?? null) : state.activeProfileId,
      };
    }

    case 'select-profile':
      return { ...state, activeProfileId: action.id };

    case 'set-plan':
      return state.account
        ? { ...state, account: { ...state.account, plan: action.plan } }
        : state;

    case 'add-session':
      return { ...state, sessions: [...state.sessions, action.session] };

    case 'add-flag':
      return { ...state, flags: [...state.flags, action.flag] };

    case 'patch-flag':
      return {
        ...state,
        flags: state.flags.map(f => (f.id === action.id ? { ...f, ...action.patch } : f)),
      };

    case 'send-message':
      return { ...state, messages: [...state.messages, action.message] };

    case 'send-chat-message':
      return { ...state, chatMessages: [...state.chatMessages, action.message] };

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

type CreateAccountInput = {
  pin: string;
  specialistId: string;
  consentClipSharing: boolean;
  consentScreeningNotDiagnosis: boolean;
};

type AddProfileInput = {
  name: string;
  dobIso: string;
  avatar: Avatar;
};

export type AddProfileResult =
  | { ok: true; profile: ChildProfile }
  | { ok: false; reason: 'limit'; limit: number };

export type AppApi = {
  state: AppState;

  // Authentication
  loginAsParent: () => void;
  loginAsPediatrician: (clinicianId: string) => void;
  logout: () => void;

  // Account
  createAccount: (input: CreateAccountInput) => void;
  setPlan: (plan: PlanId) => void;

  // Profiles
  profiles: ChildProfile[];
  child: ChildProfile | null;
  addProfile: (input: AddProfileInput) => AddProfileResult;
  updateProfile: (id: string, patch: Partial<ChildProfile>) => void;
  removeProfile: (id: string) => void;
  selectProfile: (id: string | null) => void;
  canAddProfile: boolean;
  suggestAvatar: () => Avatar;

  /** Sessions, flags and messages for the active child only. */
  sessions: SessionRecord[];
  flags: Flag[];
  messages: Message[];
  sessionsFor: (childId: string) => SessionRecord[];
  flagsFor: (childId: string) => Flag[];
  messagesFor: (childId: string) => Message[];
  sendMessage: (childId: string, from: Message['from'], body: string) => void;
  chatMessagesFor: (childId: string, origin: ChatOrigin) => ChatMessage[];
  sendChatMessage: (childId: string, origin: ChatOrigin, body: string) => void;

  completeSession: (session: SessionRecord) => Flag | null;
  patchFlag: (id: string, patch: Partial<Flag>) => void;
  bookAppointment: (flagId: string) => void;
  snoozeFlag: (flagId: string, days: number) => void;
  /**
   * The pediatrician's outcome decision. This is the ONLY place a candidate
   * flag can become visible to a parent (or be dismissed before it ever is) —
   * see `domain/flagEngine.ts`'s `applyOutcome`.
   */
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

  const stateRef = useRef(state);
  stateRef.current = state;

  const loginAsParent = useCallback(() => {
    dispatch({ type: 'set-role', role: 'parent' });
  }, []);

  const loginAsPediatrician = useCallback((clinicianId: string) => {
    dispatch({ type: 'set-role', role: 'pediatrician', clinicianId });
  }, []);

  const logout = useCallback(() => {
    void clearState();
    dispatch({ type: 'reset' });
  }, []);

  const createAccount = useCallback((input: CreateAccountInput) => {
    const account: Account = {
      account_id: makeId('acct'),
      pin: input.pin,
      specialist_id: input.specialistId,
      plan: DEFAULT_PLAN,
      created_at: Date.now(),
    };
    const consent: ConsentRecord = {
      flagged_clip_sharing: input.consentClipSharing,
      screening_not_diagnosis: input.consentScreeningNotDiagnosis,
      accepted_at: Date.now(),
      copy_version: CONSENT_COPY_VERSION,
    };
    dispatch({
      type: 'create-account',
      account,
      consent,
      patients: clusterPatientsFor(input.pin),
    });
  }, []);

  const setPlan = useCallback((plan: PlanId) => dispatch({ type: 'set-plan', plan }), []);

  const suggestAvatar = useCallback((): Avatar => {
    const used = new Set(stateRef.current.profiles.map(p => p.avatar.color));
    const nextColor = AVATAR_COLORS.find(c => !used.has(c)) ?? AVATAR_COLORS[0];
    const glyph = AVATAR_GLYPHS[stateRef.current.profiles.length % AVATAR_GLYPHS.length];
    return { color: nextColor, glyph };
  }, []);

  const addProfile = useCallback((input: AddProfileInput): AddProfileResult => {
    const current = stateRef.current;
    const limit = planFor(current.account).profileLimit;
    if (current.profiles.length >= limit) {
      return { ok: false, reason: 'limit', limit };
    }
    const profile: ChildProfile = {
      child_id: makeId('child'),
      name: input.name.trim(),
      dob_iso: input.dobIso,
      avatar: input.avatar,
      created_at: Date.now(),
      band_override: null,
    };
    dispatch({ type: 'add-profile', profile });
    return { ok: true, profile };
  }, []);

  const updateProfile = useCallback((id: string, patch: Partial<ChildProfile>) => {
    dispatch({ type: 'update-profile', id, patch });
  }, []);

  const removeProfile = useCallback((id: string) => {
    dispatch({ type: 'remove-profile', id });
  }, []);

  const selectProfile = useCallback((id: string | null) => {
    dispatch({ type: 'select-profile', id });
  }, []);

  const completeSession = useCallback((session: SessionRecord): Flag | null => {
    dispatch({ type: 'add-session', session });

    const current = stateRef.current;
    const sessions = [...current.sessions, session];
    const evaluation = evaluateFlag(session.child_id, sessions, current.flags);
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
    const flag = stateRef.current.flags.find(f => f.id === flagId);
    if (!flag) return;
    const patch = applyOutcome(flag, outcome, by);
    dispatch({ type: 'patch-flag', id: flagId, patch });
  }, []);

  const sendMessage = useCallback((childId: string, from: Message['from'], body: string) => {
    const trimmed = body.trim();
    if (!trimmed) return;
    dispatch({
      type: 'send-message',
      message: { id: makeId('msg'), child_id: childId, from, body: trimmed, sent_at: Date.now() },
    });
  }, []);

  const setSettings = useCallback((patch: Partial<Settings>) => {
    dispatch({ type: 'settings', patch });
  }, []);

  /** Seeds history for the ACTIVE child only, leaving siblings untouched. */
  const seedDemoHistory = useCallback((mode: SeedMode) => {
    const current = stateRef.current;
    const active = current.profiles.find(p => p.child_id === current.activeProfileId);
    if (!active) return;

    const sessions = seedSessions({
      childId: active.child_id,
      dobIso: active.dob_iso,
      mode,
    });
    const others = current.sessions.filter(s => s.child_id !== active.child_id);
    const otherFlags = current.flags.filter(f => f.child_id !== active.child_id);
    const evaluation = evaluateFlag(active.child_id, sessions, []);

    dispatch({
      type: 'replace',
      state: {
        schema_version: SCHEMA_VERSION,
        userRole: current.userRole,
        clinicianId: current.clinicianId,
        account: current.account,
        consent: current.consent,
        profiles: current.profiles,
        activeProfileId: current.activeProfileId,
        sessions: [...others, ...sessions],
        flags: evaluation.flag ? [...otherFlags, evaluation.flag] : otherFlags,
        messages: current.messages,
        chatMessages: current.chatMessages,
        settings: current.settings,
        clusterPatients: current.clusterPatients,
      },
    });
  }, []);

  const resetAll = useCallback(() => {
    void clearState();
    dispatch({ type: 'reset' });
  }, []);

  const child = useMemo(
    () => state.profiles.find(p => p.child_id === state.activeProfileId) ?? null,
    [state.profiles, state.activeProfileId],
  );

  const sessions = useMemo(
    () => (child ? state.sessions.filter(s => s.child_id === child.child_id) : []),
    [state.sessions, child],
  );

  const flags = useMemo(
    () => (child ? state.flags.filter(f => f.child_id === child.child_id) : []),
    [state.flags, child],
  );

  const messages = useMemo(
    () => (child ? state.messages.filter(m => m.child_id === child.child_id) : []),
    [state.messages, child],
  );

  const sessionsFor = useCallback(
    (childId: string) => stateRef.current.sessions.filter(s => s.child_id === childId),
    [],
  );
  const flagsFor = useCallback(
    (childId: string) => stateRef.current.flags.filter(f => f.child_id === childId),
    [],
  );
  const messagesFor = useCallback(
    (childId: string) => stateRef.current.messages.filter(m => m.child_id === childId),
    [],
  );

  const chatMessagesFor = useCallback(
    (childId: string, origin: ChatOrigin) =>
      stateRef.current.chatMessages.filter(m => m.child_id === childId && sameOrigin(m.origin, origin)),
    [],
  );

  const sendChatMessage = useCallback((childId: string, origin: ChatOrigin, body: string) => {
    const trimmed = body.trim();
    if (!trimmed) return;
    dispatch({
      type: 'send-chat-message',
      message: { id: makeId('msg'), child_id: childId, from: 'parent', body: trimmed, sent_at: Date.now(), origin },
    });
  }, []);

  // Local session reminders track the toggle and the active child's name.
  // Scheduling is a side effect on top of otherwise-pure state, which is why
  // it lives here rather than in domain/store logic.
  useEffect(() => {
    if (!state.hydrated) return;
    if (state.settings.remindersEnabled && child) {
      void enableDailyReminder(child.name);
    } else {
      void disableDailyReminder();
    }
  }, [state.hydrated, state.settings.remindersEnabled, child]);

  useEffect(() => {
    setVoiceLocale(state.settings.voiceLocale);
  }, [state.settings.voiceLocale]);

  const value = useMemo<AppApi>(
    () => ({
      state,
      loginAsParent,
      loginAsPediatrician,
      logout,
      createAccount,
      setPlan,
      profiles: state.profiles,
      child,
      addProfile,
      updateProfile,
      removeProfile,
      selectProfile,
      canAddProfile: state.profiles.length < planFor(state.account).profileLimit,
      suggestAvatar,
      sessions,
      flags,
      messages,
      sessionsFor,
      flagsFor,
      messagesFor,
      sendMessage,
      chatMessagesFor,
      sendChatMessage,
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
      loginAsParent,
      loginAsPediatrician,
      logout,
      createAccount,
      setPlan,
      child,
      addProfile,
      updateProfile,
      removeProfile,
      selectProfile,
      suggestAvatar,
      sessions,
      flags,
      messages,
      sessionsFor,
      flagsFor,
      messagesFor,
      sendMessage,
      chatMessagesFor,
      sendChatMessage,
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

export { DEFAULT_SETTINGS, PLANS };

import AsyncStorage from '@react-native-async-storage/async-storage';
import { SCHEMA_VERSION, type PersistedState } from './types';

/**
 * Everything Khil holds about a child lives on the device, in one key.
 *
 * That is not an implementation shortcut — it is the consent promise from
 * wireframe 01, note 3 expressed in storage: gameplay is reviewed on-device,
 * and only a flagged summary is ever shared onward.
 */
const KEY = 'khil:state:v1';

export async function loadState(): Promise<PersistedState | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    if (parsed.schema_version !== SCHEMA_VERSION) {
      // No migrations exist yet; a version mismatch starts clean rather than crashing.
      await AsyncStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function saveState(state: PersistedState): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* a failed write must never interrupt a child mid-session */
  }
}

export async function clearState(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    /* no-op */
  }
}

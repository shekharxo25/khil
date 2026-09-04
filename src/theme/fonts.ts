import { useFonts } from 'expo-font';
import { Baloo2_700Bold } from '@expo-google-fonts/baloo-2/700Bold';
import { Baloo2_800ExtraBold } from '@expo-google-fonts/baloo-2/800ExtraBold';
import { AnekLatin_400Regular } from '@expo-google-fonts/anek-latin/400Regular';
import { AnekLatin_500Medium } from '@expo-google-fonts/anek-latin/500Medium';
import { AnekLatin_600SemiBold } from '@expo-google-fonts/anek-latin/600SemiBold';
import { AnekLatin_700Bold } from '@expo-google-fonts/anek-latin/700Bold';

/**
 * Six faces, imported per weight rather than by family, so the bundle carries
 * only what the type scale actually uses.
 *
 * Note for anyone editing styles: with custom fonts, React Native ignores
 * `fontWeight` — weight is selected by picking the right family name. The Txt
 * component is the only place that should be choosing one.
 */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts({
    Baloo2_700Bold,
    Baloo2_800ExtraBold,
    AnekLatin_400Regular,
    AnekLatin_500Medium,
    AnekLatin_600SemiBold,
    AnekLatin_700Bold,
  });
  // A font that fails to load must not hold a child on a blank screen; the
  // system face is an acceptable fallback and the layout is unaffected.
  return loaded || !!error;
}

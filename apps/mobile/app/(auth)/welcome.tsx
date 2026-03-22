import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

import { WelcomeOverlay } from "@/components/welcome-overlay";

export const WELCOME_SEEN_KEY = "welcome_seen";

/**
 * Welcome screen — shown once on first unauthenticated launch.
 *
 * Marks the welcome as seen in AsyncStorage, then navigates to sign-in.
 * Routing here is controlled by (auth)/_layout.tsx which only directs
 * users to this screen when welcome_seen is not set.
 */
export default function WelcomeScreen() {
  const router = useRouter();

  const handleDismiss = async () => {
    await AsyncStorage.setItem(WELCOME_SEEN_KEY, "true");
    router.replace("/(auth)/sign-in");
  };

  return <WelcomeOverlay onDismiss={handleDismiss} />;
}

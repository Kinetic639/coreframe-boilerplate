import { useRouter } from "expo-router";

import { WelcomeOverlay } from "@/components/welcome-overlay";

/**
 * Welcome screen — branded signed-out landing screen.
 *
 * Shown every time an unauthenticated user enters the app (launch or sign-out).
 * Acts as the entry point to the sign-in flow via the CTA.
 *
 * router.replace is used so that back-from-sign-in does not return here.
 */
export default function WelcomeScreen() {
  const router = useRouter();

  const handleDismiss = () => {
    router.replace("/(auth)/sign-in");
  };

  return <WelcomeOverlay onDismiss={handleDismiss} />;
}

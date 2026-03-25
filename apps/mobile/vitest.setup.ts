import { vi } from "vitest";
import React from "react";

// React Native / Metro global required by expo-modules-core and some RN libs
// when running in a non-native environment (jsdom / Node.js).
(globalThis as Record<string, unknown>).__DEV__ = true;

vi.mock("react-native", () => ({
  View: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("div", null, children),
  Text: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("span", null, children),
  TouchableOpacity: ({ children, onPress }: { children?: React.ReactNode; onPress?: () => void }) =>
    React.createElement("button", { onClick: onPress }, children),
  ActivityIndicator: () => null,
  StyleSheet: { create: <T extends object>(s: T): T => s },
  // Required by expo-modules-core (Platform.ts) when running under jsdom
  Platform: {
    OS: "ios",
    select: (specifics: Record<string, unknown>) => specifics["ios"] ?? specifics["default"],
  },
}));

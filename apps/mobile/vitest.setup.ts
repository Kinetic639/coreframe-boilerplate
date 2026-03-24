import { vi } from "vitest";
import React from "react";

vi.mock("react-native", () => ({
  View: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("div", null, children),
  Text: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("span", null, children),
  TouchableOpacity: ({ children, onPress }: { children?: React.ReactNode; onPress?: () => void }) =>
    React.createElement("button", { onClick: onPress }, children),
  ActivityIndicator: () => null,
  StyleSheet: { create: <T extends object>(s: T): T => s },
}));

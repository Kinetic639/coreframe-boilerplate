import { vi } from "vitest";
import React from "react";

// React Native / Metro global required by expo-modules-core and some RN libs
// when running in a non-native environment (jsdom / Node.js).
(globalThis as Record<string, unknown>).__DEV__ = true;

// useColorScheme relies on native APIs unavailable in jsdom.
// Return "light" globally; individual tests may override with a local vi.mock.
vi.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

// @expo/vector-icons relies on native font loading that is unavailable in jsdom.
// Stub each icon family as a simple span so tests can assert on accessibility labels.
vi.mock("@expo/vector-icons", () => ({
  Ionicons: ({
    name,
    testID,
    accessibilityLabel,
  }: {
    name?: string;
    testID?: string;
    accessibilityLabel?: string;
  }) =>
    React.createElement("span", {
      "data-icon": name,
      "data-testid": testID,
      "aria-label": accessibilityLabel,
    }),
  MaterialCommunityIcons: ({
    name,
    testID,
    accessibilityLabel,
  }: {
    name?: string;
    testID?: string;
    accessibilityLabel?: string;
  }) =>
    React.createElement("span", {
      "data-icon": name,
      "data-testid": testID,
      "aria-label": accessibilityLabel,
    }),
}));

// react-native-safe-area-context: SafeAreaView is a passthrough; useSafeAreaInsets
// returns zero insets (no safe area), which makes useTabBarBottomInset() return
// the worst-case value (TAB_BAR_MIN_BOTTOM + TAB_BAR_HEIGHT + extra = 100).
vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children, style }: { children?: React.ReactNode; style?: unknown }) =>
    React.createElement("div", { style }, children),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

vi.mock("react-native", () => ({
  View: ({ children, style }: { children?: React.ReactNode; style?: unknown }) =>
    React.createElement("div", { style }, children),
  Text: ({
    children,
    style,
    selectable,
  }: {
    children?: React.ReactNode;
    style?: unknown;
    selectable?: boolean;
  }) => React.createElement("span", { style, "data-selectable": selectable }, children),
  TouchableOpacity: ({
    children,
    onPress,
    style,
    accessibilityLabel,
    accessibilityRole,
    disabled,
  }: {
    children?: React.ReactNode;
    onPress?: () => void;
    style?: unknown;
    accessibilityLabel?: string;
    accessibilityRole?: string;
    disabled?: boolean;
  }) =>
    React.createElement(
      "button",
      {
        onClick: disabled ? undefined : onPress,
        style,
        "aria-label": accessibilityLabel,
        role: accessibilityRole,
        disabled,
      },
      children
    ),
  ScrollView: ({
    children,
    style,
    contentContainerStyle,
  }: {
    children?: React.ReactNode;
    style?: unknown;
    contentContainerStyle?: unknown;
  }) =>
    React.createElement("div", { style, "data-content-style": contentContainerStyle }, children),
  KeyboardAvoidingView: ({ children, style }: { children?: React.ReactNode; style?: unknown }) =>
    React.createElement("div", { style }, children),
  TextInput: ({
    value,
    onChangeText,
    style,
    placeholder,
    editable,
    multiline,
  }: {
    value?: string;
    onChangeText?: (v: string) => void;
    style?: unknown;
    placeholder?: string;
    editable?: boolean;
    multiline?: boolean;
  }) =>
    React.createElement("input", {
      value: value ?? "",
      onChange: (e: { target: { value: string } }) => onChangeText?.(e.target.value),
      style,
      placeholder,
      disabled: editable === false,
      "data-multiline": multiline,
    }),
  StatusBar: () => null,
  ActivityIndicator: () => null,
  StyleSheet: {
    create: <T extends object>(s: T): T => s,
    hairlineWidth: 1,
  },
  // Required by expo-modules-core (Platform.ts) when running under jsdom
  Platform: {
    OS: "ios",
    select: (specifics: Record<string, unknown>) => specifics["ios"] ?? specifics["default"],
  },
}));

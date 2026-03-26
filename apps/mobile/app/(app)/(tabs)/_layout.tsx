import { Ionicons } from "@expo/vector-icons";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Tabs } from "expo-router";
import * as Haptics from "expo-haptics";
import React from "react";
import { Platform, StyleSheet, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Brand, Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

// ─── Tab icons config ─────────────────────────────────────────────────────────

const TAB_ICONS: Record<string, { focused: string; default: string }> = {
  index: { focused: "grid", default: "grid-outline" },
  more: { focused: "ellipsis-horizontal-circle", default: "ellipsis-horizontal-circle-outline" },
};

// ─── Fully custom floating tab bar ───────────────────────────────────────────
//
// Using the `tabBar` render prop gives us complete control over the bar's DOM
// structure. The `tabBarStyle` + `tabBarButton` approach leaves React Navigation
// in charge of the container, which fights borderRadius, overflow, and safe-area
// insets in ways that can't be overridden reliably.

function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const colorScheme = (useColorScheme() ?? "light") as "light" | "dark";
  const isDark = colorScheme === "dark";
  const c = Colors[colorScheme];
  const insets = useSafeAreaInsets();

  // Sit 16px above the home indicator (or 20px minimum from bottom of screen).
  const barBottom = Math.max(insets.bottom + 8, 20);

  return (
    <View style={[styles.barWrap, { bottom: barBottom }]}>
      <View
        style={[
          styles.bar,
          {
            backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF",
            shadowOpacity: isDark ? 0.45 : 0.1,
          },
        ]}
      >
        {state.routes.map((route, index) => {
          const descriptor = descriptors[route.key];
          const options = descriptor?.options ?? {};
          const focused = state.index === index;
          const iconSet = TAB_ICONS[route.name];
          const iconName = (focused ? iconSet?.focused : iconSet?.default) ?? "ellipse-outline";

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({ type: "tabLongPress", target: route.key });
          };

          return (
            <TouchableOpacity
              key={route.key}
              style={styles.tab}
              onPress={onPress}
              onLongPress={onLongPress}
              onPressIn={() => {
                if (Platform.OS === "ios") {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
              }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={options.tabBarAccessibilityLabel}
            >
              <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
                <Ionicons
                  name={iconName as React.ComponentProps<typeof Ionicons>["name"]}
                  size={24}
                  color={focused ? Brand.primary : c.tabIconDefault}
                />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false, animation: "shift" }}
    >
      <Tabs.Screen name="index" options={{ tabBarAccessibilityLabel: "Pulpit" }} />
      <Tabs.Screen name="more" options={{ tabBarAccessibilityLabel: "Więcej" }} />
    </Tabs>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  barWrap: {
    position: "absolute",
    left: 20,
    right: 20,
    // Pointer events pass through the transparent wrapper to screen content.
    pointerEvents: "box-none",
  },
  bar: {
    flexDirection: "row",
    height: 64,
    borderRadius: 32,
    overflow: "hidden",
    // Shadow (iOS)
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 20,
    // Android elevation
    elevation: 14,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
    width: 48,
    height: 40,
    borderRadius: 20,
  },
  iconWrapActive: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
  },
});

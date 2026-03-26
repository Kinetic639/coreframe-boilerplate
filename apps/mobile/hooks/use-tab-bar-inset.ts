import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TAB_BAR_HEIGHT, TAB_BAR_MIN_BOTTOM, TAB_BAR_SAFE_GAP } from "@/constants/tab-bar";

/**
 * Bottom padding a tab-root screen must apply so its content clears the
 * floating pill tab bar.
 *
 * Derives from the same geometry used by FloatingTabBar in (tabs)/_layout.tsx:
 *   barBottom = Math.max(insets.bottom + TAB_BAR_SAFE_GAP, TAB_BAR_MIN_BOTTOM)
 *
 * Inside a SafeAreaView the bottom inset is already consumed, so the extra
 * clearance needed above the SafeAreaView's bottom edge is:
 *   (barBottom − insets.bottom) + TAB_BAR_HEIGHT + extra
 *
 * Results by device type:
 *   Modern phone  (insets.bottom ≈ 34 px) → 8  + 64 + 16 = 88 px
 *   No safe area  (insets.bottom =   0 px) → 20 + 64 + 16 = 100 px
 */
export function useTabBarBottomInset(extra = 16): number {
  const { bottom } = useSafeAreaInsets();
  const barBottom = Math.max(bottom + TAB_BAR_SAFE_GAP, TAB_BAR_MIN_BOTTOM);
  return barBottom - bottom + TAB_BAR_HEIGHT + extra;
}

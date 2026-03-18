/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

// Ambra System brand colors — amber/gold primary, matching the web app theme
export const Brand = {
  primary: '#F59E0B',       // hsl(40 96% 48%) — amber gold
  primaryDark: '#D97706',   // darker amber for pressed states
  primaryLight: '#FEF3C7',  // light amber tint for backgrounds
};

export const Colors = {
  light: {
    text: '#11181C',
    textMuted: '#6B7280',
    background: '#FFFFFF',
    surface: '#F9FAFB',
    surfaceElevated: '#FFFFFF',
    border: '#E5E7EB',
    tint: Brand.primary,
    icon: '#6B7280',
    tabIconDefault: '#9CA3AF',
    tabIconSelected: Brand.primary,
  },
  dark: {
    text: '#F3F4F6',
    textMuted: '#9CA3AF',
    background: '#0F0F0F',
    surface: '#1A1A1A',
    surfaceElevated: '#262626',
    border: '#2D2D2D',
    tint: Brand.primary,
    icon: '#9CA3AF',
    tabIconDefault: '#6B7280',
    tabIconSelected: Brand.primary,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

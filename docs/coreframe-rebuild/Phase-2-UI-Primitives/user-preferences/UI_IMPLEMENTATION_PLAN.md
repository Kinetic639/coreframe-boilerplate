# User Preferences UI Implementation Plan

**Created**: 2026-02-03
**Status**: Planning
**Depends On**: Backend (Complete), UiSettingsSync (Complete), React Query Hooks (Complete)

---

## Goal

Implement the user-facing settings pages so users can change and persist their preferences: color theme, light/dark mode, language, regional settings (timezone, date/time format), and notification preferences. These pages replace the old `/dashboard-old/account/*` routes with new V2 pages at `/dashboard/account/*`.

---

## What Already Exists

### Backend (Ready to Use)

- **Service**: `UserPreferencesService` with 11 methods
- **Server Actions**: 10 actions with Zod validation (`src/app/actions/user-preferences/index.ts`)
- **React Query Hooks**: 10 hooks (`src/hooks/queries/user-preferences/index.ts`)
- **Types**: Full type definitions (`src/lib/types/user-preferences.ts`)
- **Validation**: Zod schemas with whitelists (`src/lib/validations/user-preferences.ts`)
- **UiSettingsSync**: Bidirectional localStorage ↔ DB sync (`src/app/[locale]/dashboard/_components/ui-settings-sync.tsx`)

### Existing UI Components (Reusable)

- **ThemeSwitcher** (`src/components/theme-switcher.tsx`) - Light/dark toggle button (uses `next-themes`)
- **ColorThemeSwitcher** (`src/components/color-theme-switcher.tsx`) - 15 color themes, localStorage-only
- **ProfilePageClient** (`src/components/ProfilePageClient.tsx`) - Profile display with avatar
- **ProfileEditForm** - Existing form for profile editing
- **AvatarUploader** - Avatar management component

### Old Pages (Reference/Replace)

- `src/app/[locale]/dashboard-old/account/preferences/page.tsx` - Basic theme + language
- `src/app/[locale]/dashboard-old/account/profile/page.tsx` - Profile display

### Module Config (Needs Update)

- `src/modules/user-account/config.ts` - Routes still point to `/dashboard-old/account/*`

### Navigation (Needs Update)

- `src/components/v2/layout/header-user-menu.tsx:99` - Links to `/dashboard-old/account/preferences`
- TODO comment at line 107 says: "Update links to /dashboard/account/\* when V2 account pages are implemented"

### i18n Messages

- `PreferencesPage` keys exist in `messages/en.json` (theme, language) - need expansion
- `modules.userAccount` keys exist (title, profile, preferences)

---

## Implementation Steps

### Step 1: Create Account Layout and Route Structure

**What**: Create the new V2 route structure under `/dashboard/account/` with a shared layout.

**Files to create**:

- `src/app/[locale]/dashboard/account/layout.tsx` - Shared layout with sidebar navigation between account sub-pages
- `src/app/[locale]/dashboard/account/page.tsx` - Redirect to `/dashboard/account/preferences` (or overview)

**Layout design**:

- Use shadcn `Tabs` component (horizontal tabs at top) for navigation between Profile / Preferences
- Keep it within the existing dashboard shell (sidebar + header stay)
- Mobile: tabs stack or become scrollable

**Sub-routes**:

- `/dashboard/account/preferences` - Appearance, regional, notifications
- `/dashboard/account/profile` - Display name, phone, avatar

---

### Step 2: Preferences Page - Appearance Section

**What**: Build the main preferences page with the appearance settings card.

**File to create**:

- `src/app/[locale]/dashboard/account/preferences/page.tsx`

**Appearance card contents**:

1. **Light/Dark/System mode** (3-option radio group)
   - Uses `next-themes` `useTheme()` for immediate effect
   - Also calls `useUiStoreV2().setTheme()` to trigger DB sync via UiSettingsSync
   - Radio group with icons: Sun (light), Moon (dark), Laptop (system)

2. **Color theme picker** (grid of color swatches)
   - Reuse logic from existing `ColorThemeSwitcher` component
   - Display as a grid of clickable cards (not dropdown) for better UX on a settings page
   - Each card shows 4 color preview circles + theme name
   - Currently localStorage-only; optionally sync to `dashboard_settings.ui.colorTheme` in DB
   - 15 themes available

**Hooks to use**:

- `useTheme()` from `next-themes` (light/dark/system)
- `useUiStoreV2()` (for theme store + sync trigger)
- No server action needed for light/dark - UiSettingsSync handles it
- Color theme: localStorage directly (same as current behavior)

**shadcn/ui components**:

- `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`
- `RadioGroup`, `RadioGroupItem`
- `Label`

---

### Step 3: Preferences Page - Language & Regional Section

**What**: Add language and regional settings cards to the preferences page.

**Language card**:

- Language selector dropdown (Select component)
- Supported locales from `VALID_LOCALES`: pl, en, de, fr, es, it, pt, nl, cs, sk, uk, ru
- On change: calls `router.replace()` to change Next.js locale (immediate)
- Also calls `useUpdateRegionalSettingsMutation()` to persist locale to DB

**Regional settings card**:

- **Timezone** - Select dropdown with grouped options (Europe, Americas, Asia, etc.)
  - Values from `VALID_TIMEZONES` in validation schema
- **Date format** - Select dropdown
  - Options: YYYY-MM-DD, DD-MM-YYYY, MM-DD-YYYY, DD/MM/YYYY, MM/DD/YYYY, DD.MM.YYYY, YYYY/MM/DD
- **Time format** - Radio group (24h / 12h)
- Each change calls `useUpdateRegionalSettingsMutation()`
- Show preview of current date/time in selected format

**Hooks to use**:

- `usePreferencesQuery()` - load current settings
- `useUpdateRegionalSettingsMutation()` - save changes
- `useLocale()` + `useRouter()` from next-intl for language switching

**shadcn/ui components**:

- `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`
- `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`, `SelectGroup`, `SelectLabel`
- `RadioGroup`, `RadioGroupItem`
- `Label`
- `Separator`

---

### Step 4: Preferences Page - Notification Settings Section

**What**: Add notification preferences card to the preferences page.

**Notification card contents**:

- **Email notifications** - Toggle switch (enabled/disabled)
- **Push notifications** - Toggle switch (enabled/disabled)
- **In-app notifications** - Toggle switch (enabled/disabled)
- **Quiet hours** section:
  - Enable/disable toggle
  - Start time input (HH:MM)
  - End time input (HH:MM)
  - Timezone selector (same as regional)

**Hooks to use**:

- `usePreferencesQuery()` - load current notification settings
- `useUpdateNotificationSettingsMutation()` - save changes

**shadcn/ui components**:

- `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`
- `Switch` (toggle switches for each channel)
- `Label`
- `Input` (time inputs for quiet hours)
- `Select` (timezone for quiet hours)
- `Separator`

**Note**: Since the app doesn't have push notification infrastructure yet, show push toggle as disabled with a "Coming soon" badge. Email and in-app can be toggleable and persisted.

---

### Step 5: Profile Page

**What**: Build the profile editing page.

**File to create**:

- `src/app/[locale]/dashboard/account/profile/page.tsx`

**Profile card contents**:

- **Avatar** - Reuse existing `AvatarUploader` component
- **Display name** - Text input (validated: 2-100 chars, no XSS chars)
- **Phone** - Text input (validated: international format)
- **Email** - Display only (read from auth, not editable here)
- **Save button** - Calls `useUpdateProfileMutation()`

**Additional info card** (read-only):

- Account ID (truncated UUID)
- Email verified status
- Last sign-in date
- Current role(s)

**Hooks to use**:

- `usePreferencesQuery()` - load current profile data
- `useUpdateProfileMutation()` - save profile changes
- Auth user context for email, roles, etc.

**shadcn/ui components**:

- `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`
- `Input`
- `Label`
- `Button`
- `Badge` (for roles, verified status)
- `Avatar`, `AvatarImage`, `AvatarFallback`

---

### Step 6: Update Module Config and Navigation

**What**: Wire up the new pages into the navigation system.

**Files to update**:

1. **Module config** (`src/modules/user-account/config.ts`):
   - Change paths from `/dashboard-old/account/profile` → `/dashboard/account/profile`
   - Change paths from `/dashboard-old/account/preferences` → `/dashboard/account/preferences`

2. **Header user menu** (`src/components/v2/layout/header-user-menu.tsx`):
   - Update link at line 99 from `/dashboard-old/account/preferences` → `/dashboard/account/preferences`
   - Update any profile links to `/dashboard/account/profile`
   - Remove the TODO comment at line 107

3. **Quick switcher** (`src/components/v2/layout/quick-switcher.tsx`):
   - Verify `/dashboard/settings` link is correct or update to `/dashboard/account/preferences`

---

### Step 7: Expand i18n Messages

**What**: Add missing translation keys for all new UI elements.

**Files to update**:

- `messages/en.json`
- `messages/pl.json`

**New keys needed** (under `PreferencesPage`):

```json
{
  "PreferencesPage": {
    "title": "Preferences",
    "description": "Manage your account preferences and settings",
    "appearance": "Appearance",
    "appearanceDescription": "Customize the look and feel of the application",
    "theme": "Theme",
    "themeDescription": "Choose light or dark mode",
    "colorTheme": "Color Theme",
    "colorThemeDescription": "Choose your preferred color palette",
    "language": "Language",
    "languageDescription": "Select your preferred language",
    "regional": "Regional Settings",
    "regionalDescription": "Configure timezone, date and time formats",
    "timezone": "Timezone",
    "dateFormat": "Date Format",
    "timeFormat": "Time Format",
    "notifications": "Notifications",
    "notificationsDescription": "Configure how you receive notifications",
    "emailNotifications": "Email Notifications",
    "pushNotifications": "Push Notifications",
    "inAppNotifications": "In-App Notifications",
    "quietHours": "Quiet Hours",
    "quietHoursDescription": "Set times when notifications are silenced",
    "startTime": "Start Time",
    "endTime": "End Time",
    "comingSoon": "Coming soon",
    "saved": "Settings saved",
    "previewLabel": "Preview"
  },
  "ProfilePage": {
    "title": "Profile",
    "description": "Manage your personal information",
    "displayName": "Display Name",
    "phone": "Phone Number",
    "email": "Email",
    "avatar": "Profile Photo",
    "accountInfo": "Account Information",
    "accountId": "Account ID",
    "emailVerified": "Email Verified",
    "lastSignIn": "Last Sign In",
    "roles": "Roles",
    "save": "Save Changes"
  }
}
```

---

### Step 8: Color Theme Database Sync (Optional Enhancement)

**What**: Persist the color theme selection to the database so it syncs across devices.

**Current state**: Color theme is localStorage-only via `COLOR_THEME_STORAGE_KEY`.

**Enhancement**:

- Store color theme name in `dashboard_settings.ui.colorTheme`
- Extend `UiSettings` type to include `colorTheme?: string`
- Extend `useUiStoreV2` to track `colorTheme` state
- UiSettingsSync will automatically handle cross-device sync
- On page load, apply color theme from store (same as current `data-theme` attribute)

**This step is optional** - can be deferred if just having localStorage persistence is sufficient for now.

---

### Step 9: Quality Assurance

**What**: Verify everything works correctly.

**Checks**:

1. `npm run type-check` - No TypeScript errors
2. `npm run lint` - No linting errors
3. `npm run build` - Build succeeds
4. Manual testing:
   - [ ] Theme toggle (light/dark/system) applies immediately and persists after refresh
   - [ ] Color theme selection applies immediately and persists
   - [ ] Language change switches the locale and persists
   - [ ] Timezone/date format/time format changes save and display preview
   - [ ] Notification toggles save correctly
   - [ ] Profile edit (display name, phone) saves and shows toast
   - [ ] Avatar upload works
   - [ ] Cross-device: Change theme on one device, reload on another device to verify sync
   - [ ] Navigation: All links point to new V2 routes
   - [ ] Mobile: Pages are responsive, tabs/cards stack properly

---

## File Summary

| Action   | File                                                      | Purpose                                   |
| -------- | --------------------------------------------------------- | ----------------------------------------- |
| Create   | `src/app/[locale]/dashboard/account/layout.tsx`           | Shared account layout with tab navigation |
| Create   | `src/app/[locale]/dashboard/account/page.tsx`             | Redirect to preferences                   |
| Create   | `src/app/[locale]/dashboard/account/preferences/page.tsx` | Appearance + Regional + Notifications     |
| Create   | `src/app/[locale]/dashboard/account/profile/page.tsx`     | Profile editing                           |
| Update   | `src/modules/user-account/config.ts`                      | Fix route paths                           |
| Update   | `src/components/v2/layout/header-user-menu.tsx`           | Fix navigation links                      |
| Update   | `src/components/v2/layout/quick-switcher.tsx`             | Fix settings link                         |
| Update   | `messages/en.json`                                        | Add English translations                  |
| Update   | `messages/pl.json`                                        | Add Polish translations                   |
| Optional | `src/lib/types/user-preferences.ts`                       | Add colorTheme to UiSettings              |
| Optional | `src/lib/stores/v2/ui-store.ts`                           | Add colorTheme state                      |

---

## Dependencies Between Steps

```
Step 1 (Layout) ──┬── Step 2 (Appearance)
                   ├── Step 3 (Regional)
                   ├── Step 4 (Notifications)
                   └── Step 5 (Profile)

Step 7 (i18n) ──── Can be done in parallel with Steps 2-5

Step 6 (Navigation) ──── After Steps 2-5 are done

Step 8 (Color sync) ──── After Step 2

Step 9 (QA) ──── After all steps
```

Steps 2, 3, 4, 5 can be built in parallel once Step 1 (layout) is in place.
Step 7 (i18n) can be done incrementally alongside each page.

---

## Estimated Scope

- **New files**: 4 (layout + redirect + 2 pages)
- **Updated files**: 4-5 (module config, nav components, i18n files)
- **Optional files**: 2 (type + store for color theme sync)
- **No new dependencies** - everything uses existing shadcn/ui + next-themes + React Query hooks
- **No database changes** - backend is complete
- **No new server actions** - all 10 actions are already implemented

---

**Last Updated**: 2026-02-03

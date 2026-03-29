# Legacy Surface Status

This file tracks the remaining legacy web surface after the first cleanup passes.

## Status buckets

### `keep_as_reference_only`

These areas still contain business knowledge or implementation details worth preserving, but they should no longer be treated as healthy runtime architecture.

- `dashboard-old/start`
  - Kept because it has not been fully refactored yet.
  - Important note: `dashboard-old` is globally redirected in [dashboard-old/layout.tsx](/Users/michal/dev/turbo/amba-system/apps/web/src/app/[locale]/dashboard-old/layout.tsx), so this is currently reference code, not a reliable live route surface.

- `dashboard-old/warehouse` and `src/modules/warehouse`
  - Kept as business reference for Warehouse V2.
  - Not acceptable as a V2 implementation template.

- `dashboard-old/teams` and `src/modules/teams`
  - Kept as business/reference surface.

- `dashboard-old/contacts` and `src/modules/contacts`
  - Kept as business/reference surface.

- `dashboard-old/announcements` and `dashboard-old/news`
  - Kept as reference content surfaces.

- `src/modules/support`
  - Kept as reference/config surface.

### `still_live_but_points_to_legacy_routes`

These are the most important remaining web cleanup risks.
They are still referenced by current code, but their destinations are old `dashboard-old` paths that are globally redirected away.

- `src/modules/home/config.ts`
  - Current module catalog still points to `/dashboard-old/start`.

- `src/modules/contacts/config.ts`
  - Current module catalog still points to `/dashboard-old/contacts`.

- `src/modules/teams/config.ts`
  - Current module catalog still points to `/dashboard-old/teams/*` and `/dashboard-old/announcements`.

- `src/modules/support/config.ts`
  - Current module catalog still points to `/dashboard-old/support/*`.

- `components/news/RecentNewsWidget.tsx`
  - View-all links still target `/dashboard-old/news`.

- `components/announcements/RecentAnnouncementsWidget.tsx`
  - View-all links still target `/dashboard-old/news`.

- `components/chat/MessagesDrawer.tsx`
  - Chat navigation still targets `/dashboard-old/teams/communication/chat`.

- `components/contacts/SendMessageButton.tsx`
  - Direct message navigation still targets `/dashboard-old/teams/communication/chat/[chatId]`.

### `removed_in_cleanup_passes`

- `dashboard-old/account`
- `dashboard-old/analytics`
- `dashboard-old/dev`
- `dashboard-old/development`
- `dashboard-old/docs`
- `dashboard-old/organization`
- `dashboard-old/profile`
- `dashboard-old/reset-password`
- dead legacy module folders for `analytics`, `development`, `documentation`
- unused legacy implementation files under `src/modules/organization-managment`
- unused legacy auth helpers under `src/utils/auth`

## Recommended next cleanup move

Do not remove the remaining legacy business-reference areas blindly.
The next safe step is to decide, module by module, whether current sidebar/module-catalog entries that still point at `dashboard-old/*` should:

1. be hidden,
2. be redirected to a V2 replacement,
3. or be kept only as archived reference code outside active navigation.

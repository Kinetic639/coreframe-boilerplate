# Removed Legacy Route Areas

This file tracks legacy `dashboard-old` route areas that were fully removed after their remaining references were cleaned up.

The goal is to keep a short business/reference record so the functionality can be reimplemented later in a clean V2 shape if needed.

## Removed on 2026-03-29

### `dashboard-old/account`

- Legacy account profile page
- Legacy account preferences page
- Replaced by V2 account routes under `/dashboard/account/*`

### `dashboard-old/analytics`

- Legacy activity overview
- Legacy activities list
- Legacy timeline
- Legacy reports
- Legacy test activity screen
- Replaced operationally by newer activity/audit surfaces; no longer kept as active route area

### `dashboard-old/dev`

- Legacy one-off subscription test area
- Removed as obsolete development-only surface

### `dashboard-old/development`

- Legacy internal debugging hub
- Included permissions debug, context debug, logo test, service test, labels test, locations debug, rich text editor, SKU generator, delivery debugger, status stepper, reservations test
- Removed as obsolete internal tooling surface

### `dashboard-old/docs`

- Legacy in-app documentation browser
- Included user docs, developer docs, and spec docs loading through legacy documentation helpers
- Removed as obsolete route area

### `dashboard-old/organization`

- Legacy organization profile
- Legacy branches page
- Legacy billing page
- Legacy users overview
- Legacy users list, invitations, roles, role details, user details
- Replaced by V2 organization routes under `/dashboard/organization/*`

### `dashboard-old/profile`

- Legacy standalone profile page
- Superseded by V2 account profile

### `dashboard-old/reset-password`

- Legacy reset-password route
- Superseded by `/reset-password`

## Notes

- `dashboard-old/start` was intentionally **not** removed in this cleanup pass because it has not been fully refactored yet.
- Legacy warehouse, teams, contacts, support, and other business-reference areas were also intentionally kept for now.

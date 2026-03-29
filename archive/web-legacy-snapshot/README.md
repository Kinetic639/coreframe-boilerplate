# Web Legacy Snapshot

This directory is a frozen snapshot of the pre-cleanup web application kept only for reference.

## Status

- Reference only
- Not part of the active runtime
- Not part of the current V2 architecture
- Temporary archive to support business-flow analysis and feature reimplementation

## Rules

- Do not import code from this directory into active apps or shared packages.
- Do not treat this snapshot as an active app.
- Do not add new feature work here.
- Use it only to inspect old business flows, screens, domain behavior, and legacy implementation details.

## Source of Truth

The active web application is under:

- [apps/web](/Users/michal/dev/turbo/amba-system/apps/web)

All new V2 work must happen there.

## Removal Plan

This snapshot should be deleted after the legacy modules and business flows have been reimplemented or superseded in the active V2 web app.

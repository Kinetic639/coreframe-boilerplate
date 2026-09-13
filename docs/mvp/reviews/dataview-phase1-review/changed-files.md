# DataView Phase 1 changed files

- Baseline: `be2bf1ca88e1292e5d3825c53dd040394c506679`
- Implementation files: 67 (56 modified, 11 added).
- Review-bundle files are excluded from the implementation patch.

| Status   | Path                                                                                                           | Review relevance                                                       |
| -------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Modified | `apps/web/messages/en.json`                                                                                    | Phase 1 state copy.                                                    |
| Modified | `apps/web/messages/pl.json`                                                                                    | Phase 1 state copy.                                                    |
| Modified | `apps/web/src/app/[locale]/dashboard/crm/contacts/_components/crm-contacts-client.tsx`                         | Current consumer scope propagation based on fetch inputs.              |
| Modified | `apps/web/src/app/[locale]/dashboard/crm/parties/_components/crm-parties-client.tsx`                           | Current consumer scope propagation based on fetch inputs.              |
| Modified | `apps/web/src/app/[locale]/dashboard/data-view-demo/data-view-demo-client.tsx`                                 | Phase 1 implementation.                                                |
| Modified | `apps/web/src/app/[locale]/dashboard/help-desk/ticket-types/_components/ticket-types-client.tsx`               | Help Desk SSR/client scope and mutation invalidation integration.      |
| Modified | `apps/web/src/app/[locale]/dashboard/help-desk/tickets/[ticketId]/_components/ticket-detail-client.tsx`        | Help Desk SSR/client scope and mutation invalidation integration.      |
| Modified | `apps/web/src/app/[locale]/dashboard/help-desk/tickets/_components/tickets-client.tsx`                         | Help Desk SSR/client scope and mutation invalidation integration.      |
| Modified | `apps/web/src/app/[locale]/dashboard/help-desk/tickets/page.tsx`                                               | Help Desk SSR/client scope and mutation invalidation integration.      |
| Modified | `apps/web/src/app/[locale]/dashboard/organization/branches/__tests__/branches-client.test.tsx`                 | Focused DataView or consumer regression coverage.                      |
| Modified | `apps/web/src/app/[locale]/dashboard/organization/branches/_components/branches-client.tsx`                    | Current consumer scope propagation based on fetch inputs.              |
| Modified | `apps/web/src/app/[locale]/dashboard/organization/branches/page.tsx`                                           | Current consumer scope propagation based on fetch inputs.              |
| Modified | `apps/web/src/app/[locale]/dashboard/organization/users/invitations/__tests__/invitations-client.test.tsx`     | Focused DataView or consumer regression coverage.                      |
| Modified | `apps/web/src/app/[locale]/dashboard/organization/users/invitations/_components/invitations-client.tsx`        | Current consumer scope propagation based on fetch inputs.              |
| Modified | `apps/web/src/app/[locale]/dashboard/organization/users/invitations/page.tsx`                                  | Current consumer scope propagation based on fetch inputs.              |
| Modified | `apps/web/src/app/[locale]/dashboard/organization/users/members/__tests__/members-client.test.tsx`             | Focused DataView or consumer regression coverage.                      |
| Modified | `apps/web/src/app/[locale]/dashboard/organization/users/members/_components/members-client.tsx`                | Current consumer scope propagation based on fetch inputs.              |
| Modified | `apps/web/src/app/[locale]/dashboard/organization/users/members/page.tsx`                                      | Current consumer scope propagation based on fetch inputs.              |
| Modified | `apps/web/src/app/[locale]/dashboard/organization/users/positions/__tests__/positions-client.test.tsx`         | Focused DataView or consumer regression coverage.                      |
| Modified | `apps/web/src/app/[locale]/dashboard/organization/users/positions/_components/positions-client.tsx`            | Current consumer scope propagation based on fetch inputs.              |
| Modified | `apps/web/src/app/[locale]/dashboard/organization/users/positions/page.tsx`                                    | Current consumer scope propagation based on fetch inputs.              |
| Modified | `apps/web/src/app/[locale]/dashboard/organization/users/roles/__tests__/roles-client.test.tsx`                 | Focused DataView or consumer regression coverage.                      |
| Modified | `apps/web/src/app/[locale]/dashboard/organization/users/roles/_components/roles-client.tsx`                    | Current consumer scope propagation based on fetch inputs.              |
| Modified | `apps/web/src/app/[locale]/dashboard/organization/users/roles/page.tsx`                                        | Current consumer scope propagation based on fetch inputs.              |
| Modified | `apps/web/src/app/[locale]/dashboard/planning/tasks/_components/tasks-client.tsx`                              | Current consumer scope propagation based on fetch inputs.              |
| Modified | `apps/web/src/app/[locale]/dashboard/qr/_components/qr-management-client.tsx`                                  | Current consumer scope propagation based on fetch inputs.              |
| Modified | `apps/web/src/app/[locale]/dashboard/qr/page.tsx`                                                              | Current consumer scope propagation based on fetch inputs.              |
| Modified | `apps/web/src/app/[locale]/dashboard/warehouse/inventory/_components/inventory-client.tsx`                     | Warehouse branch-scoped DataView integration.                          |
| Modified | `apps/web/src/app/[locale]/dashboard/warehouse/inventory/movements/_components/inventory-movements-client.tsx` | Warehouse branch-scoped DataView integration.                          |
| Modified | `apps/web/src/app/[locale]/dashboard/warehouse/inventory/movements/page.tsx`                                   | Warehouse branch-scoped DataView integration.                          |
| Modified | `apps/web/src/app/[locale]/dashboard/warehouse/inventory/page.tsx`                                             | Warehouse branch-scoped DataView integration.                          |
| Modified | `apps/web/src/app/[locale]/dashboard/warehouse/items/_components/inventory-products-client.tsx`                | Products branch-scoped SSR/client integration.                         |
| Added    | `apps/web/src/app/[locale]/dashboard/warehouse/items/_lib/__tests__/compound-selection-ssr.test.tsx`           | Products compound-selection SSR hydration regression.                  |
| Added    | `apps/web/src/app/[locale]/dashboard/warehouse/items/_lib/prefetch-inventory-product-detail.ts`                | Products-specific SSR prefetch adapter preserving full cache identity. |
| Modified | `apps/web/src/app/[locale]/dashboard/warehouse/items/page.tsx`                                                 | Products branch-scoped SSR/client integration.                         |
| Modified | `apps/web/src/app/[locale]/dashboard/warehouse/locations/_components/ambra-locations-client.tsx`               | Warehouse branch-scoped DataView integration.                          |
| Modified | `apps/web/src/app/[locale]/dashboard/warehouse/locations/_components/locations-data-view.tsx`                  | Warehouse branch-scoped DataView integration.                          |
| Modified | `apps/web/src/app/[locale]/dashboard/warehouse/locations/page.tsx`                                             | Warehouse branch-scoped DataView integration.                          |
| Modified | `apps/web/src/app/actions/help-desk/index.ts`                                                                  | Help Desk SSR/client scope and mutation invalidation integration.      |
| Added    | `apps/web/src/components/data-view/README.md`                                                                  | Accepted DataView Phase 1 foundation and scoped query propagation.     |
| Added    | `apps/web/src/components/data-view/__tests__/data-view-foundation.test.ts`                                     | Focused DataView or consumer regression coverage.                      |
| Added    | `apps/web/src/components/data-view/__tests__/data-view-hydration.test.tsx`                                     | Focused DataView or consumer regression coverage.                      |
| Added    | `apps/web/src/components/data-view/__tests__/data-view-url-state.test.tsx`                                     | Focused DataView or consumer regression coverage.                      |
| Modified | `apps/web/src/components/data-view/__tests__/data-view.test.tsx`                                               | Focused DataView or consumer regression coverage.                      |
| Modified | `apps/web/src/components/data-view/data-view-columns.tsx`                                                      | Accepted DataView Phase 1 foundation and scoped query propagation.     |
| Modified | `apps/web/src/components/data-view/data-view-detail.tsx`                                                       | Accepted DataView Phase 1 foundation and scoped query propagation.     |
| Modified | `apps/web/src/components/data-view/data-view-layout.tsx`                                                       | Accepted DataView Phase 1 foundation and scoped query propagation.     |
| Modified | `apps/web/src/components/data-view/data-view-mobile-layout.tsx`                                                | Accepted DataView Phase 1 foundation and scoped query propagation.     |
| Modified | `apps/web/src/components/data-view/data-view-pagination.tsx`                                                   | Accepted DataView Phase 1 foundation and scoped query propagation.     |
| Modified | `apps/web/src/components/data-view/data-view-provider.tsx`                                                     | Accepted DataView Phase 1 foundation and scoped query propagation.     |
| Added    | `apps/web/src/components/data-view/data-view-query-keys.ts`                                                    | Scoped canonical keys, invalidation, and sidebar freshness policy.     |
| Modified | `apps/web/src/components/data-view/data-view-search-params.ts`                                                 | Accepted DataView Phase 1 foundation and scoped query propagation.     |
| Modified | `apps/web/src/components/data-view/data-view-sidebar.tsx`                                                      | Accepted DataView Phase 1 foundation and scoped query propagation.     |
| Added    | `apps/web/src/components/data-view/data-view-ssr.ts`                                                           | Scoped request-time prefetch helpers.                                  |
| Modified | `apps/web/src/components/data-view/data-view-table.tsx`                                                        | Accepted DataView Phase 1 foundation and scoped query propagation.     |
| Modified | `apps/web/src/components/data-view/data-view-toolbar.tsx`                                                      | Accepted DataView Phase 1 foundation and scoped query propagation.     |
| Modified | `apps/web/src/components/data-view/data-view-url-state.ts`                                                     | Accepted DataView Phase 1 foundation and scoped query propagation.     |
| Modified | `apps/web/src/components/data-view/data-view.tsx`                                                              | Accepted DataView Phase 1 foundation and scoped query propagation.     |
| Modified | `apps/web/src/components/data-view/data-view.types.ts`                                                         | Accepted DataView Phase 1 foundation and scoped query propagation.     |
| Modified | `apps/web/src/components/data-view/use-data-view-query.ts`                                                     | Accepted DataView Phase 1 foundation and scoped query propagation.     |
| Modified | `apps/web/src/components/tools/qr-generator/index.tsx`                                                         | Current consumer scope propagation based on fetch inputs.              |
| Added    | `apps/web/src/hooks/queries/help-desk/__tests__/data-view-invalidation.test.tsx`                               | Focused DataView or consumer regression coverage.                      |
| Modified | `apps/web/src/hooks/queries/help-desk/index.ts`                                                                | Help Desk SSR/client scope and mutation invalidation integration.      |
| Added    | `apps/web/src/lib/data-view/ambra-data-view-scope.ts`                                                          | Ambra-specific scope convenience constructors outside DataView core.   |
| Modified | `apps/web/src/lib/data-view/types.ts`                                                                          | Domain-agnostic primitive-only DataView scope contract.                |
| Added    | `apps/web/src/lib/warehouse/inventory-product-selection.ts`                                                    | Shared Products selection-to-domain-ID normalization.                  |
| Modified | `apps/web/src/server/services/helpdesk-tickets.service.ts`                                                     | Phase 1 implementation.                                                |

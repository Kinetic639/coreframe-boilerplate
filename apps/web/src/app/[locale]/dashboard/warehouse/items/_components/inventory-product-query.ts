export const inventoryProductKeys = {
  all: ["inventory-product-detail"] as const,
  detail: (scope: string, productId: string) =>
    [...inventoryProductKeys.all, scope, productId] as const,
};

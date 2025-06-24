import React from "react";

async function simulateLoading(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default async function CatalogProductsPage() {
  await simulateLoading(2000);

  return <div className="text-xl">Katalog produktów</div>;
}

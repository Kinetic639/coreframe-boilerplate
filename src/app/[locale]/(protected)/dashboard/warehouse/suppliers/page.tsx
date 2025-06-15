import React from "react";

async function simulateLoading(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default async function DeliveriesPage() {
  // ⏳ sztuczne opóźnienie renderu (np. 2s)
  await simulateLoading(2000);

  return <div className="text-xl">📦 Deliveries loaded!</div>;
}

"use client";

import { SubscriptionTest } from "@/components/dev/subscription-test";

export default function SubscriptionTestPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">Subscription System Test</h1>
        <p className="text-muted-foreground">
          This page is only visible in development mode and demonstrates the subscription system
          functionality.
        </p>
      </div>

      <SubscriptionTest />
    </div>
  );
}

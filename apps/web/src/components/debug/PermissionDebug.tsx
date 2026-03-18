"use client";

import { useUserStore } from "@/lib/stores/user-store";

export default function PermissionDebug() {
  const permissions = useUserStore((s) => s.permissions);
  const roles = useUserStore((s) => s.roles);
  const isLoaded = useUserStore((s) => s.isLoaded);

  return (
    <div className="rounded-md border bg-muted p-4">
      <h2 className="font-bold">🔐 Debug Permissions</h2>
      <p>
        <strong>isLoaded:</strong> {String(isLoaded)}
      </p>
      <strong>Roles:</strong>
      <pre className="text-xs">{JSON.stringify(roles, null, 2)}</pre>
      <strong>Permissions:</strong>{" "}
      <pre className="text-xs text-foreground">{JSON.stringify(permissions, null, 2)}</pre>
    </div>
  );
}

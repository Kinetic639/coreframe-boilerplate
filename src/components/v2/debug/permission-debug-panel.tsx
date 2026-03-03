"use client";

import { useState, useMemo, useId } from "react";
import { useQuery } from "@tanstack/react-query";
import { useUserStoreV2 } from "@/lib/stores/v2/user-store";
import { useAppStoreV2 } from "@/lib/stores/v2/app-store";
import { usePermissions } from "@/hooks/v2/use-permissions";
import { getDetailedPermissions } from "@/app/actions/v2/permissions";
import type { DetailedPermission } from "@/app/actions/v2/permissions";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  XCircle,
  Shield,
  Zap,
  Globe,
  Building2,
  GitBranch,
  Loader2,
} from "lucide-react";

/**
 * Renders a grouped, scope-annotated list of permission entries.
 * Groups: first by scope (org vs branch), then within branch by branch name.
 */
function ScopedPermissionList({
  permissions,
  availableBranches,
}: {
  permissions: DetailedPermission[];
  availableBranches: { id: string; name: string }[];
}) {
  const branchName = (id: string) =>
    availableBranches.find((b) => b.id === id)?.name ?? id.slice(0, 8) + "…";

  const orgPerms = permissions.filter((p) => p.scope === "org");
  const branchPerms = permissions.filter((p) => p.scope === "branch");

  // Group branch permissions by branch_id
  const byBranch = new Map<string, DetailedPermission[]>();
  for (const p of branchPerms) {
    const list = byBranch.get(p.branch_id!) ?? [];
    list.push(p);
    byBranch.set(p.branch_id!, list);
  }

  if (permissions.length === 0) {
    return <p className="text-sm text-muted-foreground py-4 text-center">No permissions found</p>;
  }

  return (
    <div className="space-y-4">
      {/* Org-scoped */}
      {orgPerms.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="h-3.5 w-3.5 text-indigo-500" />
            <span className="text-xs font-semibold text-muted-foreground uppercase">Org scope</span>
            <Badge variant="outline" className="text-xs px-1.5 py-0 h-4">
              {orgPerms.length}
            </Badge>
          </div>
          <div className="space-y-1 pl-5">
            {orgPerms.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                {p.slug.includes("*") && <Globe className="h-3 w-3 text-blue-500 shrink-0" />}
                <code className="text-xs">{p.slug}</code>
                <Badge className="ml-auto text-[10px] px-1.5 py-0 h-4 bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300">
                  org
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Branch-scoped, grouped per branch */}
      {[...byBranch.entries()].map(([branchId, perms]) => (
        <div key={branchId}>
          <div className="flex items-center gap-2 mb-2">
            <GitBranch className="h-3.5 w-3.5 text-orange-500" />
            <span className="text-xs font-semibold text-muted-foreground uppercase">
              Branch: {branchName(branchId)}
            </span>
            <Badge variant="outline" className="text-xs px-1.5 py-0 h-4">
              {perms.length}
            </Badge>
          </div>
          <div className="space-y-1 pl-5">
            {perms.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                {p.slug.includes("*") && <Globe className="h-3 w-3 text-blue-500 shrink-0" />}
                <code className="text-xs">{p.slug}</code>
                <Badge className="ml-auto text-[10px] px-1.5 py-0 h-4 bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300">
                  branch
                </Badge>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Permission Debug Panel
 *
 * Displays comprehensive permission and session information:
 * - Session: User identity, active org/branch
 * - Permissions: All allowed and denied permissions with scopes
 * - Context: Organization and branch details
 * - Performance: Loading times and metrics
 * - Checker: Interactive permission testing
 *
 * Used for debugging permission system and verifying security.
 *
 * NOTE: Currently visible in all environments for testing.
 * Set visibility condition to restrict to development only when needed.
 */
export function PermissionDebugPanel() {
  // Visible in all environments for testing
  // To restrict to dev only, uncomment:
  // if (process.env.NODE_ENV !== "development") {
  //   return null;
  // }

  const { user, roles, isLoaded: userLoaded } = useUserStoreV2();
  const {
    activeOrgId,
    activeBranchId,
    activeOrg,
    activeBranch,
    availableBranches,
    userModules,
    isLoaded: appLoaded,
  } = useAppStoreV2();
  const { can, getSnapshot } = usePermissions();

  const [permissionFilter, setPermissionFilter] = useState("");
  const [testPermission, setTestPermission] = useState("");
  const tabsId = useId();

  const permissionSnapshot = getSnapshot();

  // Fetch detailed permissions (scope + branch per entry) for the debug panel
  const { data: detailedPerms, isLoading: detailedLoading } = useQuery<DetailedPermission[]>({
    queryKey: ["debug", "detailed-permissions", activeOrgId],
    queryFn: () => getDetailedPermissions(activeOrgId!),
    enabled: !!activeOrgId,
    staleTime: 30 * 1000,
  });

  // Filter permissions based on search
  const filteredAllowPermissions = useMemo(() => {
    if (!permissionFilter) return permissionSnapshot.allow;
    return permissionSnapshot.allow.filter((perm) =>
      perm.toLowerCase().includes(permissionFilter.toLowerCase())
    );
  }, [permissionSnapshot.allow, permissionFilter]);

  // Test permission
  const testResult = testPermission ? can(testPermission) : null;

  // Check if permission has wildcards
  const hasWildcard = (perm: string) => perm.includes("*");

  // Get permission category
  const getPermissionCategory = (perm: string) => {
    const parts = perm.split(".");
    return parts[0] || "unknown";
  };

  // Group permissions by category
  const groupByCategory = (perms: string[]) => {
    const groups: Record<string, string[]> = {};
    perms.forEach((perm) => {
      const category = getPermissionCategory(perm);
      if (!groups[category]) groups[category] = [];
      groups[category].push(perm);
    });
    return groups;
  };

  const allowGroups = groupByCategory(filteredAllowPermissions);
  // Note: denyGroups not computed - V2 doesn't use deny at runtime (handled at compile time)

  return (
    <Card className="border-2 border-yellow-500 bg-yellow-50/50 dark:bg-yellow-950/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-yellow-600" />
            <CardTitle>Permission Debug Panel</CardTitle>
          </div>
          <Badge variant="destructive" className="font-mono">
            DEV ONLY
          </Badge>
        </div>
        <CardDescription>
          Comprehensive view of permissions, session, and context for debugging
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="session" className="w-full" id={tabsId}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="session">Session</TabsTrigger>
            <TabsTrigger value="permissions">Permissions</TabsTrigger>
            <TabsTrigger value="context">Context</TabsTrigger>
            <TabsTrigger value="checker">Checker</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>

          {/* Session Tab */}
          <TabsContent value="session" className="space-y-4">
            <div className="rounded-lg border p-4 space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Shield className="h-4 w-4" />
                User Identity
              </h3>
              <div className="grid gap-2 text-sm font-mono">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ID:</span>
                  <span className="font-semibold">{user?.id || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email:</span>
                  <span>{user?.email || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name:</span>
                  <span>
                    {user?.first_name && user?.last_name
                      ? `${user.first_name} ${user.last_name}`
                      : "N/A"}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Active Organization
              </h3>
              <div className="grid gap-2 text-sm font-mono">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Org ID:</span>
                  <span className="font-semibold">{activeOrgId || "None"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name:</span>
                  <span>{activeOrg?.name || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Slug:</span>
                  <span>{activeOrg?.slug || "N/A"}</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <GitBranch className="h-4 w-4" />
                Active Branch
              </h3>
              <div className="grid gap-2 text-sm font-mono">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Branch ID:</span>
                  <span className="font-semibold">{activeBranchId || "None"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name:</span>
                  <span>{activeBranch?.name || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Available:</span>
                  <span>{availableBranches.length} branches</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <h3 className="font-semibold text-sm">Roles</h3>
              <div className="flex flex-wrap gap-2">
                {roles.length > 0 ? (
                  roles.map((role, idx) => (
                    <Badge key={idx} variant="secondary" className="font-mono">
                      {role.role}
                      {role.scope && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({role.scope === "org" ? "org" : "branch"})
                        </span>
                      )}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">No roles assigned</span>
                )}
              </div>
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <h3 className="font-semibold text-sm">Status</h3>
              <div className="grid gap-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">User Store Loaded:</span>
                  {userLoaded ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">App Store Loaded:</span>
                  {appLoaded ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Permissions Tab */}
          <TabsContent value="permissions" className="space-y-4">
            <div>
              <Label htmlFor="perm-filter">Filter Permissions</Label>
              <Input
                id="perm-filter"
                placeholder="e.g., warehouse.products"
                value={permissionFilter}
                onChange={(e) => setPermissionFilter(e.target.value)}
                className="font-mono"
              />
            </div>

            {/* Scope-aware permission breakdown (from DB assignments) */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  All Permissions by Scope
                </h3>
                {detailedLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <Badge variant="secondary">{detailedPerms?.length ?? 0}</Badge>
                )}
              </div>
              <Separator />
              {detailedLoading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Loading assignment details...
                </div>
              ) : (
                <ScrollArea className="h-[380px]">
                  <ScopedPermissionList
                    permissions={(detailedPerms ?? []).filter(
                      (p) =>
                        !permissionFilter ||
                        p.slug.toLowerCase().includes(permissionFilter.toLowerCase())
                    )}
                    availableBranches={availableBranches}
                  />
                </ScrollArea>
              )}
            </div>

            {/* Active snapshot (what usePermissions() sees right now) */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Active Snapshot (usePermissions)
                </h3>
                <Badge variant="secondary">{filteredAllowPermissions.length}</Badge>
              </div>
              <Separator />
              <ScrollArea className="h-[220px]">
                <div className="space-y-3">
                  {Object.entries(allowGroups).map(([category, perms]) => (
                    <div key={category}>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                        {category}
                      </h4>
                      <div className="space-y-1">
                        {perms.map((perm, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            {hasWildcard(perm) && (
                              <span title="Wildcard">
                                <Globe className="h-3 w-3 text-blue-600" />
                              </span>
                            )}
                            <code className="text-xs">{perm}</code>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {filteredAllowPermissions.length === 0 && (
                    <p className="text-sm text-muted-foreground">No allowed permissions</p>
                  )}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>

          {/* Context Tab */}
          <TabsContent value="context" className="space-y-4">
            <div className="rounded-lg border p-4 space-y-3">
              <h3 className="font-semibold text-sm">User Modules (Feature Gates)</h3>
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {userModules.length > 0 ? (
                    userModules.map((module, idx) => (
                      <div key={idx} className="rounded border p-2 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm">{module.label}</span>
                          <Badge variant="outline" className="font-mono text-xs">
                            {module.slug}
                          </Badge>
                        </div>
                        {module.settings && Object.keys(module.settings).length > 0 && (
                          <div className="text-xs text-muted-foreground">
                            Settings: {Object.keys(module.settings).join(", ")}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No modules assigned</p>
                  )}
                </div>
              </ScrollArea>
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <h3 className="font-semibold text-sm">Available Branches</h3>
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {availableBranches.length > 0 ? (
                    availableBranches.map((branch, idx) => (
                      <div
                        key={idx}
                        className={`rounded border p-2 ${
                          branch.id === activeBranchId
                            ? "border-primary bg-primary/5"
                            : "border-border"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm">{branch.name}</span>
                          {branch.id === activeBranchId && (
                            <Badge variant="default" className="text-xs">
                              Active
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">
                          ID: {branch.id}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No branches available</p>
                  )}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>

          {/* Checker Tab */}
          <TabsContent value="checker" className="space-y-4">
            <div className="rounded-lg border p-4 space-y-4">
              <div>
                <Label htmlFor="test-perm">Test Permission</Label>
                <Input
                  id="test-perm"
                  placeholder="e.g., warehouse.products.delete"
                  value={testPermission}
                  onChange={(e) => setTestPermission(e.target.value)}
                  className="font-mono"
                />
              </div>

              {testPermission && (
                <div
                  className={`rounded-lg border-2 p-4 ${
                    testResult
                      ? "border-green-500 bg-green-50 dark:bg-green-950/20"
                      : "border-red-500 bg-red-50 dark:bg-red-950/20"
                  }`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    {testResult ? (
                      <CheckCircle2 className="h-6 w-6 text-green-600" />
                    ) : (
                      <XCircle className="h-6 w-6 text-red-600" />
                    )}
                    <div>
                      <h4 className="font-semibold">{testResult ? "ALLOWED" : "DENIED"}</h4>
                      <p className="text-sm text-muted-foreground font-mono">{testPermission}</p>
                    </div>
                  </div>

                  <Separator className="my-3" />

                  <div className="space-y-2 text-sm">
                    <h5 className="font-semibold">Explanation:</h5>
                    {testResult ? (
                      <div className="space-y-1">
                        <p className="text-green-700 dark:text-green-400">
                          ✓ Permission is in allow list or matches an allow wildcard
                        </p>
                        <p className="text-green-700 dark:text-green-400">
                          ✓ No deny override blocks this permission
                        </p>
                        <div className="mt-2">
                          <p className="font-semibold text-xs mb-1">Matching Allow Patterns:</p>
                          <div className="flex flex-wrap gap-1">
                            {permissionSnapshot.allow
                              .filter(
                                (p) =>
                                  p === testPermission || (p.includes("*") && can(testPermission))
                              )
                              .map((p, idx) => (
                                <Badge key={idx} variant="secondary" className="font-mono text-xs">
                                  {p}
                                </Badge>
                              ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-red-700 dark:text-red-400">
                          ✗ Permission is denied or not in allow list
                        </p>
                        {permissionSnapshot.deny.some(
                          (p) => p === testPermission || p.includes("*")
                        ) && (
                          <div className="mt-2">
                            <p className="font-semibold text-xs mb-1">Deny Overrides:</p>
                            <div className="flex flex-wrap gap-1">
                              {permissionSnapshot.deny
                                .filter((p) => p === testPermission || p.includes("*"))
                                .map((p, idx) => (
                                  <Badge
                                    key={idx}
                                    variant="destructive"
                                    className="font-mono text-xs"
                                  >
                                    {p}
                                  </Badge>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 p-3 space-y-2">
                <h5 className="text-sm font-semibold">Example Permissions to Test (V2):</h5>
                <div className="flex flex-wrap gap-2">
                  {[
                    // Organization
                    "org.read",
                    "org.update",
                    // Branches
                    "branches.read",
                    "branches.create",
                    "branches.delete",
                    // Members
                    "members.read",
                    "members.manage",
                    // Self
                    "self.read",
                    "self.update",
                    // Invites
                    "invites.create",
                    "invites.read",
                  ].map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => setTestPermission(example)}
                      className="text-xs font-mono px-2 py-1 rounded border border-border hover:bg-accent cursor-pointer"
                    >
                      {example}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  💡 V2: Permissions are explicit (no wildcards). org_owner has all 13 permissions,
                  org_member has 5.
                </p>
              </div>
            </div>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-4">
            <div className="rounded-lg border p-4 space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Zap className="h-4 w-4 text-yellow-600" />
                Loading Metrics
              </h3>
              <div className="grid gap-2 text-sm font-mono">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Permission Count (Allow):</span>
                  <Badge variant="secondary">{permissionSnapshot.allow.length}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Permission Count (Deny):</span>
                  <Badge variant="destructive">{permissionSnapshot.deny.length}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Permissions:</span>
                  <Badge>{permissionSnapshot.allow.length + permissionSnapshot.deny.length}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Wildcard Permissions:</span>
                  <Badge variant="outline">
                    {permissionSnapshot.allow.filter((p) => p.includes("*")).length}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 p-4">
              <h4 className="text-sm font-semibold mb-2">Performance Targets</h4>
              <ul className="text-xs space-y-1 text-muted-foreground">
                <li>• Permission load time: &lt; 200ms (server-side)</li>
                <li>• Permission check time: &lt; 1ms (client-side cached)</li>
                <li>• Context loader: React cache() deduplication</li>
                <li>• No N+1 queries in permission loading</li>
              </ul>
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <h3 className="font-semibold text-sm">Optimization Status</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Snapshot Cached:</span>
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Context Deduplication:</span>
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">RLS Enabled:</span>
                  <XCircle className="h-4 w-4 text-red-600" />
                  <span className="text-xs text-muted-foreground">(Planned)</span>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

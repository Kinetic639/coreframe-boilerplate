"use client";

import { useState, useMemo } from "react";
import { useUserStoreV2 } from "@/lib/stores/v2/user-store";
import { useAppStoreV2 } from "@/lib/stores/v2/app-store";
import { usePermissions } from "@/hooks/v2/use-permissions";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, XCircle, Shield, Zap, Globe, Building2, GitBranch } from "lucide-react";

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

  const permissionSnapshot = getSnapshot();

  // Filter permissions based on search
  const filteredAllowPermissions = useMemo(() => {
    if (!permissionFilter) return permissionSnapshot.allow;
    return permissionSnapshot.allow.filter((perm) =>
      perm.toLowerCase().includes(permissionFilter.toLowerCase())
    );
  }, [permissionSnapshot.allow, permissionFilter]);

  const filteredDenyPermissions = useMemo(() => {
    if (!permissionFilter) return permissionSnapshot.deny;
    return permissionSnapshot.deny.filter((perm) =>
      perm.toLowerCase().includes(permissionFilter.toLowerCase())
    );
  }, [permissionSnapshot.deny, permissionFilter]);

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
        <Tabs defaultValue="session" className="w-full">
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

            <div className="grid gap-4 md:grid-cols-2">
              {/* Allowed Permissions */}
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Allowed Permissions
                  </h3>
                  <Badge variant="secondary">{filteredAllowPermissions.length}</Badge>
                </div>
                <Separator />
                <ScrollArea className="h-[400px]">
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

              {/* Denied Permissions - V2: Always empty (deny handled at compile time) */}
              <div className="rounded-lg border p-4 space-y-3 opacity-60">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-600" />
                    Denied Permissions
                  </h3>
                  <Badge variant="secondary">{filteredDenyPermissions.length}</Badge>
                </div>
                <Separator />
                <div className="p-4 text-center">
                  <p className="text-sm text-muted-foreground mb-2">✅ Always empty in V2</p>
                  <p className="text-xs text-muted-foreground">
                    In V2 architecture, deny overrides are applied during compilation. The effective
                    permissions table only contains what you CAN do.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 p-4">
              <h4 className="text-sm font-semibold mb-2">
                Permission System V2 - &quot;Compile, don&apos;t evaluate&quot;
              </h4>
              <ul className="text-xs space-y-1 text-muted-foreground">
                <li>
                  • <strong>Compiled permissions:</strong> Permissions are calculated when
                  roles/overrides change, not at request time
                </li>
                <li>
                  • <strong>No wildcards at runtime:</strong> Wildcards are expanded during
                  compilation
                </li>
                <li>
                  • <strong>No deny at runtime:</strong> Deny overrides are applied during
                  compilation (deny list is always empty)
                </li>
                <li>
                  • <strong>Simple checks:</strong> Just check if permission exists in allow list
                </li>
                <li>
                  • <strong>Debugging:</strong> Query `user_effective_permissions` table to see
                  compiled facts
                </li>
              </ul>
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

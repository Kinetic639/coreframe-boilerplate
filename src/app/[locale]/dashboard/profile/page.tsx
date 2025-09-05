"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  User,
  Shield,
  Building2,
  Settings,
  Key,
  Mail,
  Calendar,
  AlertCircle,
  Loader2,
  Edit2,
  Save,
  X,
  CheckCircle,
  Info,
  Users,
  Globe,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { updateUserProfile, fetchAvailablePermissions } from "@/lib/api/user-detail";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";

interface Permission {
  id: string;
  slug: string;
  label: string | null;
}

interface UserRole {
  id: string;
  role: {
    id: string;
    name: string;
    description: string | null;
    is_basic: boolean;
  };
  scope: "org" | "branch";
  scope_id: string;
  scope_name?: string;
}

interface UserPermissionOverride {
  id: string;
  permission: Permission;
  allowed: boolean;
  scope: "org" | "branch";
  scope_id: string;
}

interface UserProfile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  default_branch_id: string | null;
  status_id: string | null;
  created_at: string;
  organization: { id: string; name: string } | null;
  roles: UserRole[];
  permissionOverrides: UserPermissionOverride[];
  branch: { id: string; name: string } | null;
  availableBranches: { id: string; name: string }[];
  computedPermissions: { [permissionSlug: string]: boolean };
}

export default function ProfilePage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    default_branch_id: "",
  });

  // Fetch current user profile and permissions
  const fetchProfile = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const supabase = createClient();

      // Get current user from Supabase auth
      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError) {
        console.error("Auth error:", authError);
        throw new Error(`Authentication error: ${authError.message}`);
      }

      if (!authUser) {
        throw new Error("User not authenticated");
      }

      // console.log("Auth user:", authUser.id);

      // Fetch user basic info
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("id", authUser.id)
        .single();

      if (userError) {
        console.error("User data error:", userError);
        throw new Error(`Failed to fetch user data: ${userError.message}`);
      }

      // console.log("User data:", userData);

      // Fetch user's organization from user_preferences
      const { data: userPrefs, error: prefsError } = await supabase
        .from("user_preferences")
        .select(
          `
          organization_id,
          organization:organizations(id, name),
          default_branch_id
        `
        )
        .eq("user_id", authUser.id)
        .is("deleted_at", null)
        .single();

      if (prefsError) {
        console.error("User preferences error:", prefsError);
        throw new Error(`Failed to fetch user preferences: ${prefsError.message}`);
      }

      // console.log("User preferences:", userPrefs);

      if (!userPrefs?.organization_id) {
        throw new Error("User has no organization assigned");
      }

      const organizationId = userPrefs.organization_id;
      const organization = userPrefs.organization;

      // Fetch available branches for this organization
      const { data: branches, error: branchesError } = await supabase
        .from("branches")
        .select("id, name")
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .order("name");

      if (branchesError) {
        console.warn(`Failed to fetch branches: ${branchesError.message}`);
      }

      const availableBranches = branches || [];

      // Fetch user roles in this organization
      const { data: roleAssignments, error: roleError } = await supabase
        .from("user_role_assignments")
        .select(
          `
          *,
          role:roles(*)
        `
        )
        .eq("user_id", authUser.id)
        .eq("scope_id", organizationId)
        .is("deleted_at", null);

      if (roleError) {
        console.error("Role assignments error:", roleError);
        throw new Error(`Failed to fetch role assignments: ${roleError.message}`);
      }

      console.log("Role assignments:", roleAssignments);

      // Process roles with scope names
      let roles: UserRole[] = [];
      if (roleAssignments) {
        const branchIds = roleAssignments
          .filter((ra) => ra.scope === "branch")
          .map((ra) => ra.scope_id);

        const branchMap = new Map<string, string>();
        if (branchIds.length > 0) {
          const { data: branchData } = await supabase
            .from("branches")
            .select("id, name")
            .in("id", branchIds)
            .is("deleted_at", null);

          branchData?.forEach((branch) => branchMap.set(branch.id, branch.name || ""));
        }

        // Combine role assignments with role details
        roles = roleAssignments.map((assignment) => ({
          ...assignment,
          scope_name:
            assignment.scope === "org"
              ? (organization as any)?.name || "Organization"
              : branchMap.get(assignment.scope_id) || "Branch",
        }));
      }

      // Fetch user's default branch details
      let branch: { id: string; name: string } | null = null;
      const defaultBranchId = userData.default_branch_id || userPrefs.default_branch_id;
      if (defaultBranchId) {
        const branchData = availableBranches.find((b) => b.id === defaultBranchId);
        if (branchData) {
          branch = branchData;
        }
      }

      // Fetch permission overrides
      const { data: permissionOverrides, error: overridesError } = await supabase
        .from("user_permission_overrides")
        .select(
          `
          *,
          permission:permissions(*)
        `
        )
        .eq("user_id", authUser.id)
        .eq("scope_id", organizationId)
        .is("deleted_at", null);

      if (overridesError) {
        console.warn(`Failed to fetch permission overrides: ${overridesError.message}`);
      }

      // Fetch all permissions to compute user's actual permissions
      const permissions = await fetchAvailablePermissions();
      setAllPermissions(permissions);

      // Compute user's actual permissions
      const computedPermissions: { [key: string]: boolean } = {};
      permissions.forEach((permission) => {
        // Check if user has override for this permission
        const override = permissionOverrides?.find((po) => po.permission_id === permission.id);
        if (override) {
          computedPermissions[permission.slug] = override.allowed;
        } else {
          // Check if any of user's roles grant this permission
          // For simplicity, we'll assume basic roles grant basic permissions
          const hasBasicRole = roles.some((r) => r.role.is_basic);
          computedPermissions[permission.slug] = hasBasicRole;
        }
      });

      const profileData: UserProfile = {
        ...userData,
        organization,
        roles,
        branch,
        availableBranches,
        permissionOverrides: permissionOverrides || [],
        computedPermissions,
      };

      setUser(profileData);
      setFormData({
        first_name: userData.first_name || "",
        last_name: userData.last_name || "",
        default_branch_id: defaultBranchId || "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch profile");
      console.error("Error fetching profile:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSave = async () => {
    if (!user) return;

    try {
      setIsSaving(true);
      setError(null);

      await updateUserProfile(user.id, {
        first_name: formData.first_name || undefined,
        last_name: formData.last_name || undefined,
        default_branch_id: formData.default_branch_id || undefined,
      });

      setSuccess(true);
      setIsEditing(false);
      fetchProfile();

      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (!user) return;
    setFormData({
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      default_branch_id: user.default_branch_id || "",
    });
    setIsEditing(false);
    setError(null);
  };

  const getUserInitials = (firstName: string | null, lastName: string | null) => {
    const first = firstName || "";
    const last = lastName || "";
    return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || "U";
  };

  const getStatusBadge = (statusId: string | null) => {
    const variants = {
      active: "default",
      inactive: "secondary",
      suspended: "destructive",
    } as const;

    const labels = {
      active: "Active",
      inactive: "Inactive",
      suspended: "Suspended",
    };

    const status = statusId || "active";
    return (
      <Badge variant={variants[status as keyof typeof variants] || "secondary"}>
        {labels[status as keyof typeof labels] || status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading your profile...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!user) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Profile not found. Please try refreshing the page.</AlertDescription>
      </Alert>
    );
  }

  const hasChanges =
    formData.first_name !== (user.first_name || "") ||
    formData.last_name !== (user.last_name || "") ||
    formData.default_branch_id !== (user.default_branch_id || "");

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="text-2xl font-semibold">
              {getUserInitials(user.first_name, user.last_name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-4 w-4" />
              <span>{user.email}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {success && (
            <div className="flex items-center gap-1 text-sm text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span>Saved!</span>
            </div>
          )}
          {getStatusBadge(user.status_id)}
        </div>
      </motion.div>

      {/* Overview Cards */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid gap-4 md:grid-cols-4"
      >
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Roles</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{user.roles?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Assigned roles</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Organization</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="truncate text-lg font-bold">
              {user.organization?.name || "No Organization"}
            </div>
            <p className="text-xs text-muted-foreground">Your organization</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Default Branch</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="truncate text-lg font-bold">{user.branch?.name || "No Branch"}</div>
            <p className="text-xs text-muted-foreground">Your default workspace</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Member Since</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold">
              {formatDistanceToNow(new Date(user.created_at), {
                addSuffix: true,
                locale: pl,
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              {new Date(user.created_at).toLocaleDateString("en-US")}
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Main Content Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="roles" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Roles
            </TabsTrigger>
            <TabsTrigger value="permissions" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              Permissions
            </TabsTrigger>
            <TabsTrigger value="account" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Account Info
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">Profile Information</CardTitle>
                    <CardDescription>
                      Manage your personal information and default settings
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isEditing ? (
                      <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                        <Edit2 className="mr-2 h-4 w-4" />
                        Edit
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCancel}
                          disabled={isSaving}
                        >
                          <X className="mr-2 h-4 w-4" />
                          Cancel
                        </Button>
                        <Button size="sm" onClick={handleSave} disabled={!hasChanges || isSaving}>
                          {isSaving ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="mr-2 h-4 w-4" />
                          )}
                          Save
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">First Name</Label>
                    {isEditing ? (
                      <Input
                        id="first_name"
                        value={formData.first_name}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, first_name: e.target.value }))
                        }
                        placeholder="Enter first name"
                      />
                    ) : (
                      <div className="flex min-h-[2.5rem] items-center rounded-md border bg-muted/50 px-3 py-2">
                        {user.first_name || <span className="text-muted-foreground">Not set</span>}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="last_name">Last Name</Label>
                    {isEditing ? (
                      <Input
                        id="last_name"
                        value={formData.last_name}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, last_name: e.target.value }))
                        }
                        placeholder="Enter last name"
                      />
                    ) : (
                      <div className="flex min-h-[2.5rem] items-center rounded-md border bg-muted/50 px-3 py-2">
                        {user.last_name || <span className="text-muted-foreground">Not set</span>}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="email">Email Address</Label>
                    <div className="flex min-h-[2.5rem] items-center rounded-md border bg-muted/50 px-3 py-2">
                      {user.email}
                      <span className="ml-2 text-xs text-muted-foreground">
                        (Cannot be changed)
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="default_branch">Default Branch</Label>
                    {isEditing ? (
                      <Select
                        value={formData.default_branch_id || "none"}
                        onValueChange={(value) =>
                          setFormData((prev) => ({
                            ...prev,
                            default_branch_id: value === "none" ? "" : value,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select default branch" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No default branch</SelectItem>
                          {user.availableBranches.map((branch) => (
                            <SelectItem key={branch.id} value={branch.id}>
                              {branch.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="flex min-h-[2.5rem] items-center rounded-md border bg-muted/50 px-3 py-2">
                        {user.branch?.name || (
                          <span className="text-muted-foreground">No default branch</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="roles" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Your Roles
                </CardTitle>
                <CardDescription>
                  Roles assigned to you in {user.organization?.name || "your organization"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {user.roles && user.roles.length > 0 ? (
                  <div className="space-y-4">
                    {user.roles.map((roleAssignment) => (
                      <div
                        key={roleAssignment.id}
                        className="flex items-center justify-between rounded-lg border p-4"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                            {roleAssignment.role.is_basic ? (
                              <Users className="h-5 w-5 text-primary" />
                            ) : (
                              <Shield className="h-5 w-5 text-primary" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{roleAssignment.role.name}</h3>
                              {roleAssignment.role.is_basic && (
                                <Badge variant="secondary" className="text-xs">
                                  Basic
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {roleAssignment.role.description || "No description available"}
                            </p>
                            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                              {roleAssignment.scope === "org" ? (
                                <Globe className="h-3 w-3" />
                              ) : (
                                <Building2 className="h-3 w-3" />
                              )}
                              <span>
                                {roleAssignment.scope === "org"
                                  ? "Organization-wide"
                                  : `Branch: ${roleAssignment.scope_name}`}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <Shield className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                    <h3 className="text-lg font-semibold text-muted-foreground">
                      No Roles Assigned
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      You don't have any roles assigned in this organization.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="permissions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Your Permissions
                </CardTitle>
                <CardDescription>
                  All permissions available in the system and your current access level
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Permission</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allPermissions.map((permission) => {
                      const hasPermission = user.computedPermissions[permission.slug];
                      const override = user.permissionOverrides.find(
                        (po) => po.permission.id === permission.id
                      );

                      return (
                        <TableRow key={permission.id}>
                          <TableCell className="font-medium">
                            {permission.label || permission.slug}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {permission.slug}
                          </TableCell>
                          <TableCell>
                            <Badge variant={hasPermission ? "default" : "destructive"}>
                              {hasPermission ? "Allowed" : "Denied"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {override ? (
                              <div className="flex items-center gap-1">
                                <Key className="h-3 w-3" />
                                Override
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <Shield className="h-3 w-3" />
                                Role-based
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="account" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  Account Information
                </CardTitle>
                <CardDescription>Technical details about your account</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">User ID</Label>
                    <div className="mt-1 rounded border bg-muted/50 p-3 font-mono text-sm">
                      {user.id}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">
                      Account Status
                    </Label>
                    <div className="mt-1 flex items-center gap-2">
                      {getStatusBadge(user.status_id)}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Created At</Label>
                    <div className="mt-1 rounded border bg-muted/50 p-3 text-sm">
                      {new Date(user.created_at).toLocaleString("en-US")}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">
                      Organization
                    </Label>
                    <div className="mt-1 rounded border bg-muted/50 p-3 text-sm">
                      {user.organization?.name || "No organization"}
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <Label className="text-sm font-medium text-muted-foreground">
                    Account Details
                  </Label>
                  <div className="mt-2 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Total branches available:</span>
                      <span className="text-muted-foreground">{user.availableBranches.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Permission overrides:</span>
                      <span className="text-muted-foreground">
                        {user.permissionOverrides.length}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}

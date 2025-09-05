"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ArrowLeft,
  Shield,
  Users,
  Edit,
  Copy,
  Trash2,
  AlertCircle,
  CheckCircle,
  Calendar,
  Building2,
} from "lucide-react";
import { format } from "date-fns";
import { pl, enUS } from "date-fns/locale";
import { useLocale } from "next-intl";
import {
  fetchRoleDetails,
  deleteRole,
  fetchRoleUsers,
  type RoleWithPermissions,
  type PermissionsByCategory,
  type UserWithRole,
  fetchPermissionsByCategory,
} from "@/app/actions/roles/role-management";
import { RoleEditDialog } from "@/components/organization/roles/RoleEditDialog";
import { RoleCloneDialog } from "@/components/organization/roles/RoleCloneDialog";
import { Link } from "@/i18n/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function RoleDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("organization.roleManagement");

  const roleId = params.id as string;

  const [role, setRole] = React.useState<RoleWithPermissions | null>(null);
  const [roleUsers, setRoleUsers] = React.useState<UserWithRole[]>([]);
  const [allPermissions, setAllPermissions] = React.useState<PermissionsByCategory>({});
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [cloneDialogOpen, setCloneDialogOpen] = React.useState(false);

  const dateLocale = locale === "pl" ? pl : enUS;

  const loadRoleDetails = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [roleData, permissionsData, usersData] = await Promise.all([
        fetchRoleDetails(roleId),
        fetchPermissionsByCategory(),
        fetchRoleUsers(roleId),
      ]);

      if (!roleData) {
        setError("Role not found");
        return;
      }

      setRole(roleData);
      setAllPermissions(permissionsData);
      setRoleUsers(usersData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load role details");
      console.error("Error loading role details:", err);
    } finally {
      setLoading(false);
    }
  }, [roleId]);

  React.useEffect(() => {
    loadRoleDetails();
  }, [loadRoleDetails]);

  const handleDelete = async () => {
    if (!role) return;

    try {
      setDeleting(true);
      const result = await deleteRole(role.id);

      if (result.success) {
        router.push("/dashboard/organization/users/roles");
      } else {
        setError(result.error || "Failed to delete role");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete role");
    } finally {
      setDeleting(false);
    }
  };

  const handleEditComplete = () => {
    setEditDialogOpen(false);
    loadRoleDetails(); // Refresh data
  };

  const handleCloneComplete = () => {
    setCloneDialogOpen(false);
    router.push("/dashboard/organization/users/roles");
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="mb-6">
          <Skeleton className="mb-2 h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Skeleton className="h-64 w-full" />
          </div>
          <div>
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  if (!role) {
    return (
      <div className="container mx-auto py-8">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Role not found</AlertDescription>
        </Alert>
      </div>
    );
  }

  const groupedPermissions = role.permissions.reduce(
    (acc, permission) => {
      if (!acc[permission.category]) {
        acc[permission.category] = [];
      }
      acc[permission.category].push(permission);
      return acc;
    },
    {} as Record<string, typeof role.permissions>
  );

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="mb-1 flex items-center gap-2">
                <Shield className="h-5 w-5 text-indigo-600" />
                <h1 className="text-2xl font-bold">{role.name}</h1>
                <Badge variant={role.is_basic ? "secondary" : "default"}>
                  {role.is_basic ? t("basicRole") : t("customRole")}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{t("roleDetails")}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setCloneDialogOpen(true)}>
              <Copy className="mr-2 h-4 w-4" />
              {t("cloneRole")}
            </Button>
            {!role.is_basic && (
              <>
                <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(true)}>
                  <Edit className="mr-2 h-4 w-4" />
                  {t("editRole")}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={Boolean(role.assignedUsersCount && role.assignedUsersCount > 0)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {t("deleteRole")}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("confirmDelete")}</AlertDialogTitle>
                      <AlertDialogDescription>{t("deleteWarning")}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        disabled={deleting}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {deleting ? "Deleting..." : t("deleteRole")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {/* Main Content */}
          <div className="space-y-6 xl:col-span-2">
            {/* Permissions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  {t("permissions")}
                </CardTitle>
                <CardDescription>
                  {role.permissions.length} permissions assigned to this role
                </CardDescription>
              </CardHeader>
              <CardContent>
                {Object.keys(groupedPermissions).length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No permissions assigned to this role
                  </p>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(groupedPermissions).map(([category, permissions]) => (
                      <div key={category}>
                        <h4 className="mb-3 flex items-center gap-2 text-sm font-medium">
                          <Building2 className="h-4 w-4" />
                          {t(`permissionCategories.${category}`) || category}
                        </h4>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {permissions.map((permission) => (
                            <div
                              key={permission.id}
                              className="flex items-center gap-2 rounded-md bg-muted/50 p-2"
                            >
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              <span className="font-mono text-sm">{permission.slug}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Assigned Users */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Assigned Users ({roleUsers.length})
                </CardTitle>
                <CardDescription>Users who have been assigned this role</CardDescription>
              </CardHeader>
              <CardContent>
                {roleUsers.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No users are currently assigned to this role
                  </p>
                ) : (
                  <div className="space-y-3">
                    {roleUsers.map((user) => (
                      <Link
                        key={user.id}
                        href={`/dashboard/organization/users/${user.id}` as any}
                        className="block"
                      >
                        <div className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>
                              {(user.first_name?.[0] || "") + (user.last_name?.[0] || "")}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium">
                              {[user.first_name, user.last_name].filter(Boolean).join(" ") ||
                                "Unnamed User"}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                              {user.email}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Assigned{" "}
                            {format(new Date(user.assignedAt), "MMM d", { locale: dateLocale })}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Role Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  {t("roleInformation")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <span className="text-sm font-medium">{t("roleName")}</span>
                  <p className="text-sm">{role.name}</p>
                </div>

                {role.description && (
                  <div className="space-y-2">
                    <span className="text-sm font-medium">{t("roleDescription")}</span>
                    <p className="text-sm text-muted-foreground">{role.description}</p>
                  </div>
                )}

                <div className="flex items-center justify-between border-t pt-2">
                  <span className="text-sm text-muted-foreground">{t("roleType")}</span>
                  <Badge variant={role.is_basic ? "secondary" : "default"}>
                    {role.is_basic ? t("basicRole") : t("customRole")}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t("assignedUsers")}</span>
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span className="font-medium">{role.assignedUsersCount || 0}</span>
                  </div>
                </div>

                {role.deleted_at && (
                  <div className="border-t pt-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Deleted</span>
                    </div>
                    <p className="text-sm font-medium">
                      {format(new Date(role.deleted_at), "PPP p", { locale: dateLocale })}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Warning for assigned users */}
            {role.assignedUsersCount && role.assignedUsersCount > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {t("cannotDeleteAssigned")}. Please reassign users before deleting this role.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>

        {/* Edit Dialog */}
        {editDialogOpen && (
          <RoleEditDialog
            role={role}
            allPermissions={allPermissions}
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            onComplete={handleEditComplete}
          />
        )}

        {/* Clone Dialog */}
        {cloneDialogOpen && (
          <RoleCloneDialog
            sourceRole={role}
            open={cloneDialogOpen}
            onOpenChange={setCloneDialogOpen}
            onComplete={handleCloneComplete}
          />
        )}
      </motion.div>
    </div>
  );
}

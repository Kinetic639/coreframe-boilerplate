"use client";

import * as React from "react";
import { useParams, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  User,
  Shield,
  Building2,
  Settings,
  Key,
  Mail,
  Calendar,
  AlertCircle,
  Loader2,
  Edit,
} from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { useUserDetail } from "@/hooks/useUserDetail";
import { UserProfileForm } from "@/components/organization/users/UserProfileForm";
import { UserRoleManager } from "@/components/organization/users/UserRoleManager";
import { UserPermissionOverrides } from "@/components/organization/users/UserPermissionOverrides";
import { UserStatusManager } from "@/components/organization/users/UserStatusManager";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";

export default function UserDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const userId = params.userId as string;
  const defaultTab = searchParams.get("tab") || "profile";

  const { user, loading, error, refetch } = useUserDetail(userId);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading user details...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error || "Failed to load user details"}</AlertDescription>
      </Alert>
    );
  }

  if (!user) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          User not found or you don't have permission to view this user.
        </AlertDescription>
      </Alert>
    );
  }

  const getUserInitials = (firstName: string | null, lastName: string | null) => {
    const first = firstName || "";
    const last = lastName || "";
    return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
  };

  const getStatusBadge = (statusId: string | null) => {
    const variants = {
      active: "default",
      inactive: "secondary",
      suspended: "destructive",
    } as const;

    const labels = {
      active: "Aktywny",
      inactive: "Nieaktywny",
      suspended: "Zawieszony",
    };

    const status = statusId || "active";
    return (
      <Badge variant={variants[status as keyof typeof variants] || "secondary"}>
        {labels[status as keyof typeof labels] || status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dashboard-old/organization/users/list")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Wróć do listy
          </Button>
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="text-lg font-semibold">
                {getUserInitials(user.first_name, user.last_name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {user.first_name || user.last_name
                  ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
                  : "Unnamed User"}
              </h1>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span>{user.email}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(user.status_id)}
          <Button variant="outline" size="sm">
            <Edit className="mr-2 h-4 w-4" />
            Quick Edit
          </Button>
        </div>
      </motion.div>

      {/* User Overview Cards */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid gap-4 md:grid-cols-4"
      >
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Roles</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{user.roles?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Aktywne role</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Default Branch</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="truncate text-lg font-bold">{user.branch?.name || "No Branch"}</div>
            <p className="text-xs text-muted-foreground">Domyślny oddział</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Permission Overrides</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{user.permissionOverrides?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Custom permissions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Member Since</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold">
              {user.created_at
                ? formatDistanceToNow(new Date(user.created_at), {
                    addSuffix: true,
                    locale: pl,
                  })
                : "Unknown"}
            </div>
            <p className="text-xs text-muted-foreground">
              {user.created_at ? new Date(user.created_at).toLocaleDateString("pl-PL") : "Unknown"}
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
        <Tabs defaultValue={defaultTab} className="space-y-4">
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
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4">
            <UserProfileForm user={user} onUpdate={refetch} />
          </TabsContent>

          <TabsContent value="roles" className="space-y-4">
            <UserRoleManager user={user} onUpdate={refetch} />
          </TabsContent>

          <TabsContent value="permissions" className="space-y-4">
            <UserPermissionOverrides user={user} onUpdate={refetch} />
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <UserStatusManager user={user} onUpdate={refetch} />
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}

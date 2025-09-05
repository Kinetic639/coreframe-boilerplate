"use client";

import * as React from "react";
import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  UserPlus,
  Search,
  MoreHorizontal,
  Shield,
  Key,
  Trash2,
  Crown,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { fetchUserRoleAssignments, fetchOrganizationUsers } from "@/lib/api/roles";
import { useAppStore } from "@/lib/stores/app-store";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RoleAssignmentDialog } from "@/modules/organization-management/components/roles/RoleAssignmentDialog";
import { PermissionOverrideDialog } from "@/modules/organization-management/components/roles/PermissionOverrideDialog";
import { revokeUserRole } from "@/app/actions/roles";
import { toast } from "react-toastify";

interface User {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  status_id: string | null;
  created_at: string | null;
  default_branch_id: string | null;
  deleted_at: string | null;
}

interface UserRoleAssignmentWithDetails {
  id: string;
  user_id: string;
  role_id: string;
  scope: "org" | "branch";
  scope_id: string;
  created_at?: string;
  deleted_at: string | null;
  users: User | null;
  roles: {
    id: string;
    name: string;
    is_basic: boolean;
    organization_id: string | null;
  } | null;
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roleAssignments, setRoleAssignments] = useState<UserRoleAssignmentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showRoleAssignmentDialog, setShowRoleAssignmentDialog] = useState(false);
  const [showPermissionOverrideDialog, setShowPermissionOverrideDialog] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const { activeOrg } = useAppStore();

  // Load data
  const loadData = async () => {
    if (!activeOrg?.organization_id) {
      setError("No active organization");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [usersData, assignmentsData] = await Promise.all([
        fetchOrganizationUsers(activeOrg.organization_id),
        fetchUserRoleAssignments(activeOrg.organization_id),
      ]);

      setUsers(usersData.map((user) => ({ ...user, avatar_url: null })));
      setRoleAssignments(assignmentsData as any);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
      console.error("Error loading user management data:", err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadData();
  }, [activeOrg?.organization_id, loadData]);

  // Get user with role information
  const usersWithRoles = React.useMemo(() => {
    return users.map((user) => {
      const userAssignments = roleAssignments.filter((ra) => ra.user_id === user.id);
      const primaryRole = userAssignments.find((ra) => ra.scope === "org") || userAssignments[0];

      return {
        ...user,
        assignments: userAssignments,
        primaryRole: primaryRole?.roles,
        roleCount: userAssignments.length,
      };
    });
  }, [users, roleAssignments]);

  // Filter users
  const filteredUsers = React.useMemo(() => {
    return usersWithRoles.filter((user) => {
      const matchesSearch =
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        `${user.first_name} ${user.last_name}`.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesRole =
        roleFilter === "all" ||
        user.assignments.some((assignment) => assignment.roles?.name === roleFilter);

      const matchesStatus = statusFilter === "all" || user.status_id === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [usersWithRoles, searchTerm, roleFilter, statusFilter]);

  // Get unique roles for filter
  const availableRoles = React.useMemo(() => {
    const roles = new Set<string>();
    roleAssignments.forEach((assignment) => {
      if (assignment.roles?.name) {
        roles.add(assignment.roles.name);
      }
    });
    return Array.from(roles).sort();
  }, [roleAssignments]);

  const handleRevokeRole = async (assignmentId: string) => {
    try {
      const formData = new FormData();
      formData.append("assignment_id", assignmentId);

      const result = await revokeUserRole(null, formData);

      if (result.success) {
        toast.success("Role revoked successfully");
        loadData(); // Reload data
      } else {
        toast.error(result.error || "Failed to revoke role");
      }
    } catch (error) {
      console.error("Failed to revoke role:", error);
      toast.error("Failed to revoke role");
    }
  };

  const getUserDisplayName = (user: User) => {
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    return user.email;
  };

  const getUserInitials = (user: User) => {
    if (user.first_name && user.last_name) {
      return `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`.toUpperCase();
    }
    return user.email.charAt(0).toUpperCase();
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading users...</span>
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Zarządzanie użytkownikami</h1>
          <p className="text-muted-foreground">
            Manage users, their roles, and permissions within your organization
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowPermissionOverrideDialog(true)}>
            <Key className="mr-2 h-4 w-4" />
            Permission Override
          </Button>
          <Button variant="themed" onClick={() => setShowRoleAssignmentDialog(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Assign Role
          </Button>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex items-center gap-4"
      >
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {availableRoles.map((role) => (
              <SelectItem key={role} value={role}>
                {role}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      {/* Users Table */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Users ({filteredUsers.length})
            </CardTitle>
            <CardDescription>
              Manage user roles and permissions within your organization
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Primary Role</TableHead>
                  <TableHead>All Roles</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id} className="hover:bg-muted/50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.avatar_url || ""} />
                          <AvatarFallback>{getUserInitials(user)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{getUserDisplayName(user)}</div>
                          <div className="text-sm text-muted-foreground">{user.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.primaryRole ? (
                        <Badge
                          variant={user.primaryRole.name === "org_owner" ? "default" : "secondary"}
                        >
                          <Crown className="mr-1 h-3 w-3" />
                          {user.primaryRole.name}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">No role assigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.assignments.map((assignment) => (
                          <Badge key={assignment.id} variant="outline" className="text-xs">
                            {assignment.roles?.name}
                            <span className="ml-1 text-muted-foreground">({assignment.scope})</span>
                          </Badge>
                        ))}
                        {user.assignments.length === 0 && (
                          <span className="text-sm text-muted-foreground">No roles</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={user.status_id === "active" ? "default" : "secondary"}
                        className={user.status_id === "active" ? "bg-green-100 text-green-800" : ""}
                      >
                        {user.status_id}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {user.created_at ? new Date(user.created_at).toLocaleDateString() : "N/A"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedUserId(user.id);
                              setShowRoleAssignmentDialog(true);
                            }}
                          >
                            <Shield className="mr-2 h-4 w-4" />
                            Assign Role
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedUserId(user.id);
                              setShowPermissionOverrideDialog(true);
                            }}
                          >
                            <Key className="mr-2 h-4 w-4" />
                            Permission Override
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {user.assignments.map((assignment) => (
                            <DropdownMenuItem
                              key={assignment.id}
                              className="text-red-600"
                              onClick={() => handleRevokeRole(assignment.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Revoke {assignment.roles?.name}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {filteredUsers.length === 0 && (
              <div className="py-8 text-center">
                <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-2 text-sm font-medium text-muted-foreground">No users found</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try adjusting your search or filter criteria.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Dialogs */}
      <RoleAssignmentDialog
        open={showRoleAssignmentDialog}
        onOpenChange={setShowRoleAssignmentDialog}
        onSuccess={() => {
          loadData();
          setSelectedUserId(null);
        }}
      />

      <PermissionOverrideDialog
        open={showPermissionOverrideDialog}
        onOpenChange={setShowPermissionOverrideDialog}
        selectedUserId={selectedUserId}
        onSuccess={() => {
          loadData();
          setSelectedUserId(null);
        }}
      />
    </div>
  );
}

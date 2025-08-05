"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Settings,
  UserCheck,
  UserX,
  Clock,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  Calendar,
  Shield,
  Trash2,
} from "lucide-react";
import { UserDetailWithAssignments, updateUserStatus } from "@/lib/api/user-detail";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";

interface UserStatusManagerProps {
  user: UserDetailWithAssignments;
  onUpdate: () => void;
}

export function UserStatusManager({ user, onUpdate }: UserStatusManagerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState(user.status_id || "active");
  const [statusReason, setStatusReason] = useState("");

  const statusOptions = [
    {
      value: "active",
      label: "Active",
      description: "User can access the system normally",
      icon: UserCheck,
      color: "text-green-600",
      badgeVariant: "default" as const,
    },
    {
      value: "inactive",
      label: "Inactive",
      description: "User account is temporarily disabled",
      icon: Clock,
      color: "text-yellow-600",
      badgeVariant: "secondary" as const,
    },
    {
      value: "suspended",
      label: "Suspended",
      description: "User account is suspended due to policy violation",
      icon: UserX,
      color: "text-red-600",
      badgeVariant: "destructive" as const,
    },
  ];

  const currentStatus = statusOptions.find((s) => s.value === (user.status_id || "active"));
  const selectedStatusOption = statusOptions.find((s) => s.value === selectedStatus);

  const handleUpdateStatus = async () => {
    try {
      setIsLoading(true);
      setError(null);

      await updateUserStatus(user.id, selectedStatus);

      setSuccess(`User status updated to ${selectedStatusOption?.label}`);
      onUpdate();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user status");
    } finally {
      setIsLoading(false);
    }
  };

  const hasChanges = selectedStatus !== (user.status_id || "active");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                User Status & Settings
              </CardTitle>
              <CardDescription>Manage user account status and access permissions</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {success && (
                <div className="flex items-center gap-1 text-sm text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span>{success}</span>
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

          {/* Current Status */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Current Status</Label>
            <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-4">
              {currentStatus && (
                <>
                  <div className={`rounded-full bg-background p-2 ${currentStatus.color}`}>
                    <currentStatus.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{currentStatus.label}</span>
                      <Badge variant={currentStatus.badgeVariant}>{currentStatus.label}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {currentStatus.description}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          <Separator />

          {/* Change Status */}
          <div className="space-y-4">
            <Label className="text-base font-medium">Change Status</Label>

            <div className="space-y-2">
              <Label htmlFor="status">New Status</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      <div className="flex items-center gap-2">
                        <status.icon className={`h-4 w-4 ${status.color}`} />
                        <span>{status.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedStatusOption && (
                <p className="text-sm text-muted-foreground">{selectedStatusOption.description}</p>
              )}
            </div>

            {selectedStatus !== "active" && (
              <div className="space-y-2">
                <Label htmlFor="reason">Reason (Optional)</Label>
                <Textarea
                  id="reason"
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder="Enter reason for status change..."
                  className="min-h-[80px]"
                />
              </div>
            )}

            <Button
              onClick={handleUpdateStatus}
              disabled={!hasChanges || isLoading}
              className="w-full"
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Update Status
            </Button>
          </div>

          <Separator />

          {/* Account Information */}
          <div className="space-y-4">
            <Label className="text-base font-medium">Account Information</Label>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">User ID</Label>
                <div className="rounded border bg-muted/50 p-3 font-mono text-xs">{user.id}</div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">Created</Label>
                <div className="flex items-center gap-2 rounded border bg-muted/50 p-3 text-sm">
                  <Calendar className="h-4 w-4" />
                  <div>
                    <div>{new Date(user.created_at).toLocaleDateString("pl-PL")}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(user.created_at), {
                        addSuffix: true,
                        locale: pl,
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">Active Roles</Label>
                <div className="rounded border bg-muted/50 p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Shield className="h-4 w-4" />
                    <span>{user.roles?.length || 0} roles assigned</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">
                  Permission Overrides
                </Label>
                <div className="rounded border bg-muted/50 p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Settings className="h-4 w-4" />
                    <span>{user.permissionOverrides?.length || 0} custom permissions</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Danger Zone */}
          <div className="space-y-4">
            <Label className="text-base font-medium text-red-600">Danger Zone</Label>

            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-3">
                  <p>
                    <strong>Delete User Account</strong>
                    <br />
                    This action cannot be undone. This will permanently delete the user account,
                    remove all role assignments, and delete all associated data.
                  </p>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={true} // Disabled for safety - would need additional confirmation
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete User Account
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

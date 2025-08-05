"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Save, Edit2, X, CheckCircle, AlertCircle } from "lucide-react";
import { UserDetailWithAssignments, updateUserProfile } from "@/lib/api/user-detail";
import { useAppStore } from "@/lib/stores/app-store";
import { useState } from "react";

interface UserProfileFormProps {
  user: UserDetailWithAssignments;
  onUpdate: () => void;
}

export function UserProfileForm({ user, onUpdate }: UserProfileFormProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { availableBranches } = useAppStore();

  const [formData, setFormData] = useState({
    first_name: user.first_name || "",
    last_name: user.last_name || "",
    default_branch_id: user.default_branch_id || "",
  });

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);

      await updateUserProfile(user.id, {
        first_name: formData.first_name || null,
        last_name: formData.last_name || null,
        default_branch_id: formData.default_branch_id || null,
      });

      setSuccess(true);
      setIsEditing(false);
      onUpdate();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      default_branch_id: user.default_branch_id || "",
    });
    setIsEditing(false);
    setError(null);
  };

  const hasChanges =
    formData.first_name !== (user.first_name || "") ||
    formData.last_name !== (user.last_name || "") ||
    formData.default_branch_id !== (user.default_branch_id || "");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">User Profile</CardTitle>
            <CardDescription>Manage basic user information and default settings</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {success && (
              <div className="flex items-center gap-1 text-sm text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span>Saved!</span>
              </div>
            )}
            {!isEditing ? (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                <Edit2 className="mr-2 h-4 w-4" />
                Edit
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleCancel} disabled={isSaving}>
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
                onChange={(e) => setFormData((prev) => ({ ...prev, first_name: e.target.value }))}
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
                onChange={(e) => setFormData((prev) => ({ ...prev, last_name: e.target.value }))}
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
              <span className="ml-2 text-xs text-muted-foreground">(Cannot be changed)</span>
            </div>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="default_branch">Default Branch</Label>
            {isEditing ? (
              <Select
                value={formData.default_branch_id}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, default_branch_id: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select default branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No default branch</SelectItem>
                  {availableBranches.map((branch) => (
                    <SelectItem key={branch.branch_id} value={branch.branch_id}>
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

        <div className="border-t pt-4">
          <div className="grid gap-4 text-sm md:grid-cols-2">
            <div>
              <Label className="text-xs font-medium text-muted-foreground">User ID</Label>
              <div className="rounded border bg-muted/50 p-2 font-mono text-xs">{user.id}</div>
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Created At</Label>
              <div className="rounded border bg-muted/50 p-2 text-xs">
                {new Date(user.created_at).toLocaleString("pl-PL")}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

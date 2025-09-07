"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "react-toastify";
import { createClient } from "@/utils/supabase/client";
import { Edit3, Save, X } from "lucide-react";

type Props = {
  userId: string;
  initialFirstName?: string | null;
  initialLastName?: string | null;
  onProfileUpdate?: (firstName: string, lastName: string) => void;
};

export default function ProfileEditForm({
  userId,
  initialFirstName,
  initialLastName,
  onProfileUpdate,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [firstName, setFirstName] = useState(initialFirstName || "");
  const [lastName, setLastName] = useState(initialLastName || "");
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  const handleSave = async () => {
    setSaving(true);

    try {
      const { error } = await supabase
        .from("public.users")
        .update({
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
        })
        .eq("id", userId);

      if (error) {
        toast.error("❌ Failed to update profile");
        console.error("Profile update error:", error);
        return;
      }

      toast.success("✅ Profile updated successfully");
      setIsEditing(false);

      if (onProfileUpdate) {
        onProfileUpdate(firstName.trim(), lastName.trim());
      }
    } catch (error) {
      console.error("Unexpected error:", error);
      toast.error("❌ An unexpected error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFirstName(initialFirstName || "");
    setLastName(initialLastName || "");
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Edit3 className="h-5 w-5" />
              Personal Information
            </span>
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Edit3 className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </CardTitle>
          <CardDescription>Your personal details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">First Name</Label>
              <p className="mt-1 text-sm text-muted-foreground">{initialFirstName || "Not set"}</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Last Name</Label>
              <p className="mt-1 text-sm text-muted-foreground">{initialLastName || "Not set"}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Edit3 className="h-5 w-5" />
          Edit Personal Information
        </CardTitle>
        <CardDescription>Update your personal details</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Enter your first name"
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Enter your last name"
                disabled={saving}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
            <Button type="button" variant="outline" onClick={handleCancel} disabled={saving}>
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

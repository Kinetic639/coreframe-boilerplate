"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Mail, Calendar, Shield } from "lucide-react";
import AvatarUploader from "./AvatarUploader";
import ProfileEditForm from "./ProfileEditForm";
import { getUserInitials, getUserDisplayName } from "@/utils/user-helpers";
import { useUserStore } from "@/lib/stores/user-store";

type UserData = {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  created_at?: string | null;
  avatar_url?: string | null;
};

type UserRole =
  | {
      role: { name: string; scope: string } | null;
      organization: { name: string } | null;
      branch: { name: string } | null;
    }
  | any;

type Props = {
  user: {
    id: string;
    email?: string;
    email_confirmed_at?: string | null;
    last_sign_in_at?: string | null;
    app_metadata?: any;
  };
  userData: UserData | null;
  userRoles: UserRole[] | null;
};

export default function ProfilePageClient({ user: authUser, userData, userRoles }: Props) {
  const { user: storeUser, setContext } = useUserStore();

  // Use store user as source of truth, fallback to passed data if store not loaded
  const currentUser = storeUser || {
    id: authUser.id,
    email: userData?.email || authUser.email || "",
    first_name: userData?.first_name || null,
    last_name: userData?.last_name || null,
    avatar_url: userData?.avatar_url || null,
  };

  const displayName = getUserDisplayName(currentUser.first_name, currentUser.last_name);
  const displayEmail = currentUser.email || "No email";

  const handleProfileUpdate = (firstName: string, lastName: string) => {
    // Update the store with new profile data
    if (storeUser) {
      const updatedUser = {
        ...storeUser,
        first_name: firstName || null,
        last_name: lastName || null,
      };

      // Update the store context
      const { ...storeData } = useUserStore.getState();
      setContext({
        user: updatedUser,
        ...storeData,
      });
    }
  };

  const handleAvatarUpdate = (newAvatarUrl: string) => {
    // Update the store with new avatar URL
    if (storeUser) {
      const updatedUser = {
        ...storeUser,
        avatar_url: newAvatarUrl,
      };

      // Update the store context
      const { ...storeData } = useUserStore.getState();
      setContext({
        user: updatedUser,
        ...storeData,
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const userInitials = getUserInitials(currentUser.first_name, currentUser.last_name, displayEmail);

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Profile</h1>
        <p className="text-muted-foreground">Manage your profile information</p>
      </div>

      <div className="grid max-w-4xl gap-6">
        {/* Profile Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile Information
            </CardTitle>
            <CardDescription>Your account details and information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-start gap-6 md:flex-row">
              {/* Avatar Upload Section */}
              <div className="flex-shrink-0">
                <AvatarUploader
                  avatarUrl={currentUser.avatar_url ? String(currentUser.avatar_url) : null}
                  userId={currentUser.id}
                  userInitials={userInitials}
                  onAvatarUpdate={handleAvatarUpdate}
                />
              </div>

              {/* User Info Section */}
              <div className="flex-1 space-y-4">
                <div>
                  <h3 className="text-2xl font-semibold">{displayName}</h3>
                  <div className="mt-1 flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    {displayEmail}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Member since {userData?.created_at ? formatDate(userData.created_at) : "Unknown"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profile Edit Form */}
        <ProfileEditForm
          userId={currentUser.id}
          initialFirstName={currentUser.first_name}
          initialLastName={currentUser.last_name}
          onProfileUpdate={handleProfileUpdate}
        />

        {/* Roles and Permissions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Roles and Access
            </CardTitle>
            <CardDescription>Your roles across organizations and branches</CardDescription>
          </CardHeader>
          <CardContent>
            {userRoles && userRoles.length > 0 ? (
              <div className="space-y-3">
                {userRoles.map((userRole: UserRole, index: number) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary">{userRole.role?.name || "Unknown Role"}</Badge>
                      <div className="text-sm">
                        <div className="font-medium">
                          {userRole.organization?.name || "Unknown Organization"}
                        </div>
                        {userRole.branch?.name && (
                          <div className="text-muted-foreground">
                            Branch: {userRole.branch.name}
                          </div>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline">{userRole.role?.scope || "Unknown Scope"}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No roles assigned</p>
            )}
          </CardContent>
        </Card>

        {/* Account Details */}
        <Card>
          <CardHeader>
            <CardTitle>Account Details</CardTitle>
            <CardDescription>Technical account information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">User ID:</span>
                  <p className="font-mono text-muted-foreground">{authUser.id}</p>
                </div>
                <div>
                  <span className="font-medium">Email Verified:</span>
                  <p className="text-muted-foreground">
                    {authUser.email_confirmed_at ? "Yes" : "No"}
                  </p>
                </div>
                <div>
                  <span className="font-medium">Last Sign In:</span>
                  <p className="text-muted-foreground">
                    {authUser.last_sign_in_at ? formatDate(authUser.last_sign_in_at) : "Never"}
                  </p>
                </div>
                <div>
                  <span className="font-medium">Auth Provider:</span>
                  <p className="text-muted-foreground">
                    {authUser.app_metadata?.provider || "Unknown"}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

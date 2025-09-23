"use server";

import { encodedRedirect } from "@/utils/utils";
import { createClient } from "@/utils/supabase/server";
import { headers } from "next/headers";

export const signUpAction = async (formData: FormData) => {
  const email = formData.get("email")?.toString();
  const password = formData.get("password")?.toString();
  const firstName = formData.get("firstName")?.toString();
  const lastName = formData.get("lastName")?.toString();
  const invitationToken = formData.get("invitationToken")?.toString();
  const supabase = await createClient();
  const origin = (await headers()).get("origin");

  if (!email || !password) {
    return encodedRedirect("error", "/sign-up", "Email and password are required");
  }

  // If invitation token is provided, validate it
  let invitation = null;
  if (invitationToken) {
    const { data: invitationData, error: invitationError } = await supabase
      .from("invitations")
      .select("*")
      .eq("token", invitationToken)
      .eq("status", "pending")
      .single();

    if (invitationError || !invitationData) {
      return encodedRedirect("error", "/sign-up", "Invalid or expired invitation");
    }

    // Check if invitation email matches registration email
    if (invitationData.email.toLowerCase() !== email.toLowerCase()) {
      return encodedRedirect("error", "/sign-up", "Email address does not match invitation");
    }

    // Check if invitation is expired
    if (new Date(invitationData.expires_at) < new Date()) {
      return encodedRedirect("error", "/sign-up", "Invitation has expired");
    }

    invitation = invitationData;
  }

  // Register user with metadata for names and invitation
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      data: {
        first_name: firstName || "",
        last_name: lastName || "",
        invitation_token: invitationToken || null,
        invitation_organization_id: invitation?.organization_id || null,
        invitation_role_id: invitation?.role_id || null,
        invitation_branch_id: invitation?.branch_id || null,
      },
    },
  });

  if (error || !data.user) {
    console.error(error?.code + " " + error?.message);
    return encodedRedirect("error", "/sign-up", error?.message || "Registration failed");
  }

  if (invitation) {
    // The database trigger will automatically:
    // 1. Insert the user into public.users table
    // 2. Assign user to the invited organization and role
    // 3. Accept the invitation
    return encodedRedirect(
      "success",
      "/sign-up",
      "Thanks for signing up! Please check your email for a verification link. You will be added to the organization once you verify your email."
    );
  } else {
    // The database trigger will automatically:
    // 1. Insert the user into public.users table
    // 2. Create a new organization based on email domain
    // 3. Create organization profile
    // 4. Assign org_owner role to the user
    return encodedRedirect(
      "success",
      "/sign-up",
      "Thanks for signing up! Please check your email for a verification link. Your organization has been created automatically."
    );
  }
};

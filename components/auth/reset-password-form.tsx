"use client";

import { AuthForm } from "./auth-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPasswordSchema } from "@/lib/validations/auth";
import { resetPasswordAction } from "@/app/actions";
import { Message } from "@/components/form-message";

interface ResetPasswordFormProps {
  message?: Message;
}

export function ResetPasswordForm({ message }: ResetPasswordFormProps) {
  return (
    <AuthForm
      title="Reset password"
      subtitle="Please enter your new password below."
      linkText=""
      linkHref=""
      schema={resetPasswordSchema}
      formAction={resetPasswordAction}
      pendingText="Resetting password..."
      submitText="Reset password"
      message={message}
    >
      <Label htmlFor="password">New password</Label>
      <Input type="password" name="password" placeholder="New password" required />
      <Label htmlFor="confirmPassword">Confirm password</Label>
      <Input type="password" name="confirmPassword" placeholder="Confirm password" required />
    </AuthForm>
  );
}

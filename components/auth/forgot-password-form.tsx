"use client";

import { AuthForm } from "./auth-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { forgotPasswordSchema } from "@/lib/validations/auth";
import { forgotPasswordAction } from "@/app/actions";
import { Message } from "@/components/form-message";

interface ForgotPasswordFormProps {
  message?: Message;
}

export function ForgotPasswordForm({ message }: ForgotPasswordFormProps) {
  return (
    <AuthForm
      title="Reset Password"
      subtitle="Already have an account?"
      linkText="Sign in"
      linkHref="/sign-in"
      schema={forgotPasswordSchema}
      formAction={forgotPasswordAction}
      pendingText="Sending reset link..."
      submitText="Reset Password"
      message={message}
    >
      <Label htmlFor="email">Email</Label>
      <Input name="email" placeholder="you@example.com" required />
    </AuthForm>
  );
}

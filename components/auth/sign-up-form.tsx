"use client";

import { AuthForm } from "./auth-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUpSchema } from "@/lib/validations/auth";
import { signUpAction } from "@/app/actions";
import { Message } from "@/components/form-message";

interface SignUpFormProps {
  message?: Message;
}

export function SignUpForm({ message }: SignUpFormProps) {
  return (
    <AuthForm
      title="Sign up"
      subtitle="Already have an account?"
      linkText="Sign in"
      linkHref="/sign-in"
      schema={signUpSchema}
      formAction={signUpAction}
      pendingText="Signing up..."
      submitText="Sign up"
      message={message}
    >
      <Label htmlFor="email">Email</Label>
      <Input name="email" placeholder="you@example.com" required />
      <Label htmlFor="password">Password</Label>
      <Input type="password" name="password" placeholder="Your password" minLength={6} required />
    </AuthForm>
  );
}

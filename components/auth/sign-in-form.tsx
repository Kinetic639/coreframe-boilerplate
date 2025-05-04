"use client";

import { AuthForm } from "./auth-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInSchema } from "@/lib/validations/auth";
import { signInAction } from "@/app/actions";
import Link from "next/link";
import { Message } from "@/components/form-message";

interface SignInFormProps {
  message?: Message;
}

export function SignInForm({ message }: SignInFormProps) {
  return (
    <AuthForm
      title="Sign in"
      subtitle="Don't have an account?"
      linkText="Sign up"
      linkHref="/sign-up"
      schema={signInSchema}
      formAction={signInAction}
      pendingText="Signing in..."
      submitText="Sign in"
      message={message}
    >
      <Label htmlFor="email">Email</Label>
      <Input name="email" placeholder="you@example.com" required />
      <div className="flex items-center justify-between">
        <Label htmlFor="password">Password</Label>
        <Link className="text-xs text-foreground underline" href="/forgot-password">
          Forgot Password?
        </Link>
      </div>
      <Input type="password" name="password" placeholder="Your password" required />
    </AuthForm>
  );
}

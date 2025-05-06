"use client";

import { forgotPasswordAction } from "@/app/[locale]/actions";
import { FormMessage, Message } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

interface ForgotPasswordFormProps {
  message?: Message;
}

export function ForgotPasswordForm({ message }: ForgotPasswordFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    const formData = new FormData();
    formData.append("email", data.email);
    await forgotPasswordAction(formData);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mx-auto flex min-w-64 max-w-64 flex-col">
      <h1 className="text-2xl font-medium">Reset Password</h1>
      <p className="text-sm text-foreground">
        Already have an account?{" "}
        <Link className="font-medium text-primary underline" href="/sign-in">
          Sign in
        </Link>
      </p>
      <div className="mt-8 flex flex-col gap-2 [&>input]:mb-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="you@example.com" {...register("email")} />
          {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
        </div>

        <SubmitButton disabled={isSubmitting} pendingText="Sending reset link...">
          Reset Password
        </SubmitButton>
        {message && <FormMessage message={message} />}
      </div>
    </form>
  );
}

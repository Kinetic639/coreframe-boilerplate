"use client";

import { FormMessage, Message } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";
import React from "react";

interface AuthFormProps {
  title: string;
  subtitle: string;
  linkText: string;
  linkHref: string;
  schema: z.ZodType<Record<string, unknown>, z.ZodTypeDef, Record<string, unknown>>;
  formAction: (formData: FormData) => Promise<void>;
  pendingText: string;
  submitText: string;
  message?: Message;
  children?: React.ReactNode;
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  name: string;
}

export function AuthForm({
  title,
  subtitle,
  linkText,
  linkHref,
  schema,
  formAction,
  pendingText,
  submitText,
  message,
  children,
}: AuthFormProps) {
  const {
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
  });

  // Clone children and add error handling
  const childrenWithErrors = React.Children.map(children, (child) => {
    if (!React.isValidElement<InputProps>(child)) return child;

    // Only process Input components
    if (child.type === "input") {
      const name = child.props.name;
      const error = errors[name];

      return (
        <div className="flex flex-col gap-1">
          {child}
          {error && <p className="text-sm text-destructive">{error.message as string}</p>}
        </div>
      );
    }

    return child;
  });

  return (
    <form className="mx-auto flex min-w-64 max-w-64 flex-col">
      <h1 className="text-2xl font-medium">{title}</h1>
      <p className="text-sm text-foreground">
        {subtitle}{" "}
        <Link className="font-medium text-primary underline" href={linkHref}>
          {linkText}
        </Link>
      </p>
      <div className="mt-8 flex flex-col gap-2 [&>input]:mb-3">
        {childrenWithErrors}
        <SubmitButton formAction={formAction} pendingText={pendingText}>
          {submitText}
        </SubmitButton>
        {message && <FormMessage message={message} />}
      </div>
    </form>
  );
}

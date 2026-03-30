"use client";

import { Button } from "@/components/ui/button";
import FancySpinner from "@/components/ui/FancySpinner";
import { useFormStatus } from "react-dom";

interface SubmitButtonProps {
  children: React.ReactNode;
  pendingText?: string;
  disabled?: boolean;
}

export const SubmitButton = ({
  children,
  pendingText = "Logowanie...",
  disabled,
}: SubmitButtonProps) => {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending ? (
        <>
          <FancySpinner className="mr-2 h-4 w-4 shrink-0" />
          {pendingText}
        </>
      ) : (
        children
      )}
    </Button>
  );
};

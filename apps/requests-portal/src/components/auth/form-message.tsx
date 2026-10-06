export type Message = { success: string } | { error: string };

export function FormMessage({
  message,
}: {
  message?: Partial<Record<"success" | "error", string>>;
}) {
  if (message?.error) {
    return (
      <p role="alert" className="border-l-2 border-destructive px-4 text-sm text-destructive">
        {message.error}
      </p>
    );
  }
  if (message?.success) {
    return (
      <p className="border-l-2 border-foreground px-4 text-sm text-foreground">{message.success}</p>
    );
  }
  return null;
}

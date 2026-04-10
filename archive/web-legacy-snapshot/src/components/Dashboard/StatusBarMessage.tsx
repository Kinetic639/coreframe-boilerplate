"use client";

import React from "react";

interface StatusBarMessageProps {
  message: string;
}

export function StatusBarMessage({ message }: StatusBarMessageProps) {
  return <span className="text-muted-foreground text-xs">{message}</span>;
}

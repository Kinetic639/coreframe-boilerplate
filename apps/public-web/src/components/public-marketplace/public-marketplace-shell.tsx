import type { ReactNode } from "react";

interface PublicMarketplaceShellProps {
  children: ReactNode;
}

export function PublicMarketplaceShell({ children }: PublicMarketplaceShellProps) {
  return <>{children}</>;
}

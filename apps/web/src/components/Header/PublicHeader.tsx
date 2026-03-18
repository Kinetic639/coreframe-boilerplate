import { PublicHeaderClient } from "./PublicHeaderClient";
import { loadUserContextServer } from "@/lib/api/load-user-context-server";
import { PublicHeaderAuth } from "./PublicHeaderAuth";

const PublicHeader = async () => {
  // Load user context server-side to avoid hydration issues
  const userContext = await loadUserContextServer();

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4">
        {/* Logo and Navigation - Client Component for interactivity */}
        <PublicHeaderClient />

        {/* Auth Buttons - Server Component for SSR */}
        <div className="hidden items-center gap-4 md:flex">
          <PublicHeaderAuth userContext={userContext} />
        </div>
      </div>
    </header>
  );
};

export default PublicHeader;

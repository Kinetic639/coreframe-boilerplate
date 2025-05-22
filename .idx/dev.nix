{ pkgs }: {
  env = {
  NEXT_PUBLIC_SUPABASE_URL="https://iqczcptissddbydvflvn.supabase.co";
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlxY3pjcHRpc3NkZGJ5ZHZmbHZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYzNjAyMTEsImV4cCI6MjA2MTkzNjIxMX0.J9EfEDTAe1RnFLidHn4XWHjJTTCvxg_Qr1aBIecY-5g";
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlxY3pjcHRpc3NkZGJ5ZHZmbHZuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NjM2MDIxMSwiZXhwIjoyMDYxOTM2MjExfQ.pSvP8UtC6XxJjclo-CaiS2bdBeDR6Sb9mZ8SIzkft9A";
   };
  channel = "stable-24.05";
  packages = [
    pkgs.nodejs_20
    pkgs.supabase-cli
    pkgs.corepack   
  ];
  idx.extensions = [

  ];
  idx.previews = {
    previews = {
      web = {
        command = [
          "npm"
          "run"
          "dev"
          "--"
          "--port"
          "$PORT"
          "--hostname"
          "0.0.0.0"
        ];
        manager = "web";
      };
    };
  };
}

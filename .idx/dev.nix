{pkgs}: {
  channel = "unstable";
    env = {
    SUPABASE_URL = "https://zlcnlalwfmmtusigeuyk.supabase.co";
    SUPABASE_ACCESS_TOKEN = "sbp_0508242e76569db2ccee3f664d40b8ab25d3ff5e";
  };
  packages = [
    pkgs.nodejs_20
    pkgs.supabase-cli
  ];
  idx.extensions = [
    
  ];
  idx.previews = {
    previews = {
      web = {
        command = [
          "npm"
          "pnpm"
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
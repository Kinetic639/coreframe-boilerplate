{ pkgs }: {
  channel = "unstable";
  
  env = {
    SUPABASE_URL = "https://zlcnlalwfmmtusigeuyk.supabase.co";
    SUPABASE_ACCESS_TOKEN = "sbp_0508242e76569db2ccee3f664d40b8ab25d3ff5e";
    # Naprawa błędu OpenSSL poprzez wskazanie systemowych certyfikatów w IDX
    SSL_CERT_FILE = "/etc/ssl/certs/ca-certificates.crt";
    SSL_CERT_DIR = "/etc/ssl/certs";
  };

  packages = [
    pkgs.nodejs_22
    pkgs.pnpm            # Dodane pnpm, jeśli projekt z niego korzysta
    pkgs.supabase-cli
    pkgs.cacert          # Wymuszenie załadowania certyfikatów urzędów certyfikacji
  ];

  idx.extensions = [
    # Tutaj możesz dodać rozszerzenia VS Code, jeśli potrzebujesz
  ];

  idx.previews = {
    previews = {
      web = {
        # Poprawiona komenda startowa (używaj ALBO pnpm, ALBO npm, usunąłem podwójne wywołanie)
        command = [
          "pnpm"
          "run"
          "dev:turbo"
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

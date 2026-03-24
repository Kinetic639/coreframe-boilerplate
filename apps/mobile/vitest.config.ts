import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    server: {
      deps: {
        // Inline @testing-library/* through Vite's bundler so that the
        // react/react-dom aliases above are applied to its imports.
        // Without this, Node.js resolves react-dom through pnpm's symlinks,
        // landing on react-dom@19.0.0 (a transitive version), which creates
        // a second React instance and breaks hook calls.
        inline: [/@testing-library/],
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // Force all react/react-dom imports to resolve to the single copy
      // installed in apps/mobile/node_modules (19.1.0). pnpm peer-dep
      // isolation causes @testing-library/react to pull react-dom@19.0.0
      // in the monorepo store, creating two React instances and "Invalid
      // hook call" errors at test time. Explicit paths prevent that.
      react: path.resolve(__dirname, "node_modules/react"),
      "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
    },
    dedupe: ["react", "react-dom"],
  },
});

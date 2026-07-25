import { nextJsConfig } from "@repo/eslint-config/next-js";
import { testConfig } from "@repo/eslint-config/test";

export default [
  ...nextJsConfig,
  ...testConfig,
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "react-hooks/exhaustive-deps": "warn",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "prefer-const": "error",
      "no-var": "error"
    }
  },
  {
    ignores: ["dist/**", "coverage/**", "public/**", ".next/**"]
  }
];

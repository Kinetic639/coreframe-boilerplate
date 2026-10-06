import { nextJsConfig } from "@repo/eslint-config/next-js";

export default [
  ...nextJsConfig,
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "react-hooks/exhaustive-deps": "warn",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "prefer-const": "error",
      "no-var": "error",
    },
  },
  {
    ignores: ["dist/**", "coverage/**", "public/**", ".next/**"],
  },
];

import globals from "globals";

/**
 * Shared test configuration for Vitest/Jest-style test files.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export const testConfig = [
  {
    files: ["**/*.{test,spec}.{js,jsx,ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.vitest,
      },
    },
  },
];

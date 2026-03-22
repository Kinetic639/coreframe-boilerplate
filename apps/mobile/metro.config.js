// Learn more: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// 1. Watch all workspace packages so Metro picks up changes across the monorepo.
config.watchFolders = [monorepoRoot];

// 2. Let Metro resolve packages from both the app's own node_modules and the
//    monorepo root's node_modules (where pnpm hoists workspace packages).
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// Note: no custom resolveRequest needed. Shared packages previously used
// NodeNext-style .js extensions in relative source imports; after changing
// packages/typescript-config/base.json to Bundler resolution, all internal
// imports are extensionless and Metro resolves them natively.

module.exports = config;

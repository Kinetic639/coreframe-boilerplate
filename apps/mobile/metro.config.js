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

// 3. Fix .js → .ts resolution for workspace packages that use the NodeNext
//    source-export pattern (TypeScript barrel files that import with .js
//    extensions, e.g. `export * from "./auth-service.js"`).
//
//    Metro resolves imports literally, so it looks for `auth-service.js` and
//    fails because the actual file is `auth-service.ts`. This resolver strips
//    the .js extension and retries with .ts before falling through.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.endsWith(".js")) {
    const tsName = moduleName.slice(0, -3) + ".ts";
    try {
      return context.resolveRequest(context, tsName, platform);
    } catch {
      // Not a .ts source file — fall through to normal resolution below.
    }
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

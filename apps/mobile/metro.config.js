// Metro config for a pnpm monorepo: pnpm's node_modules relies heavily on
// symlinks into a shared content-addressable store, which Metro's default
// resolver does not fully understand without this configuration.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Let Metro see and watch shared packages living outside apps/mobile.
config.watchFolders = [workspaceRoot];

// Resolve node_modules from both the app and the workspace root, and follow
// pnpm's symlinks instead of trying to resolve relative to their real path.
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, "node_modules"), path.resolve(workspaceRoot, "node_modules")];
config.resolver.unstable_enableSymlinks = true;

module.exports = config;

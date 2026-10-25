const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");
const config = getDefaultConfig(__dirname);
// Include shared TypeScript outside the mobile workspace, including ZIP checkouts.
const root = path.resolve(__dirname, "../..");
config.watchFolders = [...new Set([...(config.watchFolders || []), root])];
config.resolver.nodeModulesPaths = [
  path.join(__dirname, "node_modules"),
  path.join(root, "node_modules"),
];
module.exports = config;

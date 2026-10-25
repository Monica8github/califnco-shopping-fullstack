import fs from "node:fs";
export default ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    ...(fs.existsSync("./google-services.json")
      ? { googleServicesFile: "./google-services.json" }
      : {}),
  },
  extra: {
    ...config.extra,
    ...(process.env.EAS_PROJECT_ID
      ? { eas: { projectId: process.env.EAS_PROJECT_ID } }
      : {}),
  },
});

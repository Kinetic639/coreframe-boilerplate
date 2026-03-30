/** @type {import('syncpack').RcFile} */
module.exports = {
  source: [
    "package.json",
    "apps/*/package.json",
    "packages/*/package.json",
  ],
  versionGroups: [
    {
      label: "Ignore local workspace package versions",
      dependencyTypes: ["local"],
      isIgnored: true,
    },
  ],
};

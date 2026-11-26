// CHANGELOG lines for packages/app-version/CHANGELOG.md: only the text people wrote,
// without commit ids, so it can be shown in the app's "What's new" window as it is.

/** @type {import("@changesets/types").ChangelogFunctions} */
module.exports = {
  getReleaseLine: async (changeset) => {
    const [first = "", ...rest] = changeset.summary
      .trim()
      .split("\n")
      .map((line) => line.trimEnd());
    const more = rest.map((line) => (line ? `  ${line}` : "")).join("\n");
    return `\n- ${first}${more ? `\n${more}` : ""}`;
  },
  getDependencyReleaseLine: async () => "",
};

module.exports = {
  git: {
    commitMessage: "chore(release): ${version}",
    /** CI validates before packaging, so release commits skip local hooks. */
    commitArgs: ["--no-verify"],
    tagName: "v${version}",
  },
  npm: {
    publish: false,
  },
};

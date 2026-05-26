module.exports = {
  git: {
    commitMessage: "chore(release): ${version}",
    // The publish workflow validates before packaging; avoid rerunning local hooks
    // when release-it creates the version commit in CI.
    commitArgs: ["--no-verify"],
    tagName: "v${version}",
  },
  npm: {
    publish: false,
  },
};

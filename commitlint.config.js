export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Release notes are generated from the subject line; keep it readable.
    "header-max-length": [2, "always", 100],
    "body-max-line-length": [0],
    "footer-max-line-length": [0],
  },
  // Release commits are created by the release job.
  ignores: [(message) => message.startsWith("chore(release):")],
};

export default function handler(req, res) {
  const mark = (k) => (process.env[k] ? "✓" : "×");
  res.status(200).json({
    ADMIN_KEY: mark("ADMIN_KEY"),
    GITHUB_OWNER: mark("GITHUB_OWNER"),
    GITHUB_REPO: mark("GITHUB_REPO"),
    GITHUB_FILEPATH: mark("GITHUB_FILEPATH"),
    GITHUB_TOKEN: process.env.GITHUB_TOKEN ? "✓(hidden)" : "×",
  });
}

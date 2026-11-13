import { defineTool } from "eve/tools";
import { z } from "zod";
import { CODEBASE_DIR } from "../lib/assessment-job";

const MAX_CONTRIBUTORS = 500;

// `git log` over an uploaded repository is the one git command this agent runs, so it's fixed
// here instead of left to the model. A repository's own .git/config is untrusted: settings such as
// core.fsmonitor, core.pager, gpg.program (via log.showSignature), and hooks can make git run
// arbitrary commands. Command-line `-c` options override the repository's config, and the env
// below ignores system and global config.
const GIT_LOG_COMMAND = [
  "git",
  `-C ${CODEBASE_DIR}`,
  "--no-pager",
  "-c safe.directory='*'",
  "-c core.fsmonitor=false",
  "-c core.hooksPath=/dev/null",
  "-c log.showSignature=false",
  "-c gpg.program=false",
  "log --all --no-show-signature --no-mailmap --format='%an%x09%ae'",
].join(" ");

const GIT_ENV = {
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_TERMINAL_PROMPT: "0",
  GIT_OPTIONAL_LOCKS: "0",
};

export default defineTool({
  description:
    "List the people who authored commits in the downloaded codebase's git history, one entry " +
    "per email address, most commits first. Returns hasGitHistory: false when the upload has no " +
    ".git directory. Call it after download_codebase.",
  inputSchema: z.object({}),
  async execute(_input, ctx) {
    const sandbox = await ctx.getSandbox();

    const hasGit = await sandbox.run({ command: `test -d ${CODEBASE_DIR}/.git` });
    if (hasGit.exitCode !== 0) {
      return { hasGitHistory: false, contributors: [], truncated: false };
    }
    const gitAvailable = await sandbox.run({ command: "command -v git" });
    if (gitAvailable.exitCode !== 0) {
      throw new Error(
        "git is not installed in this sandbox, so contributors can't be read from the .git " +
          "directory. Report an empty contributors list.",
      );
    }

    const log = await sandbox.run({ command: GIT_LOG_COMMAND, env: GIT_ENV });
    if (log.exitCode !== 0) {
      // A .git directory with no commits, or a damaged one, has no usable history.
      return {
        hasGitHistory: false,
        contributors: [],
        truncated: false,
        note: `git log failed: ${log.stderr.trim().slice(0, 500)}`,
      };
    }

    // Commit authors keyed by lowercased email, keeping the name they used most often.
    const byEmail = new Map<string, { commits: number; names: Map<string, number> }>();
    for (const line of log.stdout.split("\n")) {
      const [rawName = "", rawEmail = ""] = line.split("\t");
      const name = rawName.trim();
      const email = rawEmail.trim().toLowerCase();
      if (email === "" || !email.includes("@")) continue;
      const entry = byEmail.get(email) ?? { commits: 0, names: new Map<string, number>() };
      entry.commits++;
      if (name !== "") entry.names.set(name, (entry.names.get(name) ?? 0) + 1);
      byEmail.set(email, entry);
    }

    const contributors = [...byEmail.entries()]
      .map(([email, { commits, names }]) => ({
        name: [...names.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? email.split("@")[0]!,
        email,
        commits,
      }))
      .sort((a, b) => b.commits - a.commits || a.email.localeCompare(b.email));

    return {
      hasGitHistory: true,
      contributors: contributors.slice(0, MAX_CONTRIBUTORS),
      truncated: contributors.length > MAX_CONTRIBUTORS,
    };
  },
});

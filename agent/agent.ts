import { defineAgent } from "eve";

export default defineAgent({
  model: "meta/muse-ember",
  // Only the tools this job needs: the authored download_codebase and list_git_contributors,
  // plus read-only exploration (bash, read_file, glob, grep in agent/tools/). Leaves out web
  // access, file editing, and the subagent tool.
  defaultTools: false,
});

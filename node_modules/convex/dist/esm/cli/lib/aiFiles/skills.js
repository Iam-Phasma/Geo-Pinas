"use strict";
import child_process from "child_process";
import path from "path";
import { promises as fs } from "fs";
import { chalkStderr } from "chalk";
import { logMessage } from "../../../bundler/log.js";
import { getVersion, fetchAgentSkillsSha } from "../versionApi.js";
import { iife, readFileSafe } from "./utils.js";
async function readInstalledSkillNames(projectDir) {
  const skillsDir = path.join(projectDir, ".agents", "skills");
  const entries = await iife(async () => {
    try {
      const dirents = await fs.readdir(skillsDir, { withFileTypes: true });
      return dirents.filter((d) => d.isDirectory() || d.isSymbolicLink()).map((d) => d.name);
    } catch {
      return [];
    }
  });
  if (entries.length === 0) return [];
  const names = [];
  for (const entry of entries) {
    const skillMdPath = path.join(skillsDir, entry, "SKILL.md");
    const content = await readFileSafe(skillMdPath);
    if (content === null) continue;
    const match = content.match(/^---[\s\S]*?^name:\s*(.+?)\s*$/m);
    if (match) {
      names.push(match[1]);
    }
  }
  return names;
}
function runSkillsAdd(cwd) {
  return runSkillsCommand(cwd, ["add", "get-convex/agent-skills", "--yes"]);
}
function runSkillsRemove({
  cwd,
  skillNames
}) {
  return runSkillsCommand(cwd, ["remove", ...skillNames, "--yes"]);
}
async function shouldRunSkillsCli() {
  const versionData = await getVersion();
  if (versionData.kind === "error") return true;
  if (versionData.data.disableSkillsCli) {
    logMessage(chalkStderr.yellow(`Agent skills are temporarily disabled.`));
    return false;
  }
  return true;
}
async function removeSkillsLockIfEmpty({
  projectDir,
  removedSkillNames
}) {
  const lockPath = path.join(projectDir, "skills-lock.json");
  try {
    const content = await fs.readFile(lockPath, "utf8");
    const lock = JSON.parse(content);
    if (!lock || typeof lock !== "object" || !lock.skills || typeof lock.skills !== "object") {
      return false;
    }
    const remainingSkills = Object.keys(lock.skills).filter(
      (name) => !removedSkillNames.includes(name)
    );
    if (remainingSkills.length === 0) {
      await fs.unlink(lockPath);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
export async function installSkills({
  projectDir,
  config
}) {
  if (!await shouldRunSkillsCli()) return;
  logMessage("Installing Convex agent skills...");
  const skillsOk = await runSkillsAdd(projectDir);
  if (!skillsOk) {
    logMessage(
      chalkStderr.yellow(
        "Could not install agent skills. You can retry manually with: npx skills add get-convex/agent-skills"
      )
    );
    return;
  }
  const sha = await fetchAgentSkillsSha();
  if (sha) config.agentSkillsSha = sha;
  const names = await readInstalledSkillNames(projectDir);
  if (names.length > 0) config.installedSkillNames = names;
}
export async function removeInstalledSkills({
  projectDir,
  skillNames
}) {
  if (skillNames.length === 0 || !await shouldRunSkillsCli()) return false;
  logMessage(`Removing Convex agent skills: ${skillNames.join(", ")}`);
  const skillsOk = await runSkillsRemove({ cwd: projectDir, skillNames });
  if (!skillsOk) {
    logMessage(
      chalkStderr.yellow(
        "Could not remove agent skills automatically. Remove them manually with: npx skills remove"
      )
    );
    return false;
  }
  const lockRemoved = await removeSkillsLockIfEmpty({
    projectDir,
    removedSkillNames: skillNames
  });
  if (lockRemoved)
    logMessage(`${chalkStderr.green("\u2714")} Deleted skills-lock.json.`);
  return true;
}
function runSkillsCommand(cwd, args) {
  return new Promise((resolve) => {
    const proc = child_process.spawn(
      "npx",
      ["--yes", "skills@latest", ...args],
      {
        cwd,
        stdio: "pipe",
        // .cmd files on Windows require shell execution.
        shell: process.platform === "win32"
      }
    );
    let capturedOutput = "";
    proc.stdout?.on("data", (chunk) => {
      capturedOutput += chunk.toString();
    });
    proc.stderr?.on("data", (chunk) => {
      capturedOutput += chunk.toString();
    });
    proc.on("close", (code) => {
      if (code !== 0 && capturedOutput.trim().length > 0) {
        const lines = capturedOutput.trim().split(/\r?\n/);
        const tail = lines.slice(-10).join("\n");
        logMessage(chalkStderr.gray(`skills output (tail):
${tail}`));
      }
      resolve(code === 0);
    });
    proc.on("error", () => resolve(false));
  });
}
//# sourceMappingURL=skills.js.map

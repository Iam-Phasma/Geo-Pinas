"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var skills_exports = {};
__export(skills_exports, {
  installSkills: () => installSkills,
  removeInstalledSkills: () => removeInstalledSkills
});
module.exports = __toCommonJS(skills_exports);
var import_child_process = __toESM(require("child_process"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = require("fs");
var import_chalk = require("chalk");
var import_log = require("../../../bundler/log.js");
var import_versionApi = require("../versionApi.js");
var import_utils = require("./utils.js");
async function readInstalledSkillNames(projectDir) {
  const skillsDir = import_path.default.join(projectDir, ".agents", "skills");
  const entries = await (0, import_utils.iife)(async () => {
    try {
      const dirents = await import_fs.promises.readdir(skillsDir, { withFileTypes: true });
      return dirents.filter((d) => d.isDirectory() || d.isSymbolicLink()).map((d) => d.name);
    } catch {
      return [];
    }
  });
  if (entries.length === 0) return [];
  const names = [];
  for (const entry of entries) {
    const skillMdPath = import_path.default.join(skillsDir, entry, "SKILL.md");
    const content = await (0, import_utils.readFileSafe)(skillMdPath);
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
  const versionData = await (0, import_versionApi.getVersion)();
  if (versionData.kind === "error") return true;
  if (versionData.data.disableSkillsCli) {
    (0, import_log.logMessage)(import_chalk.chalkStderr.yellow(`Agent skills are temporarily disabled.`));
    return false;
  }
  return true;
}
async function removeSkillsLockIfEmpty({
  projectDir,
  removedSkillNames
}) {
  const lockPath = import_path.default.join(projectDir, "skills-lock.json");
  try {
    const content = await import_fs.promises.readFile(lockPath, "utf8");
    const lock = JSON.parse(content);
    if (!lock || typeof lock !== "object" || !lock.skills || typeof lock.skills !== "object") {
      return false;
    }
    const remainingSkills = Object.keys(lock.skills).filter(
      (name) => !removedSkillNames.includes(name)
    );
    if (remainingSkills.length === 0) {
      await import_fs.promises.unlink(lockPath);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
async function installSkills({
  projectDir,
  config
}) {
  if (!await shouldRunSkillsCli()) return;
  (0, import_log.logMessage)("Installing Convex agent skills...");
  const skillsOk = await runSkillsAdd(projectDir);
  if (!skillsOk) {
    (0, import_log.logMessage)(
      import_chalk.chalkStderr.yellow(
        "Could not install agent skills. You can retry manually with: npx skills add get-convex/agent-skills"
      )
    );
    return;
  }
  const sha = await (0, import_versionApi.fetchAgentSkillsSha)();
  if (sha) config.agentSkillsSha = sha;
  const names = await readInstalledSkillNames(projectDir);
  if (names.length > 0) config.installedSkillNames = names;
}
async function removeInstalledSkills({
  projectDir,
  skillNames
}) {
  if (skillNames.length === 0 || !await shouldRunSkillsCli()) return false;
  (0, import_log.logMessage)(`Removing Convex agent skills: ${skillNames.join(", ")}`);
  const skillsOk = await runSkillsRemove({ cwd: projectDir, skillNames });
  if (!skillsOk) {
    (0, import_log.logMessage)(
      import_chalk.chalkStderr.yellow(
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
    (0, import_log.logMessage)(`${import_chalk.chalkStderr.green("\u2714")} Deleted skills-lock.json.`);
  return true;
}
function runSkillsCommand(cwd, args) {
  return new Promise((resolve) => {
    const proc = import_child_process.default.spawn(
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
        (0, import_log.logMessage)(import_chalk.chalkStderr.gray(`skills output (tail):
${tail}`));
      }
      resolve(code === 0);
    });
    proc.on("error", () => resolve(false));
  });
}
//# sourceMappingURL=skills.js.map

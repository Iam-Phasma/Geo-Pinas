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
var aiFiles_exports = {};
__export(aiFiles_exports, {
  checkAiFilesStaleness: () => checkAiFilesStaleness,
  enableAiFiles: () => enableAiFiles,
  installAiFiles: () => installAiFiles,
  maybeSetupAiFiles: () => maybeSetupAiFiles,
  removeAiFiles: () => removeAiFiles,
  safelyAttemptToDisableAiFiles: () => safelyAttemptToDisableAiFiles
});
module.exports = __toCommonJS(aiFiles_exports);
var Sentry = __toESM(require("@sentry/node"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = require("fs");
var import_chalk = require("chalk");
var import_log = require("../../../bundler/log.js");
var import_prompts = require("../utils/prompts.js");
var import_paths = require("./paths.js");
var import_guidelinesmd = require("./guidelinesmd.js");
var import_config = require("./config.js");
var import_utils = require("./utils.js");
var import_agentsmd = require("./agentsmd.js");
var import_claudemd = require("./claudemd.js");
var import_skills = require("./skills.js");
var import_cursorrules = require("./cursorrules.js");
async function hasExistingAiFilesArtifacts({
  projectDir,
  convexDir
}) {
  return await (0, import_guidelinesmd.hasGuidelinesInstalled)(convexDir) || await (0, import_agentsmd.hasAgentsMdInstalled)(projectDir) || await (0, import_claudemd.hasClaudeMdInstalled)(projectDir);
}
async function installAiFiles({
  projectDir,
  convexDir,
  shouldWriteGuidelines = true,
  shouldWriteAgentsMd = true,
  shouldWriteClaudeMd = true,
  shouldWriteSkills = true
}) {
  await import_fs.promises.mkdir((0, import_paths.aiDirForConvexDir)(convexDir), { recursive: true });
  const config = await (0, import_config.readAiConfig)({
    projectDir,
    convexDir
  }) ?? {
    enabled: true,
    guidelinesHash: null,
    agentsMdSectionHash: null,
    claudeMdHash: null,
    agentSkillsSha: null,
    installedSkillNames: []
  };
  if (shouldWriteGuidelines) await (0, import_guidelinesmd.installGuidelinesFile)({ convexDir, config });
  const convexDirName = import_path.default.relative(projectDir, convexDir);
  if (shouldWriteAgentsMd)
    await (0, import_agentsmd.applyAgentsMdSection)({ projectDir, config, convexDirName });
  if (shouldWriteClaudeMd)
    await (0, import_claudemd.applyClaudeMdSection)({ projectDir, config, convexDirName });
  if (shouldWriteSkills) await (0, import_skills.installSkills)({ projectDir, config });
  await (0, import_cursorrules.removeLegacyCursorRulesFile)(projectDir);
  await (0, import_config.writeAiConfig)({ config, projectDir, convexDir });
  (0, import_log.logMessage)(`${import_chalk.chalkStderr.green("\u2714")} Convex AI files installed.`);
}
async function attemptToInstallAiFiles(opts) {
  try {
    await installAiFiles(opts);
  } catch (error) {
    Sentry.captureException(error);
  }
}
async function determineAiFilesStaleness({
  canonicalGuidelinesHash,
  canonicalAgentSkillsSha,
  projectDir,
  convexDir
}) {
  const config = await (0, import_config.readAiConfig)({ projectDir, convexDir });
  if (config === null) {
    const hasArtifacts = await hasExistingAiFilesArtifacts({
      projectDir,
      convexDir
    });
    return hasArtifacts ? "has-artifacts" : "not-installed";
  }
  if (!config.enabled) return "disabled";
  if (canonicalGuidelinesHash === null && canonicalAgentSkillsSha === null)
    return "up-to-date";
  const guidelinesStale = canonicalGuidelinesHash !== null && config.guidelinesHash !== null && config.guidelinesHash !== canonicalGuidelinesHash;
  const skillsStale = canonicalAgentSkillsSha !== null && config.agentSkillsSha !== null && config.agentSkillsSha !== canonicalAgentSkillsSha;
  return guidelinesStale || skillsStale ? "stale" : "up-to-date";
}
async function checkAiFilesStaleness(opts) {
  const status = await determineAiFilesStaleness(opts);
  if (status === "not-installed") {
    (0, import_log.logMessage)(
      import_chalk.chalkStderr.yellow(
        `Convex AI files are not installed. Run ${import_chalk.chalkStderr.bold(`npx convex ai-files install`)} to get started or ${import_chalk.chalkStderr.bold(`npx convex ai-files disable`)} to hide this message.`
      )
    );
  }
  if (status === "stale") {
    (0, import_log.logMessage)(
      import_chalk.chalkStderr.yellow(
        `Your Convex AI files are out of date. Run ${import_chalk.chalkStderr.bold(`npx convex ai-files update`)} to get the latest.`
      )
    );
  }
}
async function enableAiFiles({
  projectDir,
  convexDir
}) {
  await installAiFiles({ projectDir, convexDir });
  const config = await (0, import_config.readAiConfig)({ projectDir, convexDir });
  if (config === null) return;
  config.enabled = true;
  await (0, import_config.writeAiConfig)({
    config,
    projectDir,
    convexDir,
    options: { persistEnabledPreference: "always" }
  });
}
async function removeAiFiles({
  projectDir,
  convexDir
}) {
  const config = await (0, import_config.readAiConfig)({ projectDir, convexDir });
  if (config === null) {
    (0, import_log.logMessage)("No Convex AI files found \u2014 nothing to remove.");
    return;
  }
  const removals = [
    await (0, import_agentsmd.removeAgentsMdSection)(projectDir),
    await (0, import_claudemd.removeClaudeMdSection)(projectDir),
    await (0, import_skills.removeInstalledSkills)({
      projectDir,
      skillNames: config.installedSkillNames
    }),
    await (0, import_cursorrules.removeLegacyCursorRulesFile)(projectDir),
    await attemptToDeleteAiDir({ projectDir, convexDir })
  ];
  if (removals.some(Boolean)) (0, import_log.logMessage)("Convex AI files removed.");
}
async function safelyAttemptToDisableAiFiles(projectDir) {
  try {
    await (0, import_config.writeAiEnabledToProjectConfig)({
      projectDir,
      enabled: false
    });
    (0, import_log.logMessage)(
      `${import_chalk.chalkStderr.green(`\u2714`)} Convex AI files disabled. Run ${import_chalk.chalkStderr.bold(`npx convex ai-files enable`)} to re-enable.`
    );
  } catch (error) {
    Sentry.captureException(error);
    (0, import_log.logMessage)(
      import_chalk.chalkStderr.yellow(
        "Could not write AI message suppression config. Message may reappear."
      )
    );
  }
}
async function attemptToDeleteAiDir({
  projectDir,
  convexDir
}) {
  const aiDir = (0, import_paths.aiDirForConvexDir)(convexDir);
  const relPath = import_path.default.relative(projectDir, aiDir);
  try {
    await import_fs.promises.rm(aiDir, { recursive: true, force: true });
    (0, import_log.logMessage)(`${import_chalk.chalkStderr.green("\u2714")} Deleted ${relPath}/`);
    return true;
  } catch (error) {
    Sentry.captureException(error);
    (0, import_log.logMessage)(
      import_chalk.chalkStderr.yellow(`Could not delete ${relPath}/. Remove it manually.`)
    );
    return false;
  }
}
async function hasAiFilesBeenInstalledBefore({
  projectDir,
  convexDir
}) {
  return await (0, import_config.hasAiFilesConfig)({ projectDir, convexDir }) || await hasExistingAiFilesArtifacts({ projectDir, convexDir });
}
async function maybeSetupAiFiles({
  ctx,
  convexDir,
  projectDir
}) {
  if (!(0, import_utils.isInInteractiveTerminal)()) return;
  const config = await (0, import_config.readAiConfig)({ projectDir, convexDir });
  if (config !== null && !config.enabled) return;
  if (await hasAiFilesBeenInstalledBefore({ projectDir, convexDir })) {
    await attemptToInstallAiFiles({ projectDir, convexDir });
    return;
  }
  const shouldInstall = await (0, import_prompts.promptYesNo)(ctx, {
    message: "Set up Convex AI files? (guidelines, AGENTS.md, agent skills)",
    default: true
  });
  if (shouldInstall) await attemptToInstallAiFiles({ projectDir, convexDir });
}
//# sourceMappingURL=index.js.map

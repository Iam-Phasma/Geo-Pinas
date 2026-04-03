"use strict";
import * as Sentry from "@sentry/node";
import path from "path";
import { promises as fs } from "fs";
import { chalkStderr } from "chalk";
import { logMessage } from "../../../bundler/log.js";
import { promptYesNo } from "../utils/prompts.js";
import { aiDirForConvexDir } from "./paths.js";
import {
  installGuidelinesFile,
  hasGuidelinesInstalled
} from "./guidelinesmd.js";
import {
  hasAiFilesConfig,
  readAiConfig,
  writeAiConfig,
  writeAiEnabledToProjectConfig
} from "./config.js";
import { isInInteractiveTerminal } from "./utils.js";
import {
  hasAgentsMdInstalled,
  applyAgentsMdSection,
  removeAgentsMdSection
} from "./agentsmd.js";
import {
  hasClaudeMdInstalled,
  applyClaudeMdSection,
  removeClaudeMdSection
} from "./claudemd.js";
import { installSkills, removeInstalledSkills } from "./skills.js";
import { removeLegacyCursorRulesFile as removeLegacyCursorRules } from "./cursorrules.js";
async function hasExistingAiFilesArtifacts({
  projectDir,
  convexDir
}) {
  return await hasGuidelinesInstalled(convexDir) || await hasAgentsMdInstalled(projectDir) || await hasClaudeMdInstalled(projectDir);
}
export async function installAiFiles({
  projectDir,
  convexDir,
  shouldWriteGuidelines = true,
  shouldWriteAgentsMd = true,
  shouldWriteClaudeMd = true,
  shouldWriteSkills = true
}) {
  await fs.mkdir(aiDirForConvexDir(convexDir), { recursive: true });
  const config = await readAiConfig({
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
  if (shouldWriteGuidelines) await installGuidelinesFile({ convexDir, config });
  const convexDirName = path.relative(projectDir, convexDir);
  if (shouldWriteAgentsMd)
    await applyAgentsMdSection({ projectDir, config, convexDirName });
  if (shouldWriteClaudeMd)
    await applyClaudeMdSection({ projectDir, config, convexDirName });
  if (shouldWriteSkills) await installSkills({ projectDir, config });
  await removeLegacyCursorRules(projectDir);
  await writeAiConfig({ config, projectDir, convexDir });
  logMessage(`${chalkStderr.green("\u2714")} Convex AI files installed.`);
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
  const config = await readAiConfig({ projectDir, convexDir });
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
export async function checkAiFilesStaleness(opts) {
  const status = await determineAiFilesStaleness(opts);
  if (status === "not-installed") {
    logMessage(
      chalkStderr.yellow(
        `Convex AI files are not installed. Run ${chalkStderr.bold(`npx convex ai-files install`)} to get started or ${chalkStderr.bold(`npx convex ai-files disable`)} to hide this message.`
      )
    );
  }
  if (status === "stale") {
    logMessage(
      chalkStderr.yellow(
        `Your Convex AI files are out of date. Run ${chalkStderr.bold(`npx convex ai-files update`)} to get the latest.`
      )
    );
  }
}
export async function enableAiFiles({
  projectDir,
  convexDir
}) {
  await installAiFiles({ projectDir, convexDir });
  const config = await readAiConfig({ projectDir, convexDir });
  if (config === null) return;
  config.enabled = true;
  await writeAiConfig({
    config,
    projectDir,
    convexDir,
    options: { persistEnabledPreference: "always" }
  });
}
export async function removeAiFiles({
  projectDir,
  convexDir
}) {
  const config = await readAiConfig({ projectDir, convexDir });
  if (config === null) {
    logMessage("No Convex AI files found \u2014 nothing to remove.");
    return;
  }
  const removals = [
    await removeAgentsMdSection(projectDir),
    await removeClaudeMdSection(projectDir),
    await removeInstalledSkills({
      projectDir,
      skillNames: config.installedSkillNames
    }),
    await removeLegacyCursorRules(projectDir),
    await attemptToDeleteAiDir({ projectDir, convexDir })
  ];
  if (removals.some(Boolean)) logMessage("Convex AI files removed.");
}
export async function safelyAttemptToDisableAiFiles(projectDir) {
  try {
    await writeAiEnabledToProjectConfig({
      projectDir,
      enabled: false
    });
    logMessage(
      `${chalkStderr.green(`\u2714`)} Convex AI files disabled. Run ${chalkStderr.bold(`npx convex ai-files enable`)} to re-enable.`
    );
  } catch (error) {
    Sentry.captureException(error);
    logMessage(
      chalkStderr.yellow(
        "Could not write AI message suppression config. Message may reappear."
      )
    );
  }
}
async function attemptToDeleteAiDir({
  projectDir,
  convexDir
}) {
  const aiDir = aiDirForConvexDir(convexDir);
  const relPath = path.relative(projectDir, aiDir);
  try {
    await fs.rm(aiDir, { recursive: true, force: true });
    logMessage(`${chalkStderr.green("\u2714")} Deleted ${relPath}/`);
    return true;
  } catch (error) {
    Sentry.captureException(error);
    logMessage(
      chalkStderr.yellow(`Could not delete ${relPath}/. Remove it manually.`)
    );
    return false;
  }
}
async function hasAiFilesBeenInstalledBefore({
  projectDir,
  convexDir
}) {
  return await hasAiFilesConfig({ projectDir, convexDir }) || await hasExistingAiFilesArtifacts({ projectDir, convexDir });
}
export async function maybeSetupAiFiles({
  ctx,
  convexDir,
  projectDir
}) {
  if (!isInInteractiveTerminal()) return;
  const config = await readAiConfig({ projectDir, convexDir });
  if (config !== null && !config.enabled) return;
  if (await hasAiFilesBeenInstalledBefore({ projectDir, convexDir })) {
    await attemptToInstallAiFiles({ projectDir, convexDir });
    return;
  }
  const shouldInstall = await promptYesNo(ctx, {
    message: "Set up Convex AI files? (guidelines, AGENTS.md, agent skills)",
    default: true
  });
  if (shouldInstall) await attemptToInstallAiFiles({ projectDir, convexDir });
}
//# sourceMappingURL=index.js.map

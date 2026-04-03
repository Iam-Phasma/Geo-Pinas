"use strict";
import path from "path";
import { chalkStderr } from "chalk";
import { logMessage } from "../../../bundler/log.js";
import {
  AGENTS_MD_START_MARKER,
  AGENTS_MD_END_MARKER,
  agentsMdConvexSection
} from "../../codegen_templates/agentsmd.js";
import {
  CLAUDE_MD_START_MARKER,
  CLAUDE_MD_END_MARKER,
  claudeMdConvexSection
} from "../../codegen_templates/claudemd.js";
import { getVersion } from "../versionApi.js";
import { hashSha256 } from "../utils/hash.js";
import {
  agentsMdPath,
  claudeMdPath,
  guidelinesPathForConvexDir
} from "./paths.js";
import { readAiConfig } from "./config.js";
import { readFileSafe } from "./utils.js";
function logGuidelinesStatus({
  guidelinesFile,
  guidelinesRelPath,
  config,
  canonicalGuidelinesHash,
  networkAvailable
}) {
  if (guidelinesFile === null) {
    logMessage(
      `  ${chalkStderr.yellow("\u26A0")} ${guidelinesRelPath}: not on disk \u2014 run ${chalkStderr.bold("npx convex ai-files install")} to reinstall`
    );
    return;
  }
  const isLocallyModified = config.guidelinesHash !== null && hashSha256(guidelinesFile) !== config.guidelinesHash;
  if (isLocallyModified) {
    logMessage(
      `  ${chalkStderr.yellow("\u26A0")} ${guidelinesRelPath}: installed, modified locally (changes will be overwritten on next update)`
    );
    return;
  }
  const isOutOfDate = networkAvailable && canonicalGuidelinesHash !== null && config.guidelinesHash !== null && config.guidelinesHash !== canonicalGuidelinesHash;
  if (isOutOfDate) {
    logMessage(
      `  ${chalkStderr.yellow("\u26A0")} ${guidelinesRelPath}: installed, out of date \u2014 run ${chalkStderr.bold("npx convex ai-files update")}`
    );
    return;
  }
  logMessage(
    `  ${chalkStderr.green("\u2714")} ${guidelinesRelPath}: installed${networkAvailable ? ", up to date" : ""}`
  );
}
function logAgentsMdStatus({
  agentsContent,
  config,
  convexDirName
}) {
  const hasSection = agentsContent !== null && agentsContent.includes(AGENTS_MD_START_MARKER) && agentsContent.includes(AGENTS_MD_END_MARKER);
  if (!hasSection) {
    logMessage(
      `  ${chalkStderr.yellow("\u26A0")} AGENTS.md: Convex section missing \u2014 run ${chalkStderr.bold("npx convex ai-files install")} to reinstall`
    );
    return;
  }
  const currentHash = hashSha256(agentsMdConvexSection(convexDirName));
  if (config.agentsMdSectionHash !== null && config.agentsMdSectionHash !== currentHash) {
    logMessage(
      `  ${chalkStderr.yellow("\u26A0")} AGENTS.md: Convex section out of date \u2014 run ${chalkStderr.bold("npx convex ai-files update")}`
    );
  } else {
    logMessage(
      `  ${chalkStderr.green("\u2714")} AGENTS.md: Convex section present, up to date`
    );
  }
}
function logClaudeMdStatus({
  claudeContent,
  config,
  convexDirName
}) {
  const hasSection = claudeContent !== null && claudeContent.includes(CLAUDE_MD_START_MARKER) && claudeContent.includes(CLAUDE_MD_END_MARKER);
  if (!hasSection) {
    if (claudeContent === null) {
      logMessage(
        `  ${chalkStderr.yellow("\u26A0")} CLAUDE.md: missing - run ${chalkStderr.bold("npx convex ai-files install")} to create it`
      );
    } else {
      logMessage(
        `  ${chalkStderr.yellow("\u26A0")} CLAUDE.md: no Convex section present - run ${chalkStderr.bold("npx convex ai-files update")} to add it`
      );
    }
    return;
  }
  const currentHash = hashSha256(claudeMdConvexSection(convexDirName));
  if (config.claudeMdHash !== null && config.claudeMdHash !== currentHash) {
    logMessage(
      `  ${chalkStderr.yellow("\u26A0")} CLAUDE.md: Convex section out of date - run ${chalkStderr.bold("npx convex ai-files update")}`
    );
  } else {
    logMessage(
      `  ${chalkStderr.green("\u2714")} CLAUDE.md: Convex section present, up to date`
    );
  }
}
function logSkillsStatus({
  config,
  canonicalAgentSkillsSha,
  networkAvailable
}) {
  if (config.installedSkillNames.length === 0) {
    logMessage(
      `  ${chalkStderr.yellow("\u26A0")} Agent skills: not installed \u2014 run ${chalkStderr.bold("npx convex ai-files install")} to install`
    );
    return;
  }
  const skillsList = config.installedSkillNames.join(", ");
  const isStale = networkAvailable && canonicalAgentSkillsSha !== null && config.agentSkillsSha !== null && config.agentSkillsSha !== canonicalAgentSkillsSha;
  if (isStale) {
    logMessage(
      `  ${chalkStderr.yellow("\u26A0")} Agent skills: ${skillsList} \u2014 out of date, run ${chalkStderr.bold("npx convex ai-files update")}`
    );
  } else {
    logMessage(
      `  ${chalkStderr.green("\u2714")} Agent skills: ${skillsList}${networkAvailable ? " (up to date)" : ""}`
    );
  }
}
export async function statusAiFiles({
  projectDir,
  convexDir
}) {
  const convexDirName = path.relative(projectDir, convexDir);
  const guidelinesRelPath = path.relative(
    projectDir,
    guidelinesPathForConvexDir(convexDir)
  );
  const config = await readAiConfig({ projectDir, convexDir });
  if (config === null) {
    logMessage(`Convex AI files: ${chalkStderr.yellow("not installed")}`);
    logMessage(
      `  Run ${chalkStderr.bold("npx convex ai-files install")} to get started, or ${chalkStderr.bold("npx convex ai-files disable")} to opt out.`
    );
    return;
  }
  if (!config.enabled) {
    logMessage(`Convex AI files: ${chalkStderr.yellow("disabled")}`);
    logMessage(
      `  Run ${chalkStderr.bold("npx convex ai-files enable")} to re-enable.`
    );
    return;
  }
  logMessage(`Convex AI files: ${chalkStderr.green("enabled")}`);
  const [versionData, guidelinesFile, agentsContent, claudeContent] = await Promise.all([
    getVersion(),
    readFileSafe(guidelinesPathForConvexDir(convexDir)),
    readFileSafe(agentsMdPath(projectDir)),
    readFileSafe(claudeMdPath(projectDir))
  ]);
  const networkAvailable = versionData.kind === "ok";
  const canonicalGuidelinesHash = networkAvailable ? versionData.data.guidelinesHash : null;
  const canonicalAgentSkillsSha = networkAvailable ? versionData.data.agentSkillsSha : null;
  logGuidelinesStatus({
    guidelinesFile,
    guidelinesRelPath,
    config,
    canonicalGuidelinesHash,
    networkAvailable
  });
  logAgentsMdStatus({ agentsContent, config, convexDirName });
  logClaudeMdStatus({ claudeContent, config, convexDirName });
  logSkillsStatus({ config, canonicalAgentSkillsSha, networkAvailable });
}
//# sourceMappingURL=status.js.map

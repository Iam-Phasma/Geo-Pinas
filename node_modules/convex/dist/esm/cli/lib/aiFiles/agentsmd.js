"use strict";
import {
  AGENTS_MD_START_MARKER,
  AGENTS_MD_END_MARKER,
  agentsMdConvexSection
} from "../../codegen_templates/agentsmd.js";
import { agentsMdPath } from "./paths.js";
import {
  injectManagedSection,
  stripManagedSection,
  hasManagedSection,
  removeMarkdownSection
} from "./utils.js";
function target(projectDir) {
  return {
    filePath: agentsMdPath(projectDir),
    startMarker: AGENTS_MD_START_MARKER,
    endMarker: AGENTS_MD_END_MARKER
  };
}
export async function injectAgentsMdSection({
  section,
  projectDir
}) {
  return injectManagedSection({ ...target(projectDir), section });
}
export async function stripAgentsMdSection(projectDir) {
  return stripManagedSection(target(projectDir));
}
export async function removeAgentsMdSection(projectDir) {
  return removeMarkdownSection({
    projectDir,
    strip: stripAgentsMdSection,
    fileName: "AGENTS.md"
  });
}
export async function hasAgentsMdInstalled(projectDir) {
  return hasManagedSection(target(projectDir));
}
export async function applyAgentsMdSection({
  projectDir,
  config,
  convexDirName
}) {
  const result = await injectAgentsMdSection({
    section: agentsMdConvexSection(convexDirName),
    projectDir
  });
  config.agentsMdSectionHash = result.sectionHash;
  return result.didWrite;
}
//# sourceMappingURL=agentsmd.js.map

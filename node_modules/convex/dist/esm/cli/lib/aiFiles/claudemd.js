"use strict";
import {
  CLAUDE_MD_END_MARKER,
  CLAUDE_MD_START_MARKER,
  claudeMdConvexSection
} from "../../codegen_templates/claudemd.js";
import { claudeMdPath } from "./paths.js";
import {
  injectManagedSection,
  stripManagedSection,
  hasManagedSection,
  removeMarkdownSection
} from "./utils.js";
function target(projectDir) {
  return {
    filePath: claudeMdPath(projectDir),
    startMarker: CLAUDE_MD_START_MARKER,
    endMarker: CLAUDE_MD_END_MARKER
  };
}
export async function injectClaudeMdSection({
  section,
  projectDir
}) {
  return injectManagedSection({ ...target(projectDir), section });
}
export async function stripClaudeMdSection(projectDir) {
  return stripManagedSection(target(projectDir));
}
export async function removeClaudeMdSection(projectDir) {
  return removeMarkdownSection({
    projectDir,
    strip: stripClaudeMdSection,
    fileName: "CLAUDE.md"
  });
}
export async function hasClaudeMdInstalled(projectDir) {
  return hasManagedSection(target(projectDir));
}
export async function applyClaudeMdSection({
  projectDir,
  config,
  convexDirName
}) {
  const result = await injectClaudeMdSection({
    section: claudeMdConvexSection(convexDirName),
    projectDir
  });
  config.claudeMdHash = result.sectionHash;
  return result.didWrite;
}
//# sourceMappingURL=claudemd.js.map

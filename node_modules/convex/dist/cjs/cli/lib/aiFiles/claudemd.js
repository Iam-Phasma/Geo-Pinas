"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target2, all) => {
  for (var name in all)
    __defProp(target2, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var claudemd_exports = {};
__export(claudemd_exports, {
  applyClaudeMdSection: () => applyClaudeMdSection,
  hasClaudeMdInstalled: () => hasClaudeMdInstalled,
  injectClaudeMdSection: () => injectClaudeMdSection,
  removeClaudeMdSection: () => removeClaudeMdSection,
  stripClaudeMdSection: () => stripClaudeMdSection
});
module.exports = __toCommonJS(claudemd_exports);
var import_claudemd = require("../../codegen_templates/claudemd.js");
var import_paths = require("./paths.js");
var import_utils = require("./utils.js");
function target(projectDir) {
  return {
    filePath: (0, import_paths.claudeMdPath)(projectDir),
    startMarker: import_claudemd.CLAUDE_MD_START_MARKER,
    endMarker: import_claudemd.CLAUDE_MD_END_MARKER
  };
}
async function injectClaudeMdSection({
  section,
  projectDir
}) {
  return (0, import_utils.injectManagedSection)({ ...target(projectDir), section });
}
async function stripClaudeMdSection(projectDir) {
  return (0, import_utils.stripManagedSection)(target(projectDir));
}
async function removeClaudeMdSection(projectDir) {
  return (0, import_utils.removeMarkdownSection)({
    projectDir,
    strip: stripClaudeMdSection,
    fileName: "CLAUDE.md"
  });
}
async function hasClaudeMdInstalled(projectDir) {
  return (0, import_utils.hasManagedSection)(target(projectDir));
}
async function applyClaudeMdSection({
  projectDir,
  config,
  convexDirName
}) {
  const result = await injectClaudeMdSection({
    section: (0, import_claudemd.claudeMdConvexSection)(convexDirName),
    projectDir
  });
  config.claudeMdHash = result.sectionHash;
  return result.didWrite;
}
//# sourceMappingURL=claudemd.js.map

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
var config_exports = {};
__export(config_exports, {
  aiFilesStateSchema: () => aiFilesStateSchema,
  hasAiFilesConfig: () => hasAiFilesConfig,
  readAiConfig: () => readAiConfig,
  writeAiConfig: () => writeAiConfig,
  writeAiEnabledToProjectConfig: () => writeAiEnabledToProjectConfig
});
module.exports = __toCommonJS(config_exports);
var Sentry = __toESM(require("@sentry/node"), 1);
var import_fs = require("fs");
var import_path = __toESM(require("path"), 1);
var import_zod = require("zod");
var import_paths = require("./paths.js");
var import_utils = require("./utils.js");
const aiFilesStateSchema = import_zod.z.object({
  guidelinesHash: import_zod.z.string().nullable(),
  agentsMdSectionHash: import_zod.z.string().nullable(),
  claudeMdHash: import_zod.z.string().nullable(),
  // Commit SHA from get-convex/agent-skills that was current when skills were
  // last installed. Used to detect when newer skills are available.
  agentSkillsSha: import_zod.z.string().nullable(),
  // Names of skills installed by `npx skills add`, used by `remove` to
  // only remove Convex-managed skills.
  installedSkillNames: import_zod.z.array(import_zod.z.string()).default([])
});
const aiFilesProjectConfigSchema = import_zod.z.object({
  aiFiles: import_zod.z.object({
    // `enabled` is the canonical field. When present it takes full
    // precedence - `enabled: true` will re-enable even if the legacy
    // disableStalenessMessage field is still `true` in the file.
    enabled: import_zod.z.boolean().optional(),
    // @deprecated - use `enabled` instead. Read for backward compat;
    // new writes always emit `enabled` and drop this key.
    disableStalenessMessage: import_zod.z.boolean().optional()
  }).default({})
}).passthrough();
const EMPTY_AI_STATE = {
  guidelinesHash: null,
  agentsMdSectionHash: null,
  claudeMdHash: null,
  agentSkillsSha: null,
  installedSkillNames: []
};
async function readAiEnabledFromProjectConfig(projectDir) {
  const raw = await (0, import_utils.readFileSafe)(import_path.default.join(projectDir, "convex.json"));
  if (raw === null) return true;
  try {
    const parsed = aiFilesProjectConfigSchema.parse(JSON.parse(raw));
    if (parsed.aiFiles.enabled !== void 0) return parsed.aiFiles.enabled;
    return !(parsed.aiFiles.disableStalenessMessage ?? false);
  } catch (err) {
    Sentry.captureException(err);
    return true;
  }
}
async function writeAiEnabledToProjectConfig({
  projectDir,
  enabled
}) {
  const filePath = import_path.default.join(projectDir, "convex.json");
  const existing = await (0, import_utils.iife)(async () => {
    try {
      return JSON.parse(await import_fs.promises.readFile(filePath, "utf8"));
    } catch {
      return {};
    }
  });
  const base = existing !== null && typeof existing === "object" && !Array.isArray(existing) ? existing : {};
  const aiFilesValue = base.aiFiles !== null && typeof base.aiFiles === "object" && !Array.isArray(base.aiFiles) ? base.aiFiles : {};
  const { $schema, ...rest } = base;
  const { disableStalenessMessage: _legacy, ...restAiFiles } = aiFilesValue;
  const next = {
    $schema: $schema ?? "node_modules/convex/schemas/convex.schema.json",
    ...rest,
    aiFiles: { ...restAiFiles, enabled }
  };
  await import_fs.promises.writeFile(filePath, JSON.stringify(next, null, 2) + "\n", "utf8");
}
async function readAiConfig({
  projectDir,
  convexDir
}) {
  const enabled = await readAiEnabledFromProjectConfig(projectDir);
  const rawState = await (0, import_utils.readFileSafe)((0, import_paths.aiFilesStatePathForConvexDir)(convexDir));
  if (rawState === null) {
    return !enabled ? { ...EMPTY_AI_STATE, enabled } : null;
  }
  try {
    const state = aiFilesStateSchema.parse(JSON.parse(rawState));
    return { ...state, enabled };
  } catch (err) {
    Sentry.captureException(err);
    return null;
  }
}
async function hasAiFilesConfig({
  projectDir,
  convexDir
}) {
  if (!await readAiEnabledFromProjectConfig(projectDir)) {
    return true;
  }
  try {
    const rawState = await import_fs.promises.readFile(
      (0, import_paths.aiFilesStatePathForConvexDir)(convexDir),
      "utf8"
    );
    aiFilesStateSchema.parse(JSON.parse(rawState));
    return true;
  } catch (err) {
    if (err.code !== "ENOENT") {
      Sentry.captureException(err);
    }
    return false;
  }
}
async function writeAiConfig({
  config,
  projectDir,
  convexDir,
  options
}) {
  const state = aiFilesStateSchema.parse({
    guidelinesHash: config.guidelinesHash,
    agentsMdSectionHash: config.agentsMdSectionHash,
    claudeMdHash: config.claudeMdHash,
    agentSkillsSha: config.agentSkillsSha,
    installedSkillNames: config.installedSkillNames
  });
  await import_fs.promises.writeFile(
    (0, import_paths.aiFilesStatePathForConvexDir)(convexDir),
    JSON.stringify(state, null, 2) + "\n",
    "utf8"
  );
  const persistMode = options?.persistEnabledPreference ?? "ifFalse";
  if (persistMode === "always" || persistMode === "ifFalse" && !config.enabled)
    await writeAiEnabledToProjectConfig({
      projectDir,
      enabled: config.enabled
    });
}
//# sourceMappingURL=config.js.map

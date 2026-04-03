"use strict";
import { promises as fs } from "fs";
import { chalkStderr } from "chalk";
import { logMessage } from "../../../bundler/log.js";
import { downloadGuidelines } from "../versionApi.js";
import { hashSha256 } from "../utils/hash.js";
import { guidelinesPathForConvexDir } from "./paths.js";
import { readFileSafe } from "./utils.js";
export async function hasGuidelinesInstalled(convexDir) {
  return await readFileSafe(guidelinesPathForConvexDir(convexDir)) !== null;
}
export async function installGuidelinesFile({
  convexDir,
  config
}) {
  const guidelines = await downloadGuidelines();
  if (guidelines === null) {
    logMessage(
      chalkStderr.yellow(
        "Could not download Convex AI guidelines right now. You can retry with: npx convex ai-files install"
      )
    );
    return;
  }
  await fs.writeFile(guidelinesPathForConvexDir(convexDir), guidelines, "utf8");
  config.guidelinesHash = hashSha256(guidelines);
}
//# sourceMappingURL=guidelinesmd.js.map

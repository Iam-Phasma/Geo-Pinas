"use strict";
import { promises as fs } from "fs";
import { chalkStderr } from "chalk";
import { logMessage } from "../../../bundler/log.js";
import { hashSha256 } from "../utils/hash.js";
export function isInInteractiveTerminal() {
  return process.stdin.isTTY === true;
}
export async function readFileSafe(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }
}
export async function safelyDeleteFile(filePath) {
  try {
    await fs.unlink(filePath);
    return true;
  } catch {
    return false;
  }
}
export const iife = (fn) => fn();
export async function injectManagedSection(opts) {
  const { filePath, startMarker, endMarker, section } = opts;
  const existing = await readFileSafe(filePath) ?? "";
  const startIdx = existing.indexOf(startMarker);
  const endIdx = existing.indexOf(endMarker);
  const updated = iife(() => {
    if (startIdx !== -1 && endIdx !== -1)
      return existing.slice(0, startIdx) + section + existing.slice(endIdx + endMarker.length);
    if (existing.length > 0)
      return existing.trimEnd() + "\n\n" + section + "\n";
    return section + "\n";
  });
  const didWrite = updated !== existing;
  if (didWrite) await fs.writeFile(filePath, updated, "utf8");
  return { sectionHash: hashSha256(section), didWrite };
}
export async function stripManagedSection(opts) {
  const { filePath, startMarker, endMarker } = opts;
  const content = await readFileSafe(filePath);
  if (content === null) return "none";
  const startIdx = content.indexOf(startMarker);
  const endIdx = content.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1) {
    return "none";
  }
  const before = content.slice(0, startIdx).trimEnd();
  const after = content.slice(endIdx + endMarker.length).trimStart();
  const updated = [before, after].filter(Boolean).join("\n\n");
  if (!updated.trim()) {
    await safelyDeleteFile(filePath);
    return "file";
  }
  await fs.writeFile(filePath, updated + "\n", "utf8");
  return "section";
}
export async function removeMarkdownSection({
  projectDir,
  strip,
  fileName
}) {
  const result = await strip(projectDir);
  if (result === "section") {
    logMessage(
      `${chalkStderr.green("\u2714")} Removed Convex section from ${fileName}.`
    );
    return true;
  }
  if (result === "file") {
    logMessage(`${chalkStderr.green("\u2714")} Deleted ${fileName}.`);
    return true;
  }
  return false;
}
export async function hasManagedSection(opts) {
  const content = await readFileSafe(opts.filePath);
  return content !== null && content.includes(opts.startMarker) && content.includes(opts.endMarker);
}
//# sourceMappingURL=utils.js.map

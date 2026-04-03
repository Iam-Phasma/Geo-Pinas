import { Context } from "../../../bundler/context.js";
import { type AiFilesPaths } from "./paths.js";
/**
 * Install or refresh all Convex AI files.
 *
 * Reads the existing config if present, or starts from a blank one for a
 * fresh install. Each component can be individually skipped via the optional
 * flags (all default to true).
 */
export declare function installAiFiles({ projectDir, convexDir, shouldWriteGuidelines, shouldWriteAgentsMd, shouldWriteClaudeMd, shouldWriteSkills, }: AiFilesPaths & {
    shouldWriteGuidelines?: boolean;
    shouldWriteAgentsMd?: boolean;
    shouldWriteClaudeMd?: boolean;
    shouldWriteSkills?: boolean;
}): Promise<void>;
/**
 * Check whether the Convex AI files are out of date and log a nag message
 * if so.
 */
export declare function checkAiFilesStaleness(opts: {
    canonicalGuidelinesHash: string | null;
    canonicalAgentSkillsSha: string | null;
} & AiFilesPaths): Promise<void>;
export declare function enableAiFiles({ projectDir, convexDir, }: AiFilesPaths): Promise<void>;
/**
 * Remove all Convex AI files from the project.
 * Called by `npx convex ai-files remove`.
 */
export declare function removeAiFiles({ projectDir, convexDir, }: AiFilesPaths): Promise<void>;
/**
 * Called by `npx convex ai-files disable`.
 *
 * Writes a suppression flag into `convex.json` so `npx convex dev` stops
 * showing AI files install/staleness messages. Files are left in place.
 */
export declare function safelyAttemptToDisableAiFiles(projectDir: string): Promise<void>;
export declare function maybeSetupAiFiles({ ctx, convexDir, projectDir, }: {
    ctx: Context;
} & AiFilesPaths): Promise<void>;
//# sourceMappingURL=index.d.ts.map
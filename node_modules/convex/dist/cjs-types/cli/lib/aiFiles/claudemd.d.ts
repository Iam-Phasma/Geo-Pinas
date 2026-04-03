import { type AiFilesConfig } from "./config.js";
import { type InjectResult, type StripResult } from "./utils.js";
export declare function injectClaudeMdSection({ section, projectDir, }: {
    section: string;
    projectDir?: string;
}): Promise<InjectResult>;
export declare function stripClaudeMdSection(projectDir: string): Promise<StripResult>;
export declare function removeClaudeMdSection(projectDir: string): Promise<boolean>;
export declare function hasClaudeMdInstalled(projectDir: string): Promise<boolean>;
/**
 * Inject (or update) the Convex section in CLAUDE.md and record the hash.
 * Returns true if the file was actually written.
 */
export declare function applyClaudeMdSection({ projectDir, config, convexDirName, }: {
    projectDir: string;
    config: AiFilesConfig;
    convexDirName: string;
}): Promise<boolean>;
//# sourceMappingURL=claudemd.d.ts.map
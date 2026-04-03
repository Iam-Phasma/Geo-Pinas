import { type AiFilesConfig } from "./config.js";
/**
 * Install Convex agent skills and record the SHA and names into the config.
 * Handles the kill-switch check and all logging internally.
 */
export declare function installSkills({ projectDir, config, }: {
    projectDir: string;
    config: AiFilesConfig;
}): Promise<void>;
/**
 * Remove Convex-managed agent skills and clean up the lock file if empty.
 * Returns true if any removal occurred.
 */
export declare function removeInstalledSkills({ projectDir, skillNames, }: {
    projectDir: string;
    skillNames: string[];
}): Promise<boolean>;
//# sourceMappingURL=skills.d.ts.map
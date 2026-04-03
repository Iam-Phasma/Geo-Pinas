import { z } from "zod";
export declare const aiFilesStateSchema: z.ZodObject<{
    guidelinesHash: z.ZodNullable<z.ZodString>;
    agentsMdSectionHash: z.ZodNullable<z.ZodString>;
    claudeMdHash: z.ZodNullable<z.ZodString>;
    agentSkillsSha: z.ZodNullable<z.ZodString>;
    installedSkillNames: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    guidelinesHash: string | null;
    agentsMdSectionHash: string | null;
    claudeMdHash: string | null;
    agentSkillsSha: string | null;
    installedSkillNames: string[];
}, {
    guidelinesHash: string | null;
    agentsMdSectionHash: string | null;
    claudeMdHash: string | null;
    agentSkillsSha: string | null;
    installedSkillNames?: string[] | undefined;
}>;
type AiFilesState = z.infer<typeof aiFilesStateSchema>;
export type AiFilesConfig = AiFilesState & {
    enabled: boolean;
};
export declare function writeAiEnabledToProjectConfig({ projectDir, enabled, }: {
    projectDir: string;
    enabled: boolean;
}): Promise<void>;
export declare function readAiConfig({ projectDir, convexDir, }: {
    projectDir: string;
    convexDir: string;
}): Promise<AiFilesConfig | null>;
export declare function hasAiFilesConfig({ projectDir, convexDir, }: {
    projectDir: string;
    convexDir: string;
}): Promise<boolean>;
export declare function writeAiConfig({ config, projectDir, convexDir, options, }: {
    config: AiFilesConfig;
    projectDir: string;
    convexDir: string;
    options?: {
        persistEnabledPreference?: "ifFalse" | "always" | "never";
    };
}): Promise<void>;
export {};
//# sourceMappingURL=config.d.ts.map
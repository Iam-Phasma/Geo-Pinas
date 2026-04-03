export type VersionResult = {
    message: string | null;
    guidelinesHash: string | null;
    agentSkillsSha: string | null;
    disableSkillsCli: boolean;
};
export type VersionFetchResult = {
    kind: "ok";
    data: VersionResult;
} | {
    kind: "error";
};
export declare function getVersion(): Promise<VersionFetchResult>;
export declare function validateVersionResult(json: any): VersionResult | null;
/** Fetch the latest agent skills SHA from version.convex.dev. */
export declare function fetchAgentSkillsSha(): Promise<string | null>;
export declare function downloadGuidelines(): Promise<string | null>;
//# sourceMappingURL=versionApi.d.ts.map
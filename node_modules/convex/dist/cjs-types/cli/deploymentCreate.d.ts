import { Command } from "@commander-js/extra-typings";
import { Context } from "../bundler/context.js";
export declare const deploymentCreate: Command<[string | undefined], {
    type?: "dev" | "prod" | "preview";
    region?: string;
    select?: true;
    default?: true;
}, {}>;
export declare function fetchAvailableRegions(ctx: Context, teamId: number): Promise<{
    available: boolean;
    displayName: string;
    name: "aws-us-east-1" | "aws-eu-west-1";
}[]>;
type AvailableRegion = Awaited<ReturnType<typeof fetchAvailableRegions>>[number];
export declare function resolveRegionDetails(availableRegions: AvailableRegion[], region: string): {
    available: boolean;
    displayName: string;
    name: "aws-us-east-1" | "aws-eu-west-1";
} | null;
export {};
//# sourceMappingURL=deploymentCreate.d.ts.map
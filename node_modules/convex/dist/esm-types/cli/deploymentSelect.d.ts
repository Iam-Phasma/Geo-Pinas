import { Command } from "@commander-js/extra-typings";
import { Context } from "../bundler/context.js";
export declare const deploymentSelect: Command<[string], {}, {}>;
export declare function selectDeployment(ctx: Context, selector: string): Promise<void>;
//# sourceMappingURL=deploymentSelect.d.ts.map
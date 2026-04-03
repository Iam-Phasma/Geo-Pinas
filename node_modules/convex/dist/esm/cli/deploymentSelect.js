"use strict";
import { Command } from "@commander-js/extra-typings";
import { oneoffContext } from "../bundler/context.js";
import { loadSelectedDeploymentCredentials } from "./lib/api.js";
import {
  getDeploymentSelection,
  deploymentNameFromSelection
} from "./lib/deploymentSelection.js";
import { parseDeploymentSelector } from "./lib/deploymentSelector.js";
import { updateEnvAndConfigForDeploymentSelection } from "./configure.js";
import { fetchDeploymentCanonicalSiteUrl } from "./lib/env.js";
import { chalkStderr } from "chalk";
export const deploymentSelect = new Command("select").summary("Select the deployment to use when running commands").description(
  "Select the deployment to use when running commands.\n\nThe deployment will be used by all `npx convex` commands, except `npx convex deploy`. You can also run individual commands on another deployment by using the --deployment flag on that command.\n\nExamples:\n  npx convex select dev                              # Select your personal dev deployment in the current project\n  npx convex select dev/james                        # Select a deployment in the same project by its reference\n  npx convex select dev/james                        # Select a deployment in the same project by its reference\n  npx convex select some-project:dev/james           # Select a deployment in another project in the same team\n  npx convex select some-team:some-project:dev/james # Select a deployment in a particular team/project\n"
).argument("<deployment>", "The deployment to use").allowExcessArguments(false).action(async (selector) => {
  const ctx = await oneoffContext({
    url: void 0,
    adminKey: void 0,
    envFile: void 0
  });
  await selectDeployment(ctx, selector);
});
export async function selectDeployment(ctx, selector) {
  const currentSelection = await getDeploymentSelection(ctx, {});
  const parsed = parseDeploymentSelector(selector);
  if (currentSelection.kind === "chooseProject" && parsed.kind !== "inTeamProject" && parsed.kind !== "deploymentName") {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `No project configured. Run \`npx convex dev\` to set up a project first, or use a full selector like 'my-team:my-project:dev/james' or 'happy-capybara-123'.`
    });
  }
  const newSelection = await getDeploymentSelection(ctx, {
    url: void 0,
    adminKey: void 0,
    envFile: void 0,
    deployment: selector
  });
  const deployment = await loadSelectedDeploymentCredentials(
    ctx,
    newSelection,
    {
      ensureLocalRunning: false
    }
  );
  if (deployment.deploymentFields === null) {
    return ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: null,
      errForSentry: `Unexpected selection in select: ${JSON.stringify(deployment)}`
    });
  }
  if (deployment.deploymentFields.deploymentType === "prod") {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `Selecting a production deployment is unsupported. To run commands on a production deployment, pass the ${chalkStderr.bold(`--deployment ${selector}`)} flag to each command.`
    });
  }
  const siteUrl = await fetchDeploymentCanonicalSiteUrl(ctx, {
    adminKey: deployment.adminKey,
    deploymentUrl: deployment.url
  });
  await updateEnvAndConfigForDeploymentSelection(
    ctx,
    {
      url: deployment.url,
      siteUrl,
      deploymentName: deployment.deploymentFields.deploymentName,
      teamSlug: deployment.deploymentFields.teamSlug,
      projectSlug: deployment.deploymentFields.projectSlug,
      deploymentType: deployment.deploymentFields.deploymentType
    },
    deploymentNameFromSelection(currentSelection)
  );
}
//# sourceMappingURL=deploymentSelect.js.map

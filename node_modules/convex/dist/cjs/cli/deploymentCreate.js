"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var deploymentCreate_exports = {};
__export(deploymentCreate_exports, {
  deploymentCreate: () => deploymentCreate,
  fetchAvailableRegions: () => fetchAvailableRegions,
  resolveRegionDetails: () => resolveRegionDetails
});
module.exports = __toCommonJS(deploymentCreate_exports);
var import_extra_typings = require("@commander-js/extra-typings");
var import_context = require("../bundler/context.js");
var import_log = require("../bundler/log.js");
var import_deploymentSelection = require("./lib/deploymentSelection.js");
var import_utils = require("./lib/utils/utils.js");
var import_deployment = require("./lib/deployment.js");
var import_deploymentSelect = require("./deploymentSelect.js");
var import_prompts = require("./lib/utils/prompts.js");
var import_chalk = require("chalk");
var import_deploymentSelector = require("./lib/deploymentSelector.js");
const deploymentCreate = new import_extra_typings.Command("create").summary("Create a new cloud deployment for a project").description(
  "Create a new cloud deployment for a project.\n\n  Create a dev deployment and select it: `npx convex deployment create dev/my-new-feature --type dev --select`\n  Create a prod staging deployment:      `npx convex deployment create staging --type prod`\n"
).argument("[ref]").allowExcessArguments(false).addOption(
  new import_extra_typings.Option("--type <type>", "Deployment type").choices([
    "dev",
    "prod",
    "preview"
  ])
).option("--region <region>", "Deployment region").option(
  "--select",
  "Select the new deployment. This will update the Convex environment variables in .env.local and `npx convex dev` will run against this deployment."
).option(
  "--default",
  "Set the new deployment as your default development or production deployment."
).action(async (refParam, options) => {
  const ctx = await (0, import_context.oneoffContext)({
    url: void 0,
    adminKey: void 0,
    envFile: void 0
  });
  const { ref, regionDetails, projectId, type, isDefault } = process.stdin.isTTY ? await resolveOptionsInteractively(ctx, refParam, options) : await resolveOptionsNoninteractively(ctx, refParam, options);
  (0, import_log.showSpinner)(
    `Creating ${type} deployment` + (regionDetails ? ` in region ${regionDetails.displayName}` : "") + "..."
  );
  const created = (await (0, import_utils.typedPlatformClient)(ctx).POST(
    "/projects/{project_id}/create_deployment",
    {
      params: {
        path: { project_id: projectId }
      },
      body: {
        type,
        region: regionDetails?.name ?? null,
        reference: ref ?? null,
        isDefault
      }
    }
  )).data;
  if (created.kind !== "cloud") {
    const err = `Expected cloud deployment to be created but got ${created.kind}`;
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: err,
      errForSentry: err
    });
  }
  if (!options.select) {
    (0, import_log.logFinishedStep)(
      `Provisioned a ${created.isDefault ? "default " : ""}${created.deploymentType} deployment. Select this deployment to develop against using \`npx convex deployment select ${created.reference}\``
    );
    (0, import_log.logMessage)(
      import_chalk.chalkStderr.gray(
        "Hint: use `npx convex deployment create --select` to immediately select the newly created deployment."
      )
    );
  }
  if (options.select) {
    await (0, import_deploymentSelect.selectDeployment)(ctx, created.reference);
  }
});
async function resolveOptionsNoninteractively(ctx, refParam, options) {
  let ref;
  let teamAndProject;
  if (refParam) {
    const result = parseSelectorForNewDeployment(refParam);
    if (result.kind === "invalid") {
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: result.message
      });
    }
    ref = result.ref;
    teamAndProject = result.teamAndProject;
  }
  if (!ref && !options.default) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: "Specify a deployment ref or use --default:\n  `npx convex deployment create my-deployment-ref --type dev`\n  `npx convex deployment create --type prod --default`"
    });
  }
  if (!options.type) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: "--type is required. Use --type dev or --type prod."
    });
  }
  const project = teamAndProject ? await (0, import_deploymentSelection.getProjectDetails)(ctx, {
    kind: "teamAndProjectSlugs",
    teamSlug: teamAndProject.teamSlug,
    projectSlug: teamAndProject.projectSlug
  }) : await resolveProject(
    ctx,
    await (0, import_deploymentSelection.getDeploymentSelection)(ctx, {
      url: void 0,
      adminKey: void 0,
      envFile: void 0
    })
  );
  const projectId = project.id;
  let regionDetails = null;
  if (options.region) {
    const availableRegions = await fetchAvailableRegions(ctx, project.teamId);
    regionDetails = await resolveRegionDetailsOrCrash(
      ctx,
      availableRegions,
      options.region
    );
  }
  return {
    ref,
    isDefault: options.default ?? null,
    projectId,
    regionDetails,
    type: options.type
  };
}
async function resolveOptionsInteractively(ctx, refParam, options) {
  let deploymentType;
  if (options.type) {
    deploymentType = logAndUse("type", options.type);
  } else {
    const dtypeChoices = [
      {
        name: "dev",
        value: "dev"
      },
      {
        name: "preview",
        value: "preview"
      },
      {
        name: "prod",
        value: "prod"
      }
    ];
    deploymentType = await (0, import_prompts.promptOptions)(ctx, {
      message: "Deployment type?",
      choices: dtypeChoices
    });
  }
  let ref;
  let teamAndProject;
  if (refParam) {
    const result = parseSelectorForNewDeployment(refParam);
    if (result.kind === "invalid") {
      (0, import_log.logFailure)(result.message);
    } else {
      ref = logAndUse("ref", result.ref);
      teamAndProject = result.teamAndProject;
    }
  }
  while (ref === void 0) {
    const input = await (0, import_prompts.promptString)(ctx, { message: "Deployment ref?" });
    const result = parseSelectorForNewDeployment(input);
    if (result.kind === "invalid") {
      (0, import_log.logFailure)(result.message);
      continue;
    }
    ref = result.ref;
    teamAndProject = result.teamAndProject;
  }
  const project = teamAndProject ? await (0, import_deploymentSelection.getProjectDetails)(ctx, {
    kind: "teamAndProjectSlugs",
    teamSlug: teamAndProject.teamSlug,
    projectSlug: teamAndProject.projectSlug
  }) : await resolveProject(
    ctx,
    await (0, import_deploymentSelection.getDeploymentSelection)(ctx, {
      url: void 0,
      adminKey: void 0,
      envFile: void 0
    })
  );
  const availableRegions = await fetchAvailableRegions(ctx, project.teamId);
  let regionDetails;
  if (options.region) {
    regionDetails = await resolveRegionDetailsOrCrash(
      ctx,
      availableRegions,
      options.region
    );
    logAndUse("region", regionDetails.displayName);
  } else {
    const teams = (await (0, import_utils.typedBigBrainClient)(ctx).GET("/teams")).data;
    const team = teams.find((team2) => team2.slug === project.teamSlug);
    if (!team) {
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: `Error: Team ${project.teamSlug} not found.`
      });
    }
    const regionName = team.defaultRegion ?? await (0, import_utils.selectRegion)(ctx, team.id, deploymentType);
    regionDetails = await resolveRegionDetailsOrCrash(
      ctx,
      availableRegions,
      regionName
    );
    if (team.defaultRegion) {
      (0, import_log.logFinishedStep)(
        `Using team default region of ${regionDetails.displayName}`
      );
    } else {
      (0, import_utils.logNoDefaultRegionMessage)(team.slug);
    }
  }
  return {
    ref,
    isDefault: options.default ?? null,
    projectId: project.id,
    regionDetails,
    type: deploymentType
  };
}
function parseSelectorForNewDeployment(selectorString) {
  const selector = (0, import_deploymentSelector.parseDeploymentSelector)(selectorString);
  switch (selector.kind) {
    case "deploymentName":
      return {
        kind: "invalid",
        message: `"${selector.deploymentName}" is not a valid deployment reference. References cannot be in the format abc-xyz-123, as it is reserved for deployment names.`
      };
    case "inCurrentProject": {
      const inner = selector.selector;
      if (inner.kind === "dev") {
        return {
          kind: "invalid",
          message: `"dev" is not a valid deployment reference.`
        };
      }
      if (inner.kind === "prod") {
        return {
          kind: "invalid",
          message: `"prod" is not a valid deployment reference.`
        };
      }
      return { kind: "valid", ref: inner.reference };
    }
    case "inProject": {
      return {
        kind: "invalid",
        message: `Please use "team:project:ref" to specify the team when creating a new deployment in a different project.`
      };
    }
    case "inTeamProject": {
      const inner = selector.selector;
      if (inner.kind === "dev") {
        return {
          kind: "invalid",
          message: `"dev" is not a valid deployment reference.`
        };
      }
      if (inner.kind === "prod") {
        return {
          kind: "invalid",
          message: `"prod" is not a valid deployment reference.`
        };
      }
      return {
        kind: "valid",
        ref: inner.reference,
        teamAndProject: {
          teamSlug: selector.teamSlug,
          projectSlug: selector.projectSlug
        }
      };
    }
    default:
      selector;
      return {
        kind: "invalid",
        message: "Unknown state. This is a bug in Convex."
      };
  }
}
async function resolveProject(ctx, deploymentSelection) {
  switch (deploymentSelection.kind) {
    case "existingDeployment": {
      const { deploymentFields } = deploymentSelection.deploymentToActOn;
      if (deploymentFields) {
        return await (0, import_deploymentSelection.getProjectDetails)(ctx, {
          kind: "deploymentName",
          deploymentName: deploymentFields.deploymentName,
          deploymentType: null
        });
      }
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: "Cannot infer project from the current deployment configuration. Use `team:project:ref` to specify team and project slugs."
      });
    }
    case "deploymentWithinProject": {
      return await (0, import_deploymentSelection.getProjectDetails)(ctx, deploymentSelection.targetProject);
    }
    case "preview": {
      const slugs = await (0, import_deployment.getTeamAndProjectFromPreviewAdminKey)(
        ctx,
        deploymentSelection.previewDeployKey
      );
      return await (0, import_deploymentSelection.getProjectDetails)(ctx, {
        kind: "teamAndProjectSlugs",
        teamSlug: slugs.teamSlug,
        projectSlug: slugs.projectSlug
      });
    }
    case "chooseProject":
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: "No project configured yet. Use `team:project:ref` to specify team and project slugs."
      });
    case "anonymous":
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: "Cannot create a deployment in anonymous mode. Run `npx convex login` and configure a project first."
      });
    default: {
      deploymentSelection;
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: `Unexpected deployment selection kind.`
      });
    }
  }
}
const REGION_NAME_TO_ALIAS = {
  "aws-us-east-1": "us",
  "aws-eu-west-1": "eu"
};
const REGION_ALIAS_TO_NAME = Object.fromEntries(
  Object.entries(REGION_NAME_TO_ALIAS).map(([name, alias]) => [alias, name])
);
async function fetchAvailableRegions(ctx, teamId) {
  const regionsResponse = (await (0, import_utils.typedPlatformClient)(ctx).GET(
    "/teams/{team_id}/list_deployment_regions",
    {
      params: {
        path: { team_id: `${teamId}` }
      }
    }
  )).data;
  return regionsResponse.items.filter((item) => item.available);
}
function resolveRegionDetails(availableRegions, region) {
  const resolvedRegion = REGION_ALIAS_TO_NAME[region] ?? region;
  return availableRegions.find((item) => item.name === resolvedRegion) ?? null;
}
async function resolveRegionDetailsOrCrash(ctx, availableRegions, region) {
  const regionDetails = resolveRegionDetails(availableRegions, region);
  if (!regionDetails) {
    return await crashInvalidRegion(ctx, availableRegions, region);
  }
  return regionDetails;
}
function invalidRegionMessage(availableRegions, region) {
  const formatted = availableRegions.map(
    (item) => `    Use \`--region ${REGION_NAME_TO_ALIAS[item.name] ?? item.name}\` for ${item.displayName}`
  ).join("\n");
  return `Invalid region "${region}".

` + formatted;
}
async function crashInvalidRegion(ctx, availableRegions, region) {
  return await ctx.crash({
    exitCode: 1,
    errorType: "fatal",
    printedMessage: invalidRegionMessage(availableRegions, region)
  });
}
function logAndUse(label, value) {
  (0, import_log.logFinishedStep)(`Using ${label}: ${import_chalk.chalkStderr.bold(value)}`);
  return value;
}
//# sourceMappingURL=deploymentCreate.js.map

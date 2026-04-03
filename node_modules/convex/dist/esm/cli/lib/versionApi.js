"use strict";
import * as Sentry from "@sentry/node";
import { version } from "../version.js";
const VERSION_ENDPOINT = "https://version.convex.dev/v1/version";
const GUIDELINES_ENDPOINT = "https://version.convex.dev/v1/guidelines";
const HEADERS = {
  "Convex-Client": `npm-cli-${version}`,
  // Useful telemetry proxy for "human at a terminal" vs automated/background execution.
  "Convex-Interactive": process.stdin.isTTY === true ? "true" : "false"
};
if (process.env.CONVEX_AGENT_MODE) {
  HEADERS["Convex-Agent-Mode"] = process.env.CONVEX_AGENT_MODE;
}
export async function getVersion() {
  try {
    const req = await fetch(VERSION_ENDPOINT, {
      headers: HEADERS
    });
    if (!req.ok) {
      Sentry.captureException(
        new Error(`Failed to fetch version: status = ${req.status}`)
      );
      return { kind: "error" };
    }
    const json = await req.json();
    const result = validateVersionResult(json);
    if (result === null) return { kind: "error" };
    return { kind: "ok", data: result };
  } catch (error) {
    Sentry.captureException(error);
    return { kind: "error" };
  }
}
export function validateVersionResult(json) {
  if (typeof json !== "object" || json === null) {
    Sentry.captureMessage("Invalid version result", "error");
    return null;
  }
  if (typeof json.message !== "string" && json.message !== null) {
    Sentry.captureMessage("Invalid version.message result", "error");
    return null;
  }
  const agentSkillsSha = typeof json.agentSkillsSha === "string" ? json.agentSkillsSha : null;
  const guidelinesHash = typeof json.guidelinesHash === "string" ? json.guidelinesHash : null;
  const disableSkillsCli = json.disableSkillsCli === true;
  return {
    message: json.message,
    guidelinesHash,
    agentSkillsSha,
    disableSkillsCli
  };
}
export async function fetchAgentSkillsSha() {
  const versionData = await getVersion();
  if (versionData.kind === "error") return null;
  return versionData.data.agentSkillsSha;
}
export async function downloadGuidelines() {
  try {
    const req = await fetch(GUIDELINES_ENDPOINT, { headers: HEADERS });
    if (!req.ok) {
      Sentry.captureMessage(
        `Failed to fetch Convex guidelines: status = ${req.status}`
      );
      return null;
    }
    const text = await req.text();
    return text;
  } catch (error) {
    Sentry.captureException(error);
    return null;
  }
}
//# sourceMappingURL=versionApi.js.map

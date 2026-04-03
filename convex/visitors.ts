import { httpAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

export const trackVisit = httpAction(async (ctx, request) => {
  const origin = request.headers.get("Origin") ?? "";
  const allowed = origin === "https://iam-phasma.github.io";
  const count = allowed
    ? await ctx.runMutation(internal.visitors.increment)
    : null;
  return new Response(allowed ? JSON.stringify({ count }) : null, {
    status: allowed ? 200 : 403,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "https://iam-phasma.github.io",
      "Access-Control-Allow-Methods": "POST",
    },
  });
});

export const increment = internalMutation(async ({ db }) => {
  const row = await db.query("visitors").first();
  if (row === null) {
    await db.insert("visitors", { count: 1 });
    return 1;
  }
  const newCount = row.count + 1;
  await db.patch(row._id, { count: newCount });
  return newCount;
});

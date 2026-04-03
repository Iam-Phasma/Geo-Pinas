import { httpAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

export const trackVisit = httpAction(async (ctx) => {
  const count = await ctx.runMutation(internal.visitors.increment);
  return new Response(JSON.stringify({ count }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
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

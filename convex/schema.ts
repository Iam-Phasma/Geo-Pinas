import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  visitors: defineTable({
    count: v.number(),
  }),
  visitorIps: defineTable({
    ip: v.string(),
    lastVisit: v.number(),
  }).index("by_ip", ["ip"]),
});

import { httpRouter } from "convex/server";
import { trackVisit } from "./visitors";

const http = httpRouter();

// POST /track — increment visitor count and return the new total
http.route({
  path: "/track",
  method: "POST",
  handler: trackVisit,
});

export default http;

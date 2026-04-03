import { httpRouter } from "convex/server";
import { trackVisit } from "./visitors";

const http = httpRouter();

http.route({
  path: "/track",
  method: "POST",
  handler: trackVisit,
});

export default http;

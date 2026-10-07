import { Hono } from "hono";
import { duePauses, pauseSubscription, resumeSubscription } from "../lib/pauses.ts";
import { limitParam, readObject } from "../lib/http.ts";

// /pauses — admin key only, for the Render Workflow (../workflows) that runs
// pauses: it applies new ones and resumes those that are due, across apps.
const pauses = new Hono();

// GET /pauses/due?limit=100
pauses.get("/due", async (c) => c.json(await duePauses(limitParam(c, 100))));

// POST /pauses/apply  Body: { app_id, account_id, months, session_id?, reason? }
pauses.post("/apply", async (c) => {
  const { app_id, account_id, months, session_id, reason } = await readObject(c);
  const after = await pauseSubscription(app_id, account_id, { months, session_id, reason });
  return c.json({ app_id, account_id, subscription: after.subscription });
});

// POST /pauses/resume  Body: { app_id, account_id }
pauses.post("/resume", async (c) => {
  const { app_id, account_id } = await readObject(c);
  const after = await resumeSubscription(app_id, account_id);
  return c.json({ app_id, account_id, subscription: after.subscription });
});

export default pauses;

// Which URL the API registers with PayPal. Needs no database.
import { afterEach, expect, test } from "bun:test";

process.env.DATABASE_URL ||= "postgres://unused@localhost/unused"; // the client connects lazily

const { webhookUrl } = await import("../src/routes/paypal.ts");

const saved = { PUBLIC_API_URL: process.env.PUBLIC_API_URL, RENDER_EXTERNAL_URL: process.env.RENDER_EXTERNAL_URL };

function setEnv(env: { PUBLIC_API_URL?: string; RENDER_EXTERNAL_URL?: string }) {
  for (const key of ["PUBLIC_API_URL", "RENDER_EXTERNAL_URL"] as const) {
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }
}

afterEach(() => setEnv(saved));

test("uses PUBLIC_API_URL when it's set", () => {
  setEnv({ PUBLIC_API_URL: "https://api.example.com", RENDER_EXTERNAL_URL: "https://offersdk-api.onrender.com" });
  expect(webhookUrl("app_1")).toBe("https://api.example.com/paypal/webhooks/app_1");
});

test("falls back to the onrender.com URL Render sets", () => {
  setEnv({ RENDER_EXTERNAL_URL: "https://offersdk-api.onrender.com" });
  expect(webhookUrl("app_1")).toBe("https://offersdk-api.onrender.com/paypal/webhooks/app_1");
});

test("skips registration without a public HTTPS URL", () => {
  setEnv({});
  expect(webhookUrl("app_1")).toBeNull();
  setEnv({ PUBLIC_API_URL: "http://api.example.com" });
  expect(webhookUrl("app_1")).toBeNull();
  setEnv({ PUBLIC_API_URL: "https://localhost:6767" });
  expect(webhookUrl("app_1")).toBeNull();
});

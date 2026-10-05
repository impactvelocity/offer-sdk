import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { GET as catchAll } from "@/app/api/[...path]/route";
import { GET as health } from "@/app/api/health/route";
import { GET as getOffer } from "@/app/api/v1/offers/[id]/route";
import { GET as listOffers } from "@/app/api/v1/offers/route";
import { OfferClient } from "@/sdk";

const req = (path: string) => new NextRequest(new URL(path, "http://localhost"));
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe("api", () => {
  it("GET /api/health returns ok", async () => {
    const res = health();
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("ok");
  });

  it("GET /api/v1/offers lists offers", async () => {
    const res = await listOffers();
    expect(res.status).toBe(200);
    expect(Array.isArray((await res.json()).data)).toBe(true);
  });

  it("GET /api/v1/offers/:id returns an offer", async () => {
    const res = await getOffer(req("/api/v1/offers/welcome-10"), ctx("welcome-10"));
    expect(res.status).toBe(200);
    expect((await res.json()).data.id).toBe("welcome-10");
  });

  it("GET /api/v1/offers/:id returns 404 for unknown offers", async () => {
    const res = await getOffer(req("/api/v1/offers/nope"), ctx("nope"));
    expect(res.status).toBe(404);
  });

  it("unknown API routes return 404 JSON", async () => {
    const res = catchAll(req("/api/does-not-exist"));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/not found/i);
  });
});

describe("sdk client", () => {
  it("calls the API and unwraps data", async () => {
    const fetch = async (input: RequestInfo | URL) => {
      expect(String(input)).toBe("https://offers.example.com/api/v1/offers");
      return listOffers();
    };
    const client = new OfferClient({ baseUrl: "https://offers.example.com/", fetch });
    const offers = await client.listOffers();
    expect(offers.length).toBeGreaterThan(0);
  });

  it("throws OfferApiError on non-2xx", async () => {
    const fetch = async () => getOffer(req("/api/v1/offers/nope"), ctx("nope"));
    const client = new OfferClient({ fetch });
    await expect(client.getOffer("nope")).rejects.toMatchObject({ name: "OfferApiError", status: 404 });
  });
});

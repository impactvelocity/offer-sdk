"use server";

import { runSuite, type SuiteResult } from "@/lib/offer/suite";

export async function rakeTest(): Promise<SuiteResult> {
  return runSuite();
}

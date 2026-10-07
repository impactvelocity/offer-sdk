/** URL of the deployed offer-app (the dashboard). */
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:6768";

/** The open-source repo. */
export const GITHUB_URL = "https://github.com/impactvelocity/offer-sdk";

/** One-click Render Blueprint deploy of this repo (render.yaml at the root). */
export const RENDER_DEPLOY_URL = `https://render.com/deploy?repo=${GITHUB_URL}`;

/** The hackathon this project was built for. */
export const DEVPOST_URL = "https://paypalaihackathon.devpost.com/";

/** YouTube ID of the walkthrough video under the hero (the part after `v=` or `youtu.be/` in its URL). */
export const WALKTHROUGH_VIDEO_ID = "JXntWQaue1g";

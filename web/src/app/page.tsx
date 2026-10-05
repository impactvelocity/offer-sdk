import { APP_URL } from "@/lib/env";

const features = [
  { title: "Drop-in React SDK", body: "Wrap your app in <OfferProvider> and render offers with a single hook." },
  { title: "Hosted dashboard", body: "Create, schedule, and retire offers without shipping code." },
  { title: "API first", body: "Everything in the dashboard is available over a simple REST API." },
];

export default function LandingPage() {
  return (
    <div className="mx-auto max-w-5xl px-6">
      <section className="py-24 text-center sm:py-32">
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
          Offers for your app, in minutes.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-foreground/70 text-pretty">
          Add targeted offers to any React app with one provider and a hook. Manage them from a hosted
          dashboard.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <a
            href={APP_URL}
            className="rounded-full bg-foreground px-6 py-3 font-medium text-background hover:opacity-90"
          >
            Get started
          </a>
          <a href="#install" className="rounded-full border border-black/15 px-6 py-3 font-medium dark:border-white/15">
            Install the SDK
          </a>
        </div>
      </section>

      <section className="grid gap-6 pb-24 sm:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="rounded-2xl border border-black/10 p-6 dark:border-white/10">
            <h2 className="font-semibold">{f.title}</h2>
            <p className="mt-2 text-sm text-foreground/70">{f.body}</p>
          </div>
        ))}
      </section>

      <section id="install" className="pb-32">
        <h2 className="text-2xl font-semibold tracking-tight">Install</h2>
        <pre className="mt-4 overflow-x-auto rounded-2xl bg-black/5 p-6 font-mono text-sm dark:bg-white/5">
          {`npm install offer-sdk

import { OfferProvider, useOffers } from "offer-sdk";

<OfferProvider apiKey="pk_..." baseUrl="https://app.example.com">
  <App />
</OfferProvider>`}
        </pre>
      </section>
    </div>
  );
}

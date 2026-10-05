// Loads PayPal's JS SDK once per client id, kind and currency. Subscriptions and
// one-time orders need different `intent`s, so each gets its own namespace and
// both can live on one page.

export type PaypalKind = "subscription" | "order";

/** The part of PayPal's `Buttons` API the checkout uses. */
export interface PaypalButtons {
  render(container: HTMLElement): Promise<void>;
  close?(): Promise<void>;
  isEligible?(): boolean;
}

export interface PaypalNamespace {
  Buttons(options: Record<string, unknown>): PaypalButtons;
}

const loading = new Map<string, Promise<PaypalNamespace>>();

export function loadPaypal(clientId: string, kind: PaypalKind, currency: string): Promise<PaypalNamespace> {
  const namespace = `paypal_offer_${kind}_${currency.toLowerCase()}`;
  const key = `${clientId}:${namespace}`;
  const existing = loading.get(key);
  if (existing) return existing;

  const params = new URLSearchParams({ "client-id": clientId, components: "buttons", currency });
  if (kind === "subscription") {
    params.set("intent", "subscription");
    params.set("vault", "true");
  } else {
    params.set("intent", "capture");
  }

  const promise = new Promise<PaypalNamespace>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?${params}`;
    script.async = true;
    script.dataset.namespace = namespace;
    script.onload = () => {
      const paypal = (window as unknown as Record<string, PaypalNamespace | undefined>)[namespace];
      if (paypal) resolve(paypal);
      else reject(new Error("PayPal didn't load"));
    };
    script.onerror = () => {
      loading.delete(key);
      reject(new Error("Couldn't reach PayPal"));
    };
    document.head.appendChild(script);
  });
  loading.set(key, promise);
  return promise;
}

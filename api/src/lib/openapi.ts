const spec = {
  openapi: "3.1.0",
  info: {
    title: "Offer API",
    version: "1.0.0",
    description:
      "Entitlement, usage, and plan management API. Per-app routes require a Bearer app API key. Org routes require the admin Bearer key.",
  },
  security: [{ BearerAuth: [] }],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        description: "App API key returned on app creation or regeneration.",
      },
      AdminAuth: {
        type: "http",
        scheme: "bearer",
        description: "Admin API key (ADMIN_API_KEY env var). Required for org routes.",
      },
      PublicAuth: {
        type: "http",
        scheme: "bearer",
        description: "App public key (`pub_...`) returned on app creation, safe to ship to browsers. Valid for GET /namespaces/:namespaceId/plan, reading usage, adding usage (/add, or /amount with a non-negative amount), GET pricing, and the checkout routes.",
      },
    },
    schemas: {
      App: {
        type: "object",
        properties: {
          id: { type: "string", example: "app_abc123" },
          name: { type: "string", example: "My SaaS" },
          plan: { type: "string", example: "pro" },
          api_key: { type: "string", example: "key_..." },
          public_key: { type: "string", example: "pub_...", description: "Read-only key for fetching namespace plan state from the frontend." },
          created_at: { type: "string", format: "date-time" },
        },
      },
      Plan: {
        type: "object",
        properties: {
          id: { type: "string", example: "pro" },
          app_id: { type: "string" },
          name: { type: "string", example: "Pro" },
          description: { type: "string" },
          note: { type: "string", nullable: true, description: "Internal plain-text note about this plan." },
          isFree: { type: "boolean", example: false },
          pricingCard: {
            nullable: true,
            type: "object",
            properties: {
              title: { type: "string", example: "Pro" },
              description: { type: "string", example: "For growing teams" },
              benefits: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", example: "unlimited_seats" },
                    title: { type: "string", example: "Unlimited seats" },
                  },
                },
              },
              featured: { type: "boolean", example: true },
              type: { type: "string", enum: ["subscription", "one_time"], example: "subscription" },
              monthlyPrice: { type: "number", nullable: true, example: 29, description: "Monthly price. Used when type is subscription." },
              yearlyPrice: { type: "number", nullable: true, example: 290, description: "Yearly price. Used when type is subscription." },
              price: { type: "number", nullable: true, example: 499, description: "Price. Used when type is one_time." },
              currency: { type: "string", example: "USD", description: "ISO 4217 currency code." },
            },
          },
          entitlements: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string", example: "contacts" },
                max: { type: "number", nullable: true, example: 1000 },
              },
            },
          },
          addons: { type: "array", items: { type: "string" } },
          meta: { type: "object", additionalProperties: true },
          privateMetaKeys: { type: "array", items: { type: "string" }, description: "Keys in `meta` that are hidden from the public /plan response." },
          created_at: { type: "string", format: "date-time" },
        },
      },
      Entitlement: {
        type: "object",
        properties: {
          id: { type: "string", example: "contacts" },
          app_id: { type: "string" },
          type: { type: "string", enum: ["usage", "boolean"] },
          name: { type: "string", example: "Contacts" },
          description: { type: "string" },
          created_at: { type: "string", format: "date-time" },
        },
      },
      Addon: {
        type: "object",
        properties: {
          id: { type: "string", example: "extra-storage" },
          app_id: { type: "string" },
          name: { type: "string", example: "Extra Storage" },
          description: { type: "string" },
          created_at: { type: "string", format: "date-time" },
        },
      },
      Incentive: {
        type: "object",
        properties: {
          id: { type: "string", example: "summer-promo" },
          app_id: { type: "string" },
          name: { type: "string", example: "Summer Promo" },
          description: { type: "string" },
          entitlements: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                max: { type: "number", nullable: true },
              },
            },
          },
          addons: { type: "array", items: { type: "string" } },
          created_at: { type: "string", format: "date-time" },
        },
      },
      Namespace: {
        type: "object",
        properties: {
          id: { type: "string", example: "user_abc" },
          app_id: { type: "string" },
          name: { type: "string" },
          plan: { type: "string", example: "pro" },
          incentive: { type: "string", nullable: true, example: "summer-promo" },
          created_at: { type: "string", format: "date-time" },
        },
      },
      NamespacePlanSummary: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          description: { type: "string", nullable: true },
          meta: { type: "object", additionalProperties: true, description: "Plan meta. Keys listed in `privateMetaKeys` are omitted on the public /plan route." },
        },
      },
      NamespacePlan: {
        type: "object",
        properties: {
          plan: { $ref: "#/components/schemas/NamespacePlanSummary" },
          incentive: { type: "string", nullable: true },
          addons: { type: "array", items: { type: "string" } },
          entitlements: {
            type: "array",
            items: {
              type: "object",
              properties: {
                feature: { type: "string", example: "contacts" },
                name: { type: "string", example: "Contacts" },
                type: { type: "string", enum: ["usage", "boolean"] },
                usage: { type: "number", example: 42 },
                max: { type: "number", nullable: true, example: 1000 },
                left: { type: "number", nullable: true, example: 958 },
                can: { type: "boolean", example: true },
              },
            },
          },
        },
      },
      Org: {
        type: "object",
        properties: {
          id: { type: "string", example: "acme" },
          app_ids: { type: "array", items: { type: "string" }, example: ["app_abc123", "app_def456"] },
          created_at: { type: "string", format: "date-time" },
        },
      },
      WebhookEndpoint: {
        type: "object",
        properties: {
          id: { type: "string", example: "whk_AbCdEfGhIjKlMnOp" },
          app_id: { type: "string" },
          url: { type: "string", example: "https://example.com/webhooks/offer" },
          description: { type: "string", nullable: true },
          events: { type: "array", items: { type: "string" }, example: ["account.created", "usage.limit_reached"], description: 'Event types, or `["*"]` for every event.' },
          enabled: { type: "boolean" },
          source: { type: "string", enum: ["custom", "zapier"] },
          secret: { type: "string", example: "whsec_...", description: "Signing secret (Standard Webhooks)." },
          disabled_reason: { type: "string", nullable: true, example: "Endpoint returned 410 Gone" },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
          stats: {
            type: "object",
            description: "Counts cover deliveries created in the last 7 days; `last_*` the latest delivery overall. Test deliveries are excluded.",
            properties: {
              total: { type: "integer" },
              succeeded: { type: "integer" },
              failed: { type: "integer" },
              pending: { type: "integer" },
              last_delivery_at: { type: "string", format: "date-time", nullable: true },
              last_status: { type: "string", enum: ["pending", "succeeded", "failed"], nullable: true },
              last_response_status: { type: "integer", nullable: true },
            },
          },
        },
      },
      WebhookEvent: {
        type: "object",
        description: "The exact JSON body POSTed to endpoints.",
        properties: {
          id: { type: "string", example: "evt_..." },
          type: { type: "string", example: "account.plan_changed" },
          created_at: { type: "string", format: "date-time" },
          app_id: { type: "string" },
          data: {
            type: "object",
            properties: {
              object: { type: "object", additionalProperties: true },
              previous: { type: "object", additionalProperties: true, description: "Old values of changed fields (update events)." },
            },
          },
          test: { type: "boolean", description: "Only present (true) on test deliveries." },
        },
      },
      WebhookDelivery: {
        type: "object",
        properties: {
          id: { type: "string", example: "whd_..." },
          endpoint_id: { type: "string" },
          event_id: { type: "string" },
          event_type: { type: "string" },
          status: { type: "string", enum: ["pending", "succeeded", "failed"] },
          attempts: { type: "integer" },
          next_attempt_at: { type: "string", format: "date-time", nullable: true },
          last_attempt_at: { type: "string", format: "date-time", nullable: true },
          response_status: { type: "integer", nullable: true },
          response_body: { type: "string", nullable: true, description: "First 1024 characters." },
          error: { type: "string", nullable: true, example: "HTTP 500" },
          duration_ms: { type: "integer", nullable: true },
          test: { type: "boolean" },
          created_at: { type: "string", format: "date-time" },
          payload: { $ref: "#/components/schemas/WebhookEvent" },
        },
      },
      Error: {
        type: "object",
        properties: { error: { type: "string" } },
      },
    },
  },
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        description: "Returns `{ ok: true }` when the API can reach Postgres.",
        security: [],
        responses: { "200": { description: "Healthy" } },
      },
    },

    // ─── Apps ──────────────────────────────────────────────
    "/apps": {
      post: {
        tags: ["Apps"],
        summary: "Create an app",
        description: "Requires the admin key (`ADMIN_API_KEY`).",
        security: [{ AdminAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: {
                  name: { type: "string" },
                  plan: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "App created", content: { "application/json": { schema: { $ref: "#/components/schemas/App" } } } },
        },
      },
    },
    "/apps/{appId}": {
      get: {
        tags: ["Apps"],
        summary: "Get an app",
        parameters: [{ name: "appId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/App" } } } },
          "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      patch: {
        tags: ["Apps"],
        summary: "Update an app",
        parameters: [{ name: "appId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", properties: { name: { type: "string" }, plan: { type: "string" } } } } },
        },
        responses: {
          "200": { description: "Updated", content: { "application/json": { schema: { $ref: "#/components/schemas/App" } } } },
          "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      delete: {
        tags: ["Apps"],
        summary: "Delete an app",
        parameters: [{ name: "appId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Deleted" },
          "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/apps/{appId}/public-key/regenerate": {
      post: {
        tags: ["Apps"],
        summary: "Regenerate app public key",
        parameters: [{ name: "appId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "New public key", content: { "application/json": { schema: { type: "object", properties: { public_key: { type: "string" } } } } } },
          "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/apps/{appId}/keys/regenerate": {
      post: {
        tags: ["Apps"],
        summary: "Regenerate app API key",
        parameters: [{ name: "appId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "New key", content: { "application/json": { schema: { type: "object", properties: { api_key: { type: "string" } } } } } },
          "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },

    // ─── Plans ─────────────────────────────────────────────
    "/apps/{appId}/plans": {
      get: {
        tags: ["Plans"],
        summary: "List plans",
        parameters: [{ name: "appId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Plan" } } } } },
        },
      },
      post: {
        tags: ["Plans"],
        summary: "Create a plan",
        parameters: [{ name: "appId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["id", "name"],
                properties: {
                  id: { type: "string", example: "pro" },
                  name: { type: "string" },
                  description: { type: "string" },
                  note: { type: "string", description: "Internal plain-text note." },
                  pricingCard: { type: "object", description: "Pricing page card data.", properties: { title: { type: "string" }, description: { type: "string" }, benefits: { type: "array", items: { type: "object", properties: { id: { type: "string" }, title: { type: "string" } } } }, featured: { type: "boolean" } } },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Created", content: { "application/json": { schema: { $ref: "#/components/schemas/Plan" } } } },
          "409": { description: "Conflict", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/apps/{appId}/plans/pricing": {
      get: {
        tags: ["Plans"],
        summary: "Get pricing cards for all plans",
        description: "Returns the `pricingCard` for every plan that has one set. Useful for rendering a public pricing page. Accepts the app `public_key`.",
        security: [{ BearerAuth: [] }, { PublicAuth: [] }],
        parameters: [{ name: "appId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      plan_id: { type: "string" },
                      title: { type: "string" },
                      description: { type: "string" },
                      benefits: { type: "array", items: { type: "object", properties: { id: { type: "string" }, title: { type: "string" } } } },
                      featured: { type: "boolean" },
                      type: { type: "string", enum: ["subscription", "one_time"] },
                      monthlyPrice: { type: "number", nullable: true },
                      yearlyPrice: { type: "number", nullable: true },
                      price: { type: "number", nullable: true },
                      currency: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/apps/{appId}/plans/{planId}": {
      get: {
        tags: ["Plans"],
        summary: "Get a plan",
        parameters: [
          { name: "appId", in: "path", required: true, schema: { type: "string" } },
          { name: "planId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/Plan" } } } },
          "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      patch: {
        tags: ["Plans"],
        summary: "Update a plan",
        parameters: [
          { name: "appId", in: "path", required: true, schema: { type: "string" } },
          { name: "planId", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  note: { type: "string", nullable: true, description: "Internal plain-text note." },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Updated", content: { "application/json": { schema: { $ref: "#/components/schemas/Plan" } } } },
          "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      delete: {
        tags: ["Plans"],
        summary: "Delete a plan",
        parameters: [
          { name: "appId", in: "path", required: true, schema: { type: "string" } },
          { name: "planId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Deleted" },
          "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/apps/{appId}/plans/{planId}/pricing": {
      get: {
        tags: ["Plans"],
        summary: "Get pricing card for a plan",
        security: [{ BearerAuth: [] }, { PublicAuth: [] }],
        parameters: [
          { name: "appId", in: "path", required: true, schema: { type: "string" } },
          { name: "planId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/Plan/properties/pricingCard" } } } },
          "404": { description: "Plan or pricing card not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/apps/{appId}/plans/{planId}/namespaces": {
      get: {
        tags: ["Plans"],
        summary: "List namespaces on a plan",
        description: "Returns id and name for every namespace currently on this plan, paginated.",
        parameters: [
          { name: "appId", in: "path", required: true, schema: { type: "string" } },
          { name: "planId", in: "path", required: true, schema: { type: "string" } },
          { name: "page", in: "query", required: false, schema: { type: "integer", default: 1 } },
          { name: "per_page", in: "query", required: false, schema: { type: "integer", default: 20, maximum: 100 } },
        ],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          name: { type: "string" },
                        },
                      },
                    },
                    total: { type: "integer", description: "Total matching namespaces before pagination." },
                    page: { type: "integer" },
                    per_page: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/apps/{appId}/plans/{planId}/meta": {
      patch: {
        tags: ["Plans"],
        summary: "Update plan meta",
        description: "Merges the provided key/value pairs into the plan's `meta` object. Existing keys not in the body are preserved.",
        parameters: [
          { name: "appId", in: "path", required: true, schema: { type: "string" } },
          { name: "planId", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", additionalProperties: true } } },
        },
        responses: {
          "200": { description: "Updated", content: { "application/json": { schema: { $ref: "#/components/schemas/Plan" } } } },
          "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/apps/{appId}/plans/{planId}/entitlements": {
      post: {
        tags: ["Plans"],
        summary: "Add entitlement to plan",
        parameters: [
          { name: "appId", in: "path", required: true, schema: { type: "string" } },
          { name: "planId", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["id"],
                properties: {
                  id: { type: "string" },
                  max: { type: "number", nullable: true, description: "Usage cap. Only applies to usage-type entitlements." },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Updated plan", content: { "application/json": { schema: { $ref: "#/components/schemas/Plan" } } } },
          "404": { description: "Plan or entitlement not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "409": { description: "Entitlement already on plan", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/apps/{appId}/plans/{planId}/entitlements/{entitlementId}": {
      patch: {
        tags: ["Plans"],
        summary: "Update entitlement on plan",
        parameters: [
          { name: "appId", in: "path", required: true, schema: { type: "string" } },
          { name: "planId", in: "path", required: true, schema: { type: "string" } },
          { name: "entitlementId", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", properties: { max: { type: "number", nullable: true } } } } },
        },
        responses: {
          "200": { description: "Updated plan", content: { "application/json": { schema: { $ref: "#/components/schemas/Plan" } } } },
          "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      delete: {
        tags: ["Plans"],
        summary: "Remove entitlement from plan",
        parameters: [
          { name: "appId", in: "path", required: true, schema: { type: "string" } },
          { name: "planId", in: "path", required: true, schema: { type: "string" } },
          { name: "entitlementId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Updated plan", content: { "application/json": { schema: { $ref: "#/components/schemas/Plan" } } } },
          "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/apps/{appId}/plans/{planId}/addons": {
      post: {
        tags: ["Plans"],
        summary: "Add addon to plan",
        parameters: [
          { name: "appId", in: "path", required: true, schema: { type: "string" } },
          { name: "planId", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["id"], properties: { id: { type: "string" } } } } },
        },
        responses: {
          "200": { description: "Updated plan", content: { "application/json": { schema: { $ref: "#/components/schemas/Plan" } } } },
          "404": { description: "Plan or addon not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "409": { description: "Addon already on plan", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/apps/{appId}/plans/{planId}/addons/{addonId}": {
      delete: {
        tags: ["Plans"],
        summary: "Remove addon from plan",
        parameters: [
          { name: "appId", in: "path", required: true, schema: { type: "string" } },
          { name: "planId", in: "path", required: true, schema: { type: "string" } },
          { name: "addonId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Updated plan", content: { "application/json": { schema: { $ref: "#/components/schemas/Plan" } } } },
          "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },

    // ─── Entitlements ──────────────────────────────────────
    "/apps/{appId}/entitlements": {
      get: {
        tags: ["Entitlements"],
        summary: "List entitlements",
        parameters: [{ name: "appId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Entitlement" } } } } },
        },
      },
      post: {
        tags: ["Entitlements"],
        summary: "Create an entitlement",
        parameters: [{ name: "appId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["id", "type", "name"],
                properties: {
                  id: { type: "string", example: "contacts" },
                  type: { type: "string", enum: ["usage", "boolean"] },
                  name: { type: "string" },
                  description: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Created", content: { "application/json": { schema: { $ref: "#/components/schemas/Entitlement" } } } },
          "400": { description: "Invalid type", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "409": { description: "Conflict", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/apps/{appId}/entitlements/{entitlementId}": {
      get: {
        tags: ["Entitlements"],
        summary: "Get an entitlement",
        parameters: [
          { name: "appId", in: "path", required: true, schema: { type: "string" } },
          { name: "entitlementId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/Entitlement" } } } },
          "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      patch: {
        tags: ["Entitlements"],
        summary: "Update an entitlement",
        parameters: [
          { name: "appId", in: "path", required: true, schema: { type: "string" } },
          { name: "entitlementId", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  type: { type: "string", enum: ["usage", "boolean"] },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Updated", content: { "application/json": { schema: { $ref: "#/components/schemas/Entitlement" } } } },
          "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      delete: {
        tags: ["Entitlements"],
        summary: "Delete an entitlement",
        parameters: [
          { name: "appId", in: "path", required: true, schema: { type: "string" } },
          { name: "entitlementId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Deleted" },
          "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },

    // ─── Addons ────────────────────────────────────────────
    "/apps/{appId}/addons": {
      get: {
        tags: ["Addons"],
        summary: "List addons",
        parameters: [{ name: "appId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Addon" } } } } },
        },
      },
      post: {
        tags: ["Addons"],
        summary: "Create an addon",
        parameters: [{ name: "appId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["id", "name"],
                properties: {
                  id: { type: "string", example: "extra-storage" },
                  name: { type: "string" },
                  description: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Created", content: { "application/json": { schema: { $ref: "#/components/schemas/Addon" } } } },
          "409": { description: "Conflict", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/apps/{appId}/addons/{addonId}": {
      get: {
        tags: ["Addons"],
        summary: "Get an addon",
        parameters: [
          { name: "appId", in: "path", required: true, schema: { type: "string" } },
          { name: "addonId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/Addon" } } } },
          "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      patch: {
        tags: ["Addons"],
        summary: "Update an addon",
        parameters: [
          { name: "appId", in: "path", required: true, schema: { type: "string" } },
          { name: "addonId", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Updated", content: { "application/json": { schema: { $ref: "#/components/schemas/Addon" } } } },
          "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      delete: {
        tags: ["Addons"],
        summary: "Delete an addon",
        parameters: [
          { name: "appId", in: "path", required: true, schema: { type: "string" } },
          { name: "addonId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Deleted" },
          "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },

    // ─── Incentives ────────────────────────────────────────
    "/apps/{appId}/incentives": {
      get: {
        tags: ["Incentives"],
        summary: "List incentives",
        parameters: [{ name: "appId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Incentive" } } } } },
        },
      },
      post: {
        tags: ["Incentives"],
        summary: "Create an incentive",
        parameters: [{ name: "appId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["id", "name"],
                properties: {
                  id: { type: "string", example: "summer-promo" },
                  name: { type: "string" },
                  description: { type: "string" },
                  entitlements: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        max: { type: "number", nullable: true },
                      },
                    },
                  },
                  addons: { type: "array", items: { type: "string" } },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Created", content: { "application/json": { schema: { $ref: "#/components/schemas/Incentive" } } } },
          "409": { description: "Conflict", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/apps/{appId}/incentives/{incentiveId}": {
      get: {
        tags: ["Incentives"],
        summary: "Get an incentive",
        parameters: [
          { name: "appId", in: "path", required: true, schema: { type: "string" } },
          { name: "incentiveId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/Incentive" } } } },
          "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      patch: {
        tags: ["Incentives"],
        summary: "Update an incentive",
        parameters: [
          { name: "appId", in: "path", required: true, schema: { type: "string" } },
          { name: "incentiveId", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Updated", content: { "application/json": { schema: { $ref: "#/components/schemas/Incentive" } } } },
          "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      delete: {
        tags: ["Incentives"],
        summary: "Delete an incentive",
        parameters: [
          { name: "appId", in: "path", required: true, schema: { type: "string" } },
          { name: "incentiveId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Deleted" },
          "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/apps/{appId}/incentives/{incentiveId}/entitlements": {
      post: {
        tags: ["Incentives"],
        summary: "Add entitlement to incentive",
        parameters: [
          { name: "appId", in: "path", required: true, schema: { type: "string" } },
          { name: "incentiveId", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["id"], properties: { id: { type: "string" }, max: { type: "number", nullable: true } } } } },
        },
        responses: {
          "200": { description: "Updated incentive", content: { "application/json": { schema: { $ref: "#/components/schemas/Incentive" } } } },
          "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "409": { description: "Already on incentive", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/apps/{appId}/incentives/{incentiveId}/entitlements/{entitlementId}": {
      patch: {
        tags: ["Incentives"],
        summary: "Update entitlement on incentive",
        parameters: [
          { name: "appId", in: "path", required: true, schema: { type: "string" } },
          { name: "incentiveId", in: "path", required: true, schema: { type: "string" } },
          { name: "entitlementId", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", properties: { max: { type: "number", nullable: true } } } } },
        },
        responses: {
          "200": { description: "Updated incentive", content: { "application/json": { schema: { $ref: "#/components/schemas/Incentive" } } } },
          "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      delete: {
        tags: ["Incentives"],
        summary: "Remove entitlement from incentive",
        parameters: [
          { name: "appId", in: "path", required: true, schema: { type: "string" } },
          { name: "incentiveId", in: "path", required: true, schema: { type: "string" } },
          { name: "entitlementId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Updated incentive", content: { "application/json": { schema: { $ref: "#/components/schemas/Incentive" } } } },
          "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/apps/{appId}/incentives/{incentiveId}/addons": {
      post: {
        tags: ["Incentives"],
        summary: "Add addon to incentive",
        parameters: [
          { name: "appId", in: "path", required: true, schema: { type: "string" } },
          { name: "incentiveId", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["id"], properties: { id: { type: "string" } } } } },
        },
        responses: {
          "200": { description: "Updated incentive", content: { "application/json": { schema: { $ref: "#/components/schemas/Incentive" } } } },
          "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "409": { description: "Already on incentive", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/apps/{appId}/incentives/{incentiveId}/addons/{addonId}": {
      delete: {
        tags: ["Incentives"],
        summary: "Remove addon from incentive",
        parameters: [
          { name: "appId", in: "path", required: true, schema: { type: "string" } },
          { name: "incentiveId", in: "path", required: true, schema: { type: "string" } },
          { name: "addonId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Updated incentive", content: { "application/json": { schema: { $ref: "#/components/schemas/Incentive" } } } },
          "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },

    // ─── Namespaces ────────────────────────────────────────
    "/apps/{appId}/namespaces": {
      get: {
        tags: ["Namespaces"],
        summary: "List namespaces",
        parameters: [
          { name: "appId", in: "path", required: true, schema: { type: "string" } },
          { name: "q", in: "query", required: false, schema: { type: "string" }, description: "Text search query. Use * for all." },
          { name: "page", in: "query", required: false, schema: { type: "integer", default: 1 } },
          { name: "per_page", in: "query", required: false, schema: { type: "integer", default: 20, maximum: 100 } },
          { name: "plan", in: "query", required: false, schema: { type: "string" }, description: "Filter by plan id." },
          { name: "has_incentive", in: "query", required: false, schema: { type: "boolean" }, description: "Filter to namespaces with an incentive." },
          { name: "incentive", in: "query", required: false, schema: { type: "string" }, description: "Filter by specific incentive id." },
        ],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { type: "array", items: { $ref: "#/components/schemas/Namespace" } },
                    total: { type: "integer" },
                    page: { type: "integer" },
                    per_page: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Namespaces"],
        summary: "Create a namespace",

        parameters: [{ name: "appId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["id", "name", "plan"],
                properties: {
                  id: { type: "string", example: "user_abc" },
                  name: { type: "string" },
                  plan: { type: "string", example: "pro" },
                  incentive: { type: "string", nullable: true, example: "summer-promo" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Created", content: { "application/json": { schema: { $ref: "#/components/schemas/Namespace" } } } },
          "404": { description: "App or plan not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "409": { description: "Conflict", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/apps/{appId}/namespaces/count": {
      get: {
        tags: ["Namespaces"],
        summary: "Get total namespace count for an app",
        parameters: [{ name: "appId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: { type: "object", properties: { count: { type: "integer" } } },
              },
            },
          },
        },
      },
    },
    "/apps/{appId}/namespaces/with-incentive": {
      get: {
        tags: ["Namespaces"],
        summary: "List namespaces that have an incentive",
        parameters: [
          { name: "appId", in: "path", required: true, schema: { type: "string" } },
          { name: "incentive", in: "query", required: false, schema: { type: "string" }, description: "Filter by a specific incentive id." },
          { name: "page", in: "query", required: false, schema: { type: "integer", default: 1 } },
          { name: "per_page", in: "query", required: false, schema: { type: "integer", default: 20, maximum: 100 } },
        ],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { type: "array", items: { $ref: "#/components/schemas/Namespace" } },
                    total: { type: "integer" },
                    page: { type: "integer" },
                    per_page: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/apps/{appId}/namespaces/{namespaceId}": {
      get: {
        tags: ["Namespaces"],
        summary: "Get a namespace",
        parameters: [
          { name: "appId", in: "path", required: true, schema: { type: "string" } },
          { name: "namespaceId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/Namespace" } } } },
          "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      patch: {
        tags: ["Namespaces"],
        summary: "Update a namespace",
        parameters: [
          { name: "appId", in: "path", required: true, schema: { type: "string" } },
          { name: "namespaceId", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  plan: { type: "string" },
                  incentive: { type: "string", nullable: true },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Updated", content: { "application/json": { schema: { $ref: "#/components/schemas/Namespace" } } } },
          "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      delete: {
        tags: ["Namespaces"],
        summary: "Delete a namespace",
        parameters: [
          { name: "appId", in: "path", required: true, schema: { type: "string" } },
          { name: "namespaceId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Deleted" },
          "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/apps/{appId}/namespaces/{namespaceId}/incentive": {
      delete: {
        tags: ["Namespaces"],
        summary: "Remove incentive from namespace",
        parameters: [
          { name: "appId", in: "path", required: true, schema: { type: "string" } },
          { name: "namespaceId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Updated namespace", content: { "application/json": { schema: { $ref: "#/components/schemas/Namespace" } } } },
          "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/apps/{appId}/namespaces/{namespaceId}/plan": {
      get: {
        tags: ["Namespaces"],
        summary: "Get resolved plan state for a namespace",
        description: "Returns the namespace's plan with live usage counts per entitlement. Meta keys listed in the plan's `privateMetaKeys` are stripped. Accepts the app `public_key` as a Bearer token for frontend use.",
        security: [{ BearerAuth: [] }, { PublicAuth: [] }],
        parameters: [
          { name: "appId", in: "path", required: true, schema: { type: "string" } },
          { name: "namespaceId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/NamespacePlan" } } } },
          "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/apps/{appId}/namespaces/{namespaceId}/full-plan": {
      get: {
        tags: ["Namespaces"],
        summary: "Get full plan state including private meta",
        description: "Same as `/plan` but keeps the meta keys listed in the plan's `privateMetaKeys`. Secret key only: the app `public_key` gets 401.",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "appId", in: "path", required: true, schema: { type: "string" } },
          { name: "namespaceId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/NamespacePlan" } } } },
          "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },

    // ─── Usage ─────────────────────────────────────────────
    "/apps/{appId}/namespaces/{namespaceId}/usage": {
      get: {
        tags: ["Usage"],
        summary: "Get all usage for a namespace",
        security: [{ BearerAuth: [] }, { PublicAuth: [] }],
        parameters: [
          { name: "appId", in: "path", required: true, schema: { type: "string" } },
          { name: "namespaceId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Map of entitlement id to count", content: { "application/json": { schema: { type: "object", additionalProperties: { type: "number" } } } } },
          "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/apps/{appId}/namespaces/{namespaceId}/usage/{entitlementId}": {
      get: {
        tags: ["Usage"],
        summary: "Get usage for a single entitlement",
        security: [{ BearerAuth: [] }, { PublicAuth: [] }],
        parameters: [
          { name: "appId", in: "path", required: true, schema: { type: "string" } },
          { name: "namespaceId", in: "path", required: true, schema: { type: "string" } },
          { name: "entitlementId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { type: "object", properties: { entitlement: { type: "string" }, count: { type: "number" } } } } } },
          "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/apps/{appId}/namespaces/{namespaceId}/usage/{entitlementId}/add": {
      post: {
        tags: ["Usage"],
        summary: "Increment usage by 1",
        security: [{ BearerAuth: [] }, { PublicAuth: [] }],
        parameters: [
          { name: "appId", in: "path", required: true, schema: { type: "string" } },
          { name: "namespaceId", in: "path", required: true, schema: { type: "string" } },
          { name: "entitlementId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { type: "object", properties: { entitlement: { type: "string" }, count: { type: "number" } } } } } },
          "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/apps/{appId}/namespaces/{namespaceId}/usage/{entitlementId}/remove": {
      post: {
        tags: ["Usage"],
        summary: "Decrement usage by 1",
        description: "Secret key only: the app `public_key` can't lower a counter.",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "appId", in: "path", required: true, schema: { type: "string" } },
          { name: "namespaceId", in: "path", required: true, schema: { type: "string" } },
          { name: "entitlementId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { type: "object", properties: { entitlement: { type: "string" }, count: { type: "number" } } } } } },
          "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/apps/{appId}/namespaces/{namespaceId}/usage/{entitlementId}/amount": {
      post: {
        tags: ["Usage"],
        summary: "Adjust usage by a custom amount",
        description: "With the app `public_key`, a negative amount returns 403.",
        security: [{ BearerAuth: [] }, { PublicAuth: [] }],
        parameters: [
          { name: "appId", in: "path", required: true, schema: { type: "string" } },
          { name: "namespaceId", in: "path", required: true, schema: { type: "string" } },
          { name: "entitlementId", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["amount"], properties: { amount: { type: "integer", description: "Positive to increment, negative to decrement." } } } } },
        },
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { type: "object", properties: { entitlement: { type: "string" }, count: { type: "number" } } } } } },
          "400": { description: "Invalid amount", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },

    // ─── Analytics ─────────────────────────────────────────
    "/apps/{appId}/analytics/top-namespaces": {
      get: {
        tags: ["Analytics"],
        summary: "Top namespaces by activity",
        description: "Returns the top N namespaces ranked by event count. Optionally filter by a single entitlement.",
        parameters: [
          { name: "appId", in: "path", required: true, schema: { type: "string" } },
          {
            name: "interval",
            in: "query",
            required: false,
            schema: { type: "string", enum: ["7d", "30d", "60d", "6m", "year", "alltime"], default: "7d" },
          },
          {
            name: "limit",
            in: "query",
            required: false,
            schema: { type: "integer", minimum: 1, maximum: 100, default: 10 },
            description: "Number of namespaces to return (1–100).",
          },
          {
            name: "entitlement",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Filter to a specific entitlement_id.",
          },
        ],
        responses: {
          "200": {
            description: "Top namespaces",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      namespace_id: { type: "string" },
                      calls: { type: "number" },
                      total_amount: { type: "number" },
                    },
                  },
                },
              },
            },
          },
          "400": { description: "Invalid params", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/apps/{appId}/analytics": {
      get: {
        tags: ["Analytics"],
        summary: "Get usage analytics by interval",
        description: "Returns total `calls` and `total_amount` per `entitlement_id` for the given interval.",
        parameters: [
          { name: "appId", in: "path", required: true, schema: { type: "string" } },
          {
            name: "interval",
            in: "query",
            required: true,
            schema: { type: "string", enum: ["7d", "30d", "60d", "6m", "year", "alltime"] },
            description: "7d, 30d, 60d, 6m, year, or alltime.",
          },
          { name: "namespace", in: "query", required: false, schema: { type: "string" }, description: "Filter by namespace id." },
        ],
        responses: {
          "200": {
            description: "Per-entitlement totals",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      entitlement_id: { type: "string" },
                      calls: { type: "number" },
                      total_amount: { type: "number" },
                    },
                  },
                },
              },
            },
          },
          "400": { description: "Missing or invalid interval", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },

    // ─── Webhooks ──────────────────────────────────────────
    "/event-types": {
      get: {
        tags: ["Webhooks"],
        summary: "List webhook event types",
        description: "The event catalog with a sample `data` payload for each type. No auth required.",
        security: [],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string", example: "account.created" },
                      category: { type: "string", enum: ["account", "usage", "plan", "incentive"] },
                      title: { type: "string" },
                      description: { type: "string" },
                      sample: { type: "object", additionalProperties: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/apps/{appId}/webhooks": {
      get: {
        tags: ["Webhooks"],
        summary: "List webhook endpoints",
        parameters: [{ name: "appId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/WebhookEndpoint" } } } } },
        },
      },
      post: {
        tags: ["Webhooks"],
        summary: "Create a webhook endpoint",
        description: "At most 25 endpoints per app. `url` must be http(s) and point to a public address.",
        parameters: [{ name: "appId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["url", "events"],
                properties: {
                  url: { type: "string", example: "https://example.com/webhooks/offer" },
                  events: { type: "array", items: { type: "string" }, example: ["account.created", "usage.limit_reached"] },
                  description: { type: "string" },
                  source: { type: "string", enum: ["custom", "zapier"], default: "custom" },
                  enabled: { type: "boolean", default: true },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Created", content: { "application/json": { schema: { $ref: "#/components/schemas/WebhookEndpoint" } } } },
          "400": { description: "Invalid url, events or source, or too many endpoints", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/apps/{appId}/webhooks/{webhookId}": {
      get: {
        tags: ["Webhooks"],
        summary: "Get a webhook endpoint",
        parameters: [
          { name: "appId", in: "path", required: true, schema: { type: "string" } },
          { name: "webhookId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/WebhookEndpoint" } } } },
          "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      patch: {
        tags: ["Webhooks"],
        summary: "Update a webhook endpoint",
        description: "Accepts any of `url`, `events`, `description`, `enabled`; other keys are ignored. Re-enabling clears `disabled_reason`.",
        parameters: [
          { name: "appId", in: "path", required: true, schema: { type: "string" } },
          { name: "webhookId", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  url: { type: "string", example: "https://example.com/webhooks/offer" },
                  events: { type: "array", items: { type: "string" }, example: ["*"] },
                  description: { type: "string", nullable: true },
                  enabled: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Updated", content: { "application/json": { schema: { $ref: "#/components/schemas/WebhookEndpoint" } } } },
          "400": { description: "Invalid url or events", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      delete: {
        tags: ["Webhooks"],
        summary: "Delete a webhook endpoint",
        description: "Also deletes its deliveries.",
        parameters: [
          { name: "appId", in: "path", required: true, schema: { type: "string" } },
          { name: "webhookId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Deleted" },
          "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/apps/{appId}/webhooks/{webhookId}/secret/regenerate": {
      post: {
        tags: ["Webhooks"],
        summary: "Regenerate an endpoint's signing secret",
        parameters: [
          { name: "appId", in: "path", required: true, schema: { type: "string" } },
          { name: "webhookId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "New secret", content: { "application/json": { schema: { type: "object", properties: { secret: { type: "string", example: "whsec_..." } } } } } },
          "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/apps/{appId}/webhooks/{webhookId}/test": {
      post: {
        tags: ["Webhooks"],
        summary: "Send a test event",
        description: "Sends a sample event once, synchronously (no retries), even if the endpoint is disabled. Defaults to the endpoint's first event type, or `account.created` for `*`. Test events don't appear in `/events` or endpoint stats.",
        parameters: [
          { name: "appId", in: "path", required: true, schema: { type: "string" } },
          { name: "webhookId", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: false,
          content: { "application/json": { schema: { type: "object", properties: { type: { type: "string", example: "account.created" } } } } },
        },
        responses: {
          "200": { description: "The finished delivery", content: { "application/json": { schema: { $ref: "#/components/schemas/WebhookDelivery" } } } },
          "400": { description: "Unknown event type", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/apps/{appId}/webhooks/{webhookId}/deliveries": {
      get: {
        tags: ["Webhooks"],
        summary: "List an endpoint's deliveries",
        description: "Newest first.",
        parameters: [
          { name: "appId", in: "path", required: true, schema: { type: "string" } },
          { name: "webhookId", in: "path", required: true, schema: { type: "string" } },
          { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 100, default: 50 } },
          { name: "status", in: "query", required: false, schema: { type: "string", enum: ["pending", "succeeded", "failed"] } },
        ],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/WebhookDelivery" } } } } },
          "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/apps/{appId}/webhooks/{webhookId}/deliveries/{deliveryId}/retry": {
      post: {
        tags: ["Webhooks"],
        summary: "Retry a delivery",
        description: "Makes one synchronous attempt. If it fails the delivery stays `failed`; manual retries don't schedule more.",
        parameters: [
          { name: "appId", in: "path", required: true, schema: { type: "string" } },
          { name: "webhookId", in: "path", required: true, schema: { type: "string" } },
          { name: "deliveryId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "The delivery after the attempt", content: { "application/json": { schema: { $ref: "#/components/schemas/WebhookDelivery" } } } },
          "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/apps/{appId}/events": {
      get: {
        tags: ["Webhooks"],
        summary: "List recent events",
        description: "The app's event log, newest first. Events are kept for 30 days. Test events are excluded.",
        parameters: [
          { name: "appId", in: "path", required: true, schema: { type: "string" } },
          { name: "type", in: "query", required: false, schema: { type: "string" }, description: "Filter to one event type." },
          { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
        ],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/WebhookEvent" } } } } },
          "400": { description: "Unknown event type", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },

    // ─── Orgs ──────────────────────────────────────────────
    "/orgs": {
      get: {
        tags: ["Orgs"],
        summary: "List all orgs",
        security: [{ AdminAuth: [] }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Org" } } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      post: {
        tags: ["Orgs"],
        summary: "Create an org",
        security: [{ AdminAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["id"],
                properties: {
                  id: { type: "string", example: "acme" },
                  app_ids: { type: "array", items: { type: "string" }, example: ["app_abc123"] },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Created", content: { "application/json": { schema: { $ref: "#/components/schemas/Org" } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "409": { description: "Conflict", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/orgs/{orgId}/apps": {
      get: {
        tags: ["Orgs"],
        summary: "List apps for an org",
        security: [{ AdminAuth: [] }],
        parameters: [{ name: "orgId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/App" } } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "404": { description: "Org not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/orgs/{orgId}": {
      get: {
        tags: ["Orgs"],
        summary: "Get an org",
        security: [{ AdminAuth: [] }],
        parameters: [{ name: "orgId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/Org" } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      patch: {
        tags: ["Orgs"],
        summary: "Update an org",
        security: [{ AdminAuth: [] }],
        parameters: [{ name: "orgId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  app_ids: { type: "array", items: { type: "string" } },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Updated", content: { "application/json": { schema: { $ref: "#/components/schemas/Org" } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      delete: {
        tags: ["Orgs"],
        summary: "Delete an org",
        security: [{ AdminAuth: [] }],
        parameters: [{ name: "orgId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Deleted" },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
  },
};

export default spec;

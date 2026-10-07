"use client";

import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BadgePercent, Braces, ChartColumn, Code, CornerDownLeft, Gift, House, Key, KeyRound, Layers, LayoutGrid, Monitor, Moon, Plug, Plus, Puzzle, Search, Settings, Sparkles, Sun, Users, Webhook } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Avatar } from "@/components/ui/avatar";
import { backdropClass } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { api } from "@/lib/api/client";
import { useEntitlements, useIncentives, usePlans } from "@/lib/api/hooks";
import { setTheme, useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { useIsDemo } from "./workspace-context";

interface Command {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: ReactNode;
  keywords?: string;
  run: () => void;
}

const CommandMenuContext = createContext<{ open: () => void } | null>(null);

export function useCommandMenu() {
  return useContext(CommandMenuContext) ?? { open: () => {} };
}

/** Attio-style "Quick actions" palette (⌘K): navigation, create actions and record search. */
export function CommandMenuProvider({ appId, children }: { appId?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const value = useMemo(() => ({ open: () => setOpen(true) }), []);

  return (
    <CommandMenuContext.Provider value={value}>
      {children}
      <BaseDialog.Root open={open} onOpenChange={setOpen}>
        <BaseDialog.Portal>
          <BaseDialog.Backdrop className={backdropClass} />
          <BaseDialog.Viewport className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[14vh]">
            <BaseDialog.Popup className="w-full max-w-[560px] overflow-hidden rounded-xl border border-border bg-bg-elevated shadow-lg outline-none transition-[transform,opacity] duration-150 data-starting-style:scale-[0.98] data-starting-style:opacity-0 data-ending-style:opacity-0">
              <BaseDialog.Title className="sr-only">Quick actions</BaseDialog.Title>
              {open ? <Palette appId={appId} close={() => setOpen(false)} /> : null}
            </BaseDialog.Popup>
          </BaseDialog.Viewport>
        </BaseDialog.Portal>
      </BaseDialog.Root>
    </CommandMenuContext.Provider>
  );
}

function Palette({ appId, close }: { appId?: string; close: () => void }) {
  const router = useRouter();
  const demo = useIsDemo();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const deferred = useDeferredValue(query.trim());
  const listRef = useRef<HTMLDivElement>(null);

  const go = useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router],
  );

  const base = appId ? `/apps/${appId}` : null;
  const { resolved } = useTheme();
  const plans = usePlans(appId ?? "");
  const incentives = useIncentives(appId ?? "");
  const entitlements = useEntitlements(appId ?? "");
  const accounts = useQuery({
    queryKey: ["app", appId, "accounts", "palette", deferred],
    queryFn: () => api.accounts.list(appId!, { q: deferred, perPage: 6 }),
    enabled: Boolean(appId && deferred.length >= 1),
  });

  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [];
    if (base) {
      list.push(
        { id: "nav-overview", group: "Navigate", label: "Overview", icon: <House />, run: () => go(base) },
        { id: "nav-analytics", group: "Navigate", label: "Analytics", icon: <ChartColumn />, run: () => go(`${base}/analytics`) },
        // The agent is off on the demo login.
        ...(demo ? [] : [{ id: "nav-agent", group: "Navigate", label: "Agent", icon: <Sparkles />, keywords: "ai chat ask assistant", run: () => go(`${base}/agent`) }]),
        { id: "nav-plans", group: "Navigate", label: "Plans", icon: <Layers />, run: () => go(`${base}/plans`) },
        { id: "nav-ents", group: "Navigate", label: "Entitlements", icon: <KeyRound />, run: () => go(`${base}/entitlements`) },
        { id: "nav-addons", group: "Navigate", label: "Add-ons", icon: <Puzzle />, run: () => go(`${base}/addons`) },
        { id: "nav-incentives", group: "Navigate", label: "Incentives", icon: <Gift />, run: () => go(`${base}/incentives`) },
        { id: "nav-offers", group: "Navigate", label: "Offers", icon: <BadgePercent />, keywords: "deals promos checkout paypal discounts", run: () => go(`${base}/offers`) },
        { id: "nav-accounts", group: "Navigate", label: "Accounts", icon: <Users />, run: () => go(`${base}/accounts`) },
        { id: "nav-dev", group: "Navigate", label: "Integration guide", icon: <Code />, keywords: "developers sdk quickstart", run: () => go(`${base}/developers`) },
        { id: "nav-api", group: "Navigate", label: "API reference", icon: <Braces />, keywords: "docs endpoints try", run: () => go(`${base}/developers/api`) },
        { id: "nav-mcp", group: "Navigate", label: "MCP server", icon: <Plug />, keywords: "claude cursor ai assistant connector model context protocol", run: () => go(`${base}/developers/mcp`) },
        { id: "nav-keys", group: "Navigate", label: "API keys", icon: <Key />, keywords: "secret public token", run: () => go(`${base}/developers/keys`) },
        { id: "nav-webhooks", group: "Navigate", label: "Webhooks", icon: <Webhook />, keywords: "zapier events integrations hooks", run: () => go(`${base}/developers/webhooks`) },
        { id: "nav-settings", group: "Navigate", label: "App settings", icon: <Settings />, run: () => go(`${base}/settings`) },
        { id: "new-plan", group: "Create", label: "New plan", icon: <Plus />, run: () => go(`${base}/plans?new=1`) },
        { id: "new-ent", group: "Create", label: "New entitlement", icon: <Plus />, run: () => go(`${base}/entitlements?new=1`) },
        { id: "new-addon", group: "Create", label: "New add-on", icon: <Plus />, run: () => go(`${base}/addons?new=1`) },
        { id: "new-incentive", group: "Create", label: "New incentive", icon: <Plus />, run: () => go(`${base}/incentives?new=1`) },
        { id: "new-offer", group: "Create", label: "New offer", icon: <Plus />, run: () => go(`${base}/offers/new`) },
        { id: "new-account", group: "Create", label: "New account", icon: <Plus />, run: () => go(`${base}/accounts?new=1`) },
      );
    }
    list.push(
      { id: "ws-apps", group: "Workspace", label: "All apps", icon: <LayoutGrid />, run: () => go("/apps") },
      { id: "ws-new-app", group: "Workspace", label: "New app", icon: <Plus />, run: () => go("/apps?new=1") },
      { id: "ws-settings", group: "Workspace", label: "Workspace settings", icon: <Settings />, run: () => go("/settings/workspace") },
      {
        id: "theme-toggle",
        group: "Workspace",
        label: resolved === "dark" ? "Switch to light mode" : "Switch to dark mode",
        icon: resolved === "dark" ? <Sun /> : <Moon />,
        keywords: "theme appearance dark light",
        run: () => {
          close();
          setTheme(resolved === "dark" ? "light" : "dark");
        },
      },
      {
        id: "theme-system",
        group: "Workspace",
        label: "Use system theme",
        icon: <Monitor />,
        keywords: "theme appearance auto",
        run: () => {
          close();
          setTheme("system");
        },
      },
    );
    if (base && deferred) {
      for (const p of plans.data ?? []) {
        list.push({ id: `plan-${p.id}`, group: "Plans", label: p.name, hint: p.id, icon: <Layers />, keywords: p.id, run: () => go(`${base}/plans/${p.id}`) });
      }
      for (const i of incentives.data ?? []) {
        list.push({ id: `inc-${i.id}`, group: "Incentives", label: i.name, hint: i.id, icon: <Gift />, keywords: i.id, run: () => go(`${base}/incentives/${i.id}`) });
      }
      for (const e of entitlements.data ?? []) {
        list.push({ id: `ent-${e.id}`, group: "Entitlements", label: e.name, hint: e.id, icon: <KeyRound />, keywords: e.id, run: () => go(`${base}/entitlements?focus=${e.id}`) });
      }
    }
    return list;
  }, [base, close, deferred, demo, entitlements.data, go, incentives.data, plans.data, resolved]);

  const filtered = useMemo(() => {
    const q = deferred.toLowerCase();
    const matches = q
      ? commands.filter((c) => `${c.label} ${c.keywords ?? ""} ${c.group}`.toLowerCase().includes(q))
      : commands.filter((c) => c.group !== "Plans" && c.group !== "Incentives" && c.group !== "Entitlements");
    const accountHits: Command[] =
      base && q
        ? (accounts.data?.data ?? []).map((a) => ({
            id: `acct-${a.id}`,
            group: "Accounts",
            label: a.name || a.id,
            hint: a.id,
            icon: <Avatar name={a.name || a.id} seed={a.id} size="xs" />,
            run: () => go(`${base}/accounts/${encodeURIComponent(a.id)}`),
          }))
        : [];
    // Records first when searching, then navigation/actions.
    return q ? [...matches.filter((c) => !["Navigate", "Create", "Workspace"].includes(c.group)), ...accountHits, ...matches.filter((c) => ["Navigate", "Create", "Workspace"].includes(c.group))] : matches;
  }, [accounts.data, base, commands, deferred, go]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      filtered[active]?.run();
    }
  };

  let lastGroup = "";
  return (
    <div onKeyDown={onKeyDown}>
      <div className="flex h-14 items-center gap-3 border-b border-border px-5">
        <Search className="size-4 text-fg-tertiary" />
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          placeholder={appId ? "Search plans, accounts, incentives… or jump to a page" : "Search or jump to…"}
          className="h-full flex-1 bg-transparent text-base text-fg outline-none placeholder:text-fg-placeholder"
        />
        <Kbd>Esc</Kbd>
      </div>
      <div ref={listRef} className="max-h-[min(420px,60vh)] overflow-y-auto p-1.5 scrollbar-thin" role="listbox">
        {filtered.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-fg-tertiary">
            {accounts.isFetching ? "Searching…" : `No results for “${query}”`}
          </div>
        ) : (
          filtered.map((c, index) => {
            const header = c.group !== lastGroup ? c.group : null;
            lastGroup = c.group;
            return (
              <div key={c.id}>
                {header ? <div className="px-2.5 pb-1 pt-2.5 text-xs font-medium text-fg-tertiary">{header}</div> : null}
                <button
                  type="button"
                  data-index={index}
                  role="option"
                  aria-selected={index === active}
                  onMouseMove={() => setActive(index)}
                  onClick={c.run}
                  className={cn(
                    "flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-sm text-fg outline-none [&>svg]:size-4 [&>svg]:text-fg-tertiary",
                    index === active && "bg-bg-hover",
                  )}
                >
                  {c.icon}
                  <span className="truncate">{c.label}</span>
                  {c.hint ? <code className="truncate text-xs text-fg-tertiary">{c.hint}</code> : null}
                  {index === active ? (
                    c.group === "Navigate" || c.group === "Workspace" ? (
                      <ArrowRight className="ml-auto !size-3.5" />
                    ) : (
                      <CornerDownLeft className="ml-auto !size-3.5" />
                    )
                  ) : null}
                </button>
              </div>
            );
          })
        )}
      </div>
      <div className="flex h-9 items-center gap-3 border-t border-border bg-bg-subtle px-3 text-xs text-fg-tertiary">
        <span className="flex items-center gap-1">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> to navigate
        </span>
        <span className="flex items-center gap-1">
          <Kbd>↵</Kbd> to select
        </span>
      </div>
    </div>
  );
}

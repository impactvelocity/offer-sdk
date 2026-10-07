"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Building2, DoorOpen, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { DemoLock } from "@/components/shell/demo";
import { PageBody, PageHeader, PageTitle } from "@/components/shell/page";
import { useWorkspaceContext } from "@/components/shell/workspace-context";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, Section } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm";
import { CopyButton } from "@/components/ui/copy-button";
import { Field } from "@/components/ui/field";
import { Input, InputGroup } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { unwrap } from "@/components/workspace/unwrap";
import { membersKey, useWorkspaceMembers } from "@/components/workspace/use-members";
import { api } from "@/lib/api/client";
import { useApiMutation, useApps } from "@/lib/api/hooks";
import { authClient } from "@/lib/auth-client";
import { pluralize } from "@/lib/utils";

export function WorkspaceSettings() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { workspace, workspaces, switchWorkspace } = useWorkspaceContext();
  const members = useWorkspaceMembers();
  const { data: apps } = useApps();
  const [name, setName] = useState(workspace.name);

  const owners = members.data?.members.filter((m) => m.role.split(",").includes("owner")).length ?? 0;
  const isOwner = members.role === "owner";
  const dirty = name.trim() !== workspace.name;

  const rename = useApiMutation(
    (next: string) => unwrap(authClient.organization.update({ data: { name: next }, organizationId: workspace.id })),
    {
      invalidate: [membersKey(workspace.id)],
      success: "Workspace renamed",
      onSuccess: () => router.refresh(),
    },
  );

  /** After deleting or leaving: move to another workspace, or start over. */
  const exit = async () => {
    const other = workspaces.find((w) => w.id !== workspace.id);
    if (other) return switchWorkspace(other.id);
    queryClient.clear();
    router.push("/onboarding");
    router.refresh();
  };

  // The hosted API has no org-level cascade, so delete each app (and its data) before the workspace.
  const destroy = useApiMutation(
    async () => {
      const all = await api.workspace.apps();
      for (const app of all) await api.apps.delete(app.id);
      await unwrap(authClient.organization.delete({ organizationId: workspace.id }));
    },
    { invalidate: [], onSuccess: exit },
  );
  const leave = useApiMutation(() => unwrap(authClient.organization.leave({ organizationId: workspace.id })), {
    invalidate: [],
    onSuccess: exit,
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (dirty && name.trim()) rename.mutate(name.trim());
  };

  const onDelete = async () => {
    await confirm({
      title: `Delete ${workspace.name}?`,
      description: `This permanently deletes the workspace and ${
        apps?.length ? `its ${pluralize(apps.length, "app")}` : "all of its apps"
      }, including their plans, accounts, usage history and API keys. Integrations using those keys stop working immediately. This can't be undone.`,
      typeToConfirm: workspace.name,
      confirmLabel: "Delete workspace",
      onConfirm: () => destroy.mutateAsync(),
    });
  };

  const onLeave = async () => {
    await confirm({
      title: `Leave ${workspace.name}?`,
      description: "You'll lose access to this workspace and its apps until someone invites you again.",
      confirmLabel: "Leave workspace",
      onConfirm: () => leave.mutateAsync(),
    });
  };

  return (
    <>
      <PageHeader crumbs={[{ label: "Workspace", icon: <Building2 /> }]} title="General" />
      <PageBody width="narrow">
        <PageTitle title="General" description="Settings that apply to this workspace and all of its apps." />
        <Section title="Workspace" description="Its name and identifiers.">
          <div className="flex flex-col gap-5">
            <DemoLock>
              <form onSubmit={submit} className="flex items-end gap-3">
                <Avatar name={name || workspace.name} seed={workspace.id} size="xl" />
                <Field label="Workspace name" className="flex-1">
                  <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
                </Field>
                <Button type="submit" variant="primary" size="md" disabled={!dirty || !name.trim()} loading={rename.isPending}>
                  Save
                </Button>
              </form>
            </DemoLock>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Slug" description="Set when the workspace was created.">
                <Input value={workspace.slug} readOnly />
              </Field>
              <Field label="Workspace ID">
                <InputGroup
                  value={workspace.id}
                  readOnly
                  className="font-mono text-xs"
                  trailing={<CopyButton value={workspace.id} label="Copy workspace ID" />}
                />
              </Field>
            </div>
          </div>
        </Section>
        <DemoLock>
          <Section title="Danger zone">
            <Card className="divide-y divide-border">
              {members.isLoading ? (
                <div className="p-5">
                  <Skeleton className="h-10" />
                </div>
              ) : (
                <>
                  {!isOwner || owners > 1 ? (
                    <DangerRow
                      title="Leave workspace"
                      description="Remove yourself from this workspace. Everyone else keeps their access."
                      action={
                        <Button variant="secondary" onClick={onLeave}>
                          <DoorOpen />
                          Leave workspace
                        </Button>
                      }
                    />
                  ) : null}
                  {isOwner ? (
                    <DangerRow
                      title="Delete workspace"
                      description="Permanently delete this workspace and all of its apps, plans, accounts and usage data."
                      action={
                        <Button variant="danger" onClick={onDelete}>
                          <Trash2 />
                          Delete workspace
                        </Button>
                      }
                    />
                  ) : null}
                </>
              )}
            </Card>
            {!members.isLoading && !isOwner ? (
              <p className="mt-2 text-xs text-fg-tertiary">Only owners can delete the workspace.</p>
            ) : null}
          </Section>
        </DemoLock>
      </PageBody>
    </>
  );
}

function DangerRow({ title, description, action }: { title: string; description: string; action: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <div className="min-w-0">
        <div className="text-sm font-medium text-fg">{title}</div>
        <p className="mt-0.5 text-sm text-fg-tertiary">{description}</p>
      </div>
      {action}
    </div>
  );
}

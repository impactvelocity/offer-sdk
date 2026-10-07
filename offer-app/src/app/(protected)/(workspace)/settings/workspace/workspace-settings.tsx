"use client";

import { Building2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { DemoLock } from "@/components/shell/demo";
import { PageBody, PageHeader, PageTitle } from "@/components/shell/page";
import { useWorkspaceContext } from "@/components/shell/workspace-context";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Field } from "@/components/ui/field";
import { Input, InputGroup } from "@/components/ui/input";
import { unwrap } from "@/components/workspace/unwrap";
import { membersKey } from "@/components/workspace/use-members";
import { useApiMutation } from "@/lib/api/hooks";
import { authClient } from "@/lib/auth-client";

export function WorkspaceSettings() {
  const router = useRouter();
  const { workspace } = useWorkspaceContext();
  const [name, setName] = useState(workspace.name);

  const dirty = name.trim() !== workspace.name;

  const rename = useApiMutation(
    (next: string) => unwrap(authClient.organization.update({ data: { name: next }, organizationId: workspace.id })),
    {
      invalidate: [membersKey(workspace.id)],
      success: "Workspace renamed",
      onSuccess: () => router.refresh(),
    },
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (dirty && name.trim()) rename.mutate(name.trim());
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
      </PageBody>
    </>
  );
}

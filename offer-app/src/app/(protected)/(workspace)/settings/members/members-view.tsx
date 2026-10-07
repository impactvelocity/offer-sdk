"use client";

import { Building2, CalendarDays, Clock, Mail, Send, Shield, UserMinus, Users, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { RowMenu } from "@/components/catalog/row-menu";
import { PageBody, PageHeader, PageTitle } from "@/components/shell/page";
import { DemoLock } from "@/components/shell/demo";
import { useWorkspaceContext } from "@/components/shell/workspace-context";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, Section } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { MenuItem } from "@/components/ui/menu";
import { Select, type SelectOption } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tooltip } from "@/components/ui/tooltip";
import { unwrap } from "@/components/workspace/unwrap";
import { membersKey, primaryRole, useWorkspaceMembers, type Role } from "@/components/workspace/use-members";
import { useApiMutation } from "@/lib/api/hooks";
import { authClient } from "@/lib/auth-client";
import { formatDate, formatRelative, pluralize } from "@/lib/utils";

const ROLE_LABEL: Record<Role, string> = { owner: "Owner", admin: "Admin", member: "Member" };
const ROLE_HELP: Record<Role, string> = {
  owner: "Everything, including deleting the workspace",
  admin: "Manage members, apps and workspace settings",
  member: "Work in every app: catalog, accounts and analytics",
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Table cells sit inside a bordered card, so drop the last row's own bottom hairline.
const cardTable = "[&_tbody_tr:last-child>td]:border-b-0";

export function MembersView() {
  const { workspace, user } = useWorkspaceContext();
  const confirm = useConfirm();
  const { data, isLoading, error, role: myRole, canManage } = useWorkspaceMembers();
  const invalidate = [membersKey(workspace.id)];

  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  const updateRole = useApiMutation(
    ({ memberId, role }: { memberId: string; role: Role; name: string }) =>
      unwrap(authClient.organization.updateMemberRole({ memberId, role, organizationId: workspace.id })),
    { invalidate, success: (_, v) => `${v.name} is now ${v.role === "member" ? "a" : "an"} ${v.role}` },
  );
  const remove = useApiMutation(
    (memberId: string) =>
      unwrap(authClient.organization.removeMember({ memberIdOrEmail: memberId, organizationId: workspace.id })),
    { invalidate, success: "Member removed" },
  );
  const invite = useApiMutation(
    (vars: { email: string; role: "member" | "admin" }) =>
      unwrap(authClient.organization.inviteMember({ ...vars, organizationId: workspace.id })),
    {
      invalidate,
      success: (_, v) => `Invited ${v.email}`,
      onSuccess: () => setEmail(""),
      toastError: false,
    },
  );
  const revoke = useApiMutation((invitationId: string) => unwrap(authClient.organization.cancelInvitation({ invitationId })), {
    invalidate,
    success: "Invitation revoked",
  });

  const members = data?.members ?? [];
  const pending = (data?.invitations ?? []).filter((i) => i.status === "pending");

  const onInvite = (e: FormEvent) => {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!EMAIL.test(value)) return setInviteError("Enter a valid email address.");
    if (members.some((m) => m.user.email.toLowerCase() === value))
      return setInviteError("They're already a member of this workspace.");
    if (pending.some((i) => i.email.toLowerCase() === value)) return setInviteError("They already have a pending invitation.");
    setInviteError(null);
    invite.mutate({ email: value, role: inviteRole }, { onError: (err) => setInviteError(err.message) });
  };

  const onRoleChange = async (member: (typeof members)[number], role: Role) => {
    const name = member.user.name || member.user.email;
    if (role === "owner") {
      const ok = await confirm({
        title: `Make ${name} an owner?`,
        description: "Owners have full control, including removing other owners and deleting the workspace.",
        confirmLabel: "Make Owner",
        tone: "default",
      });
      if (!ok) return;
    }
    updateRole.mutate({ memberId: member.id, role, name });
  };

  const onRemove = (member: (typeof members)[number]) => {
    const name = member.user.name || member.user.email;
    return confirm({
      title: `Remove ${name}?`,
      description: `${name} loses access to ${workspace.name} and all of its apps right away. You can invite them again later.`,
      confirmLabel: "Remove Member",
      onConfirm: () => remove.mutateAsync(member.id),
    });
  };

  const onRevoke = (invitation: (typeof pending)[number]) =>
    confirm({
      title: `Revoke invitation for ${invitation.email}?`,
      description: "They won't get access when they sign up with this email. You can invite them again anytime.",
      confirmLabel: "Revoke",
      onConfirm: () => revoke.mutateAsync(invitation.id),
    });

  const roleOptions: SelectOption<Role>[] = (["owner", "admin", "member"] as const).map((r) => ({
    value: r,
    label: ROLE_LABEL[r],
    description: ROLE_HELP[r],
    // Only owners can grant ownership.
    disabled: r === "owner" && myRole !== "owner",
  }));

  return (
    <>
      <PageHeader crumbs={[{ label: "Workspace", icon: <Building2 /> }]} title="Members" />
      <PageBody width="narrow">
        <PageTitle
          title="Members"
          description={`Everyone in ${workspace.name} can access all of its apps. Roles control who can manage the workspace itself.`}
        />
        <DemoLock>
          <Section title="Members" description={data ? pluralize(members.length, "member") : undefined}>
            {isLoading ? (
              <div className="flex flex-col gap-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : error ? (
              <Card>
                <EmptyState compact icon={<Users />} title="Couldn't load members" description={error.message} />
              </Card>
            ) : (
              <Card className="overflow-hidden">
                <TableContainer>
                  <Table className={cardTable}>
                    <THead>
                      <tr>
                        <TH icon={<Users />}>Member</TH>
                        <TH icon={<Mail />}>Email</TH>
                        <TH icon={<Shield />} className="w-36">
                          Role
                        </TH>
                        <TH icon={<CalendarDays />} className="w-28">
                          Joined
                        </TH>
                        <TH className="w-10" />
                      </tr>
                    </THead>
                    <TBody>
                      {members.map((m) => {
                        const isSelf = m.userId === user.id;
                        const role = primaryRole(m.role);
                        const ownerTarget = role === "owner" && myRole !== "owner";
                        const canEdit = canManage && !isSelf && !ownerTarget;
                        return (
                          <TR key={m.id}>
                            <TD>
                              <div className="flex min-w-0 items-center gap-2">
                                <Avatar name={m.user.name || m.user.email} seed={m.userId} shape="circle" size="md" />
                                <span className="truncate font-medium">{m.user.name || m.user.email}</span>
                                {isSelf ? <Badge color="blue">You</Badge> : null}
                              </div>
                            </TD>
                            <TD className="max-w-48">
                              <span className="block truncate text-fg-secondary">{m.user.email}</span>
                            </TD>
                            <TD className="py-1">
                              <Tooltip
                                content={
                                  isSelf
                                    ? "You can't change your own role"
                                    : !canManage
                                      ? "Only owners and admins can change roles"
                                      : ownerTarget
                                        ? "Only owners can change an owner's role"
                                        : null
                                }
                              >
                                {/* Disabled buttons swallow hover, so let the wrapper receive it for the tooltip. */}
                                <span className={canEdit ? "block" : "block cursor-not-allowed [&>button]:pointer-events-none"}>
                                  <Select
                                    size="sm"
                                    value={role}
                                    onValueChange={(next) => next !== role && onRoleChange(m, next)}
                                    options={roleOptions}
                                    disabled={!canEdit || updateRole.isPending}
                                    aria-label={`Role for ${m.user.name || m.user.email}`}
                                  />
                                </span>
                              </Tooltip>
                            </TD>
                            <TD className="whitespace-nowrap text-fg-secondary">
                              <Tooltip content={formatDate(m.createdAt)}>
                                <span>{formatRelative(m.createdAt)}</span>
                              </Tooltip>
                            </TD>
                            <TD className="px-1">
                              {canEdit ? (
                                <RowMenu label={`Actions for ${m.user.name || m.user.email}`}>
                                  <MenuItem tone="danger" onClick={() => onRemove(m)}>
                                    <UserMinus />
                                    Remove from workspace
                                  </MenuItem>
                                </RowMenu>
                              ) : null}
                            </TD>
                          </TR>
                        );
                      })}
                    </TBody>
                  </Table>
                </TableContainer>
              </Card>
            )}
          </Section>

          <Section
            title="Invite People"
            description={
              canManage || !myRole
                ? "New members get access to every app in this workspace."
                : "Only owners and admins can invite people."
            }
          >
            <Card>
              <form onSubmit={onInvite} noValidate className="flex flex-col gap-3 p-5">
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setInviteError(null);
                      }}
                      placeholder="teammate@company.com"
                      aria-label="Email address"
                      aria-invalid={Boolean(inviteError)}
                      data-invalid={inviteError ? true : undefined}
                      disabled={!canManage}
                    />
                  </div>
                  <Select
                    value={inviteRole}
                    onValueChange={setInviteRole}
                    aria-label="Role"
                    className="w-32"
                    disabled={!canManage}
                    options={(["member", "admin"] as const).map((r) => ({
                      value: r,
                      label: ROLE_LABEL[r],
                      description: ROLE_HELP[r],
                    }))}
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    disabled={!canManage || !email.trim()}
                    loading={invite.isPending}
                  >
                    <Send />
                    Send Invite
                  </Button>
                </div>
                {inviteError ? <p className="text-xs text-danger-fg">{inviteError}</p> : null}
                <p className="flex items-start gap-1.5 text-xs text-fg-tertiary">
                  <Mail className="mt-px size-3 shrink-0" />
                  Email delivery isn&apos;t set up yet: invited people get access as soon as they sign up with this email.
                </p>
              </form>
            </Card>
          </Section>

          {pending.length ? (
            <Section title="Pending Invitations" description="They join automatically when they sign up with the invited email.">
              <Card className="overflow-hidden">
                <TableContainer>
                  <Table className={cardTable}>
                    <THead>
                      <tr>
                        <TH icon={<Mail />}>Email</TH>
                        <TH icon={<Shield />} className="w-24">
                          Role
                        </TH>
                        <TH icon={<Send />} className="w-28">
                          Invited
                        </TH>
                        <TH icon={<Clock />} className="w-28">
                          Expires
                        </TH>
                        <TH className="w-24" />
                      </tr>
                    </THead>
                    <TBody>
                      {pending.map((inv) => {
                        const expired = new Date(inv.expiresAt).getTime() < now;
                        return (
                          <TR key={inv.id}>
                            <TD className="max-w-56">
                              <span className="block truncate">{inv.email}</span>
                            </TD>
                            <TD>
                              <Badge color={primaryRole(inv.role) === "admin" ? "purple" : "gray"}>
                                {ROLE_LABEL[primaryRole(inv.role)]}
                              </Badge>
                            </TD>
                            <TD className="whitespace-nowrap text-fg-secondary">{formatRelative(inv.createdAt)}</TD>
                            <TD className="whitespace-nowrap">
                              {expired ? (
                                <Badge color="red">Expired</Badge>
                              ) : (
                                <span className="text-fg-secondary">{formatRelative(inv.expiresAt)}</span>
                              )}
                            </TD>
                            <TD align="right" className="px-2">
                              {canManage ? (
                                <Button size="xs" variant="ghost" onClick={() => onRevoke(inv)}>
                                  <X />
                                  Revoke
                                </Button>
                              ) : null}
                            </TD>
                          </TR>
                        );
                      })}
                    </TBody>
                  </Table>
                </TableContainer>
              </Card>
            </Section>
          ) : null}
        </DemoLock>
      </PageBody>
    </>
  );
}

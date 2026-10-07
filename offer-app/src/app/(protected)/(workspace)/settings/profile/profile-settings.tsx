"use client";

import { LogOut, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PageBody, PageHeader, PageTitle } from "@/components/shell/page";
import { DemoLock } from "@/components/shell/demo";
import { ThemePicker } from "@/components/shell/theme-picker";
import { useWorkspaceContext } from "@/components/shell/workspace-context";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, Section } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { unwrap } from "@/components/workspace/unwrap";
import { useApiMutation } from "@/lib/api/hooks";
import { authClient } from "@/lib/auth-client";

const MIN_PASSWORD = 8;

export function ProfileSettings() {
  const router = useRouter();
  const confirm = useConfirm();
  const { user } = useWorkspaceContext();
  const [name, setName] = useState(user.name);
  const dirty = name.trim() !== user.name;

  const rename = useApiMutation((next: string) => unwrap(authClient.updateUser({ name: next })), {
    invalidate: [],
    success: "Name updated",
    onSuccess: () => router.refresh(),
  });
  const revokeOthers = useApiMutation(() => unwrap(authClient.revokeOtherSessions()), {
    invalidate: [],
    success: "Signed out of all other devices",
  });

  const submitName = (e: FormEvent) => {
    e.preventDefault();
    if (dirty && name.trim()) rename.mutate(name.trim());
  };

  const onRevoke = () =>
    confirm({
      title: "Sign out of other devices?",
      description: "Every other browser and device signed in to your account is signed out. This one stays signed in.",
      confirmLabel: "Sign Out Others",
      onConfirm: () => revokeOthers.mutateAsync(),
    });

  return (
    <>
      <PageHeader crumbs={[{ label: "Account", icon: <UserRound /> }]} title="Profile" />
      <PageBody width="narrow">
        <PageTitle
          title="Profile"
          description="Your personal details and sign-in settings, shared across every workspace you're in."
        />
        <DemoLock>
          <Section title="Personal Details">
            <div className="flex flex-col gap-5">
              <form onSubmit={submitName} className="flex items-end gap-3">
                <Avatar name={name || user.name || user.email} seed={user.id} shape="circle" size="xl" />
                <Field label="Name" className="flex-1">
                  <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80} required />
                </Field>
                <Button type="submit" variant="primary" size="md" disabled={!dirty || !name.trim()} loading={rename.isPending}>
                  Save
                </Button>
              </form>
              <Field label="Email" description="Email changes aren't available yet.">
                <Input value={user.email} readOnly />
              </Field>
            </div>
          </Section>
        </DemoLock>
        <Section title="Appearance" description="Choose light or dark, or follow your system setting. Saved for this browser.">
          <ThemePicker />
        </Section>
        <DemoLock>
          <Section
            title="Password"
            description={`Use at least ${MIN_PASSWORD} characters. Changing it signs you out everywhere else.`}
          >
            <PasswordForm />
          </Section>
          <Section title="Sessions">
            <Card className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <div className="text-sm font-medium text-fg">Sign out of other devices</div>
                <p className="mt-0.5 text-sm text-fg-tertiary">
                  Lost a laptop or signed in somewhere shared? End every session except this one.
                </p>
              </div>
              <Button onClick={onRevoke} loading={revokeOthers.isPending}>
                <LogOut />
                Sign Out Others
              </Button>
            </Card>
          </Section>
        </DemoLock>
      </PageBody>
    </>
  );
}

type PasswordErrors = Partial<Record<"current" | "next" | "confirm", string>>;

function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [errors, setErrors] = useState<PasswordErrors>({});
  const [pending, setPending] = useState(false);

  const validate = (): PasswordErrors => ({
    current: current ? undefined : "Enter your current password.",
    next:
      next.length < MIN_PASSWORD
        ? `Use at least ${MIN_PASSWORD} characters.`
        : next === current
          ? "Choose a password different from your current one."
          : undefined,
    confirm: again !== next ? "Passwords don't match." : undefined,
  });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;

    setPending(true);
    const { error } = await authClient.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: true });
    setPending(false);
    if (error) {
      if (error.code === "INVALID_PASSWORD") return setErrors({ current: "That isn't your current password." });
      if (error.code === "PASSWORD_TOO_SHORT" || error.code === "PASSWORD_TOO_LONG") return setErrors({ next: error.message });
      return toast.error(error.message || "Couldn't change your password");
    }
    setCurrent("");
    setNext("");
    setAgain("");
    setErrors({});
    toast.success("Password changed", "Other devices have been signed out.");
  };

  // Clear a field's error as soon as it's edited.
  const edit = (field: keyof PasswordErrors, set: (v: string) => void) => (e: { target: { value: string } }) => {
    set(e.target.value);
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Field label="Current password" error={errors.current} className="sm:max-w-[calc(50%-8px)]">
        <Input type="password" autoComplete="current-password" value={current} onChange={edit("current", setCurrent)} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="New password" error={errors.next}>
          <Input type="password" autoComplete="new-password" value={next} onChange={edit("next", setNext)} />
        </Field>
        <Field label="Confirm new password" error={errors.confirm}>
          <Input type="password" autoComplete="new-password" value={again} onChange={edit("confirm", setAgain)} />
        </Field>
      </div>
      <div>
        <Button type="submit" variant="primary" size="md" loading={pending} disabled={!current || !next || !again}>
          Change Password
        </Button>
      </div>
    </form>
  );
}

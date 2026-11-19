import { createFileRoute, useRouter } from "@tanstack/react-router";
import { MailWarning } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/client/components/AppShell";
import { ChoiceSelect } from "@/client/components/ChoiceSelect";
import { PageHeader } from "@/client/components/PageHeader";
import {
  SettingsCard,
  SettingsCardFooter,
  SettingsRow,
  SettingsSection,
} from "@/client/components/SettingsSection";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Textarea } from "@/client/components/ui/textarea";
import { toastError } from "@/client/lib/errors";
import {
  getSettings,
  saveCompany,
  saveReminders,
  setRole,
  testDigest,
} from "@/serverFunctions/workspace";

export const Route = createFileRoute("/settings")({
  loader: () => getSettings(),
  head: () => ({ meta: [{ title: "Settings · Calibration Tracker" }] }),
  component: SettingsPage,
});

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MODES = [
  { value: "off", label: "Off" },
  { value: "per_item", label: "Before each due date" },
  { value: "digest", label: "Weekly digest" },
] as const;

function SettingsPage() {
  const { actor, workspace, team, emailReady } = Route.useLoaderData();
  return (
    <AppShell>
      <PageHeader title="Settings" />
      <CompanySection admin={actor.isAdmin} initial={workspace} />
      <RemindersSection admin={actor.isAdmin} initial={workspace} emailReady={emailReady} />
      <TeamSection admin={actor.isAdmin} me={actor.id} team={team} />
    </AppShell>
  );
}

function useSave() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return {
    busy,
    save: async (work: () => Promise<unknown>, done: string) => {
      setBusy(true);
      try {
        await work();
        toast.success(done);
        await router.invalidate();
      } catch (error) {
        toastError(error);
      } finally {
        setBusy(false);
      }
    },
  };
}

function CompanySection({ admin, initial }: { admin: boolean; initial: { companyName: string; disclaimer: string } }) {
  const [companyName, setCompanyName] = useState(initial.companyName);
  const [disclaimer, setDisclaimer] = useState(initial.disclaimer);
  const { busy, save } = useSave();
  return (
    <SettingsSection title="Certificates">
      <SettingsCard>
        <SettingsRow label="Company name" htmlFor="company-name">
          {admin ? (
            <Input id="company-name" data-testid="company-name" className="sm:w-72" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
          ) : (
            <span className="text-sm">{initial.companyName || "—"}</span>
          )}
        </SettingsRow>
        <SettingsRow
          label="Certificate footer"
          htmlFor="disclaimer"
          description="{companyName} becomes the company name."
          stacked
        >
          {admin ? (
            <Textarea id="disclaimer" data-testid="disclaimer" value={disclaimer} onChange={(e) => setDisclaimer(e.target.value)} />
          ) : (
            <p className="text-sm whitespace-pre-wrap">{initial.disclaimer || "—"}</p>
          )}
        </SettingsRow>
        {admin ? (
          <SettingsCardFooter>
            <Button data-testid="save-company" disabled={busy} onClick={() => save(() => saveCompany({ data: { companyName, disclaimer } }), "Company details saved")}>
              Save
            </Button>
          </SettingsCardFooter>
        ) : null}
      </SettingsCard>
    </SettingsSection>
  );
}

interface ReminderValues {
  reminderMode: string;
  reminderOffsets: string;
  reminderCc: string;
  digestWeekday: number;
  digestRecipients: string;
}

function RemindersSection({ admin, initial, emailReady }: { admin: boolean; initial: ReminderValues; emailReady: boolean }) {
  const [mode, setMode] = useState(initial.reminderMode as (typeof MODES)[number]["value"]);
  const [offsets, setOffsets] = useState(initial.reminderOffsets);
  const [cc, setCc] = useState(initial.reminderCc);
  const [weekday, setWeekday] = useState(String(initial.digestWeekday));
  const [recipients, setRecipients] = useState(initial.digestRecipients);
  const [preview, setPreview] = useState<{ text: string; problem: string | null; sent: boolean } | null>(null);
  const [testing, setTesting] = useState(false);
  const { busy, save } = useSave();
  const savedDigest = initial.reminderMode === "digest" && mode === "digest";

  async function sendTest() {
    setTesting(true);
    try {
      const result = await testDigest();
      setPreview({ text: `${result.preview.subject}\n\n${result.preview.text}`, problem: result.problem, sent: result.sent });
    } catch (error) {
      toastError(error);
    } finally {
      setTesting(false);
    }
  }

  return (
    <SettingsSection title="Reminders">
      {emailReady ? null : (
        <Alert data-testid="email-status">
          <MailWarning aria-hidden />
          <AlertDescription>
            {admin
              ? "Email isn't set up on your Gateway, so reminders aren't sent. Run pnpm everyapp configure calibration-tracker to set it up."
              : "Email isn't set up on your Gateway, so reminders aren't sent. Ask a Gateway admin to set it up."}
          </AlertDescription>
        </Alert>
      )}
      <SettingsCard>
        <SettingsRow label="Send" htmlFor="reminder-mode">
          {admin ? (
            <ChoiceSelect id="reminder-mode" testId="reminder-mode" className="w-56" value={mode} onChange={setMode} choices={MODES} />
          ) : (
            <span className="text-sm">{MODES.find((m) => m.value === initial.reminderMode)?.label}</span>
          )}
        </SettingsRow>
        {mode === "per_item" ? (
          <>
            <SettingsRow label="Days before due" htmlFor="reminder-offsets" description="Overdue items also get a reminder each day.">
              {admin ? (
                <Input id="reminder-offsets" data-testid="reminder-offsets" className="sm:w-56" value={offsets} onChange={(e) => setOffsets(e.target.value)} />
              ) : (
                <span className="text-sm">{initial.reminderOffsets}</span>
              )}
            </SettingsRow>
            <SettingsRow label="Also send to" htmlFor="reminder-cc" description="Each item's owner email gets its reminders.">
              {admin ? (
                <Input id="reminder-cc" data-testid="reminder-cc" className="sm:w-72" placeholder="name@example.com" value={cc} onChange={(e) => setCc(e.target.value)} />
              ) : (
                <span className="text-sm">{initial.reminderCc || "—"}</span>
              )}
            </SettingsRow>
          </>
        ) : null}
        {mode === "digest" ? (
          <>
            <SettingsRow label="Day" htmlFor="digest-weekday">
              {admin ? (
                <ChoiceSelect
                  id="digest-weekday"
                  testId="digest-weekday"
                  className="w-40"
                  value={weekday}
                  onChange={setWeekday}
                  choices={WEEKDAYS.map((d, i) => ({ value: String(i), label: d }))}
                />
              ) : (
                <span className="text-sm">{WEEKDAYS[initial.digestWeekday]}</span>
              )}
            </SettingsRow>
            <SettingsRow label="Recipients" htmlFor="digest-recipients">
              {admin ? (
                <Input id="digest-recipients" data-testid="digest-recipients" className="sm:w-72" placeholder="name@example.com" value={recipients} onChange={(e) => setRecipients(e.target.value)} />
              ) : (
                <span className="text-sm">{initial.digestRecipients || "—"}</span>
              )}
            </SettingsRow>
          </>
        ) : null}
        {admin ? (
          <SettingsCardFooter>
            {savedDigest ? (
              <Button variant="outline" data-testid="test-digest" disabled={testing} onClick={sendTest}>
                Send test digest
              </Button>
            ) : null}
            <Button
              data-testid="save-reminders"
              disabled={busy}
              onClick={() =>
                save(
                  () => saveReminders({ data: { mode, offsets, cc, weekday: Number(weekday), recipients } }),
                  "Reminder settings saved",
                )
              }
            >
              Save
            </Button>
          </SettingsCardFooter>
        ) : null}
      </SettingsCard>
      {preview ? (
        <div data-testid="digest-preview" className="space-y-2 rounded-xl border border-border bg-card p-4 text-sm">
          <p className={preview.sent ? "text-muted-foreground" : "text-destructive"}>
            {preview.sent ? "Sent." : preview.problem}
          </p>
          <pre className="font-mono text-xs whitespace-pre-wrap">{preview.text}</pre>
        </div>
      ) : null}
    </SettingsSection>
  );
}

interface TeamMember {
  id: string;
  email: string;
  role: string;
  isAdmin: boolean;
}

function TeamSection({ admin, me, team }: { admin: boolean; me: string; team: TeamMember[] }) {
  const { save } = useSave();
  return (
    <SettingsSection
      title="Team"
      description="Technicians record calibrations and run the crib. Viewers can only look. Admins come from the Gateway."
    >
      <div data-testid="team-list">
        <SettingsCard>
          {team.map((m) => (
            <div key={m.id} data-testid="team-row">
              <SettingsRow label={m.email + (m.id === me ? " (you)" : "")}>
                {m.isAdmin ? (
                  <span className="text-sm text-muted-foreground">Admin</span>
                ) : admin ? (
                  <ChoiceSelect
                    testId="team-role-select"
                    label={`Role for ${m.email}`}
                    className="w-36"
                    value={m.role === "viewer" ? "viewer" : "technician"}
                    onChange={(role) => save(() => setRole({ data: { memberId: m.id, role } }), "Role changed")}
                    choices={[
                      { value: "technician", label: "Technician" },
                      { value: "viewer", label: "Viewer" },
                    ]}
                  />
                ) : (
                  <span className="text-sm text-muted-foreground">{m.role === "viewer" ? "Viewer" : "Technician"}</span>
                )}
              </SettingsRow>
            </div>
          ))}
        </SettingsCard>
      </div>
    </SettingsSection>
  );
}

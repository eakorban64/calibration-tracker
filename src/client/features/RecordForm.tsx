import { useNavigate } from "@tanstack/react-router";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ChoiceSelect } from "@/client/components/ChoiceSelect";
import { FormRow } from "@/client/components/FormRow";
import { ResultBadge } from "@/client/components/StatusBadges";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent } from "@/client/components/ui/card";
import { Checkbox } from "@/client/components/ui/checkbox";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Textarea } from "@/client/components/ui/textarea";
import { toastError } from "@/client/lib/errors";
import { pointPasses } from "@/lib/calibration";
import { saveRecord } from "@/serverFunctions/records";

interface PointDraft {
  nominal: string;
  measured: string;
  lower: string;
  upper: string;
}

export interface RecordDraft {
  id?: string;
  calDate: string;
  technician: string;
  procedure: string;
  temperature: string;
  temperatureUnit: "C" | "F";
  humidity: string;
  points: PointDraft[];
  result: "pass" | "fail" | null;
  adjusted: boolean;
  notes: string;
}

const EMPTY_POINT: PointDraft = { nominal: "", measured: "", lower: "", upper: "" };

export function newDraft(date: string, procedure: string): RecordDraft {
  return {
    calDate: date,
    technician: "",
    procedure,
    temperature: "",
    temperatureUnit: "C",
    humidity: "",
    points: [{ ...EMPTY_POINT }],
    result: null,
    adjusted: false,
    notes: "",
  };
}

function pointState(p: PointDraft): "pass" | "fail" | null {
  if ([p.measured, p.lower, p.upper].some((v) => v.trim() === "" || !Number.isFinite(Number(v)))) return null;
  return pointPasses({ measured: Number(p.measured), lower: Number(p.lower), upper: Number(p.upper) }) ? "pass" : "fail";
}

function isBlank(p: PointDraft) {
  return Object.values(p).every((v) => v.trim() === "");
}

export function RecordForm({ equipmentId, initial }: { equipmentId: string; initial: RecordDraft }) {
  const navigate = useNavigate();
  const [draft, setDraft] = useState(initial);
  const [report, setReport] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof RecordDraft>(key: K, value: RecordDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const setPoint = (i: number, key: keyof PointDraft, value: string) =>
    setDraft((d) => ({ ...d, points: d.points.map((p, j) => (j === i ? { ...p, [key]: value } : p)) }));

  const states = draft.points.map(pointState);
  const computed: "pass" | "fail" = states.includes("fail") ? "fail" : "pass";
  const result = draft.result ?? computed;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const points = draft.points.filter((p) => !isBlank(p));
      const saved = await saveRecord({
        data: {
          ...(draft.id ? { id: draft.id } : {}),
          equipmentId,
          calDate: draft.calDate,
          technician: draft.technician,
          procedure: draft.procedure,
          temperature: draft.temperature === "" ? null : Number(draft.temperature),
          temperatureUnit: draft.temperatureUnit,
          humidity: draft.humidity === "" ? null : Number(draft.humidity),
          points: points.map((p) => ({
            nominal: Number(p.nominal),
            measured: Number(p.measured),
            lower: Number(p.lower),
            upper: Number(p.upper),
          })),
          result,
          adjusted: draft.adjusted,
          notes: draft.notes,
        },
      });
      if (report) {
        const form = new FormData();
        form.set("equipmentId", equipmentId);
        form.set("recordId", saved.id);
        form.set("file", report);
        const res = await fetch("/files/upload", { method: "POST", body: form });
        if (!res.ok) toast.error("The record was saved, but the report didn't upload.");
      }
      await navigate({ to: "/records/$id", params: { id: saved.id } });
    } catch (error) {
      toastError(error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FormRow label="Calibration date" htmlFor="rec-date">
            <Input id="rec-date" data-testid="rec-date" type="date" required value={draft.calDate} onChange={(e) => set("calDate", e.target.value)} />
          </FormRow>
          <FormRow label="Technician" htmlFor="rec-technician">
            <Input id="rec-technician" data-testid="rec-technician" required value={draft.technician} onChange={(e) => set("technician", e.target.value)} />
          </FormRow>
          <FormRow label="Procedure or reference standard" htmlFor="rec-procedure">
            <Input id="rec-procedure" data-testid="rec-procedure" value={draft.procedure} onChange={(e) => set("procedure", e.target.value)} />
          </FormRow>
          <FormRow label="Temperature" htmlFor="rec-temperature">
            <div className="flex gap-2">
              <Input id="rec-temperature" data-testid="rec-temperature" type="number" step="any" value={draft.temperature} onChange={(e) => set("temperature", e.target.value)} />
              <ChoiceSelect
                testId="rec-unit"
                label="Temperature unit"
                className="w-20"
                value={draft.temperatureUnit}
                onChange={(v) => set("temperatureUnit", v)}
                choices={[
                  { value: "C", label: "°C" },
                  { value: "F", label: "°F" },
                ]}
              />
            </div>
          </FormRow>
          <FormRow label="Humidity (%)" htmlFor="rec-humidity">
            <Input id="rec-humidity" data-testid="rec-humidity" type="number" step="any" min={0} max={100} value={draft.humidity} onChange={(e) => set("humidity", e.target.value)} />
          </FormRow>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Test points</h2>
        <div className="space-y-2">
          <div className="hidden grid-cols-[repeat(4,minmax(0,1fr))_4rem_2rem] gap-2 px-1 text-xs text-muted-foreground sm:grid">
            <span>Nominal</span>
            <span>Measured</span>
            <span>Lower limit</span>
            <span>Upper limit</span>
            <span />
            <span />
          </div>
          {draft.points.map((p, i) => (
            <div key={i} className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[repeat(4,minmax(0,1fr))_4rem_2rem]">
              {(["nominal", "measured", "lower", "upper"] as const).map((key) => (
                <Input
                  key={key}
                  data-testid={`point-${key}-${i}`}
                  aria-label={`${key === "lower" ? "Lower limit" : key === "upper" ? "Upper limit" : key[0]!.toUpperCase() + key.slice(1)}, point ${i + 1}`}
                  type="number"
                  step="any"
                  value={p[key]}
                  onChange={(e) => setPoint(i, key, e.target.value)}
                />
              ))}
              <span data-testid={`point-status-${i}`}>
                {states[i] ? <ResultBadge result={states[i]!} /> : null}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove point ${i + 1}`}
                disabled={draft.points.length === 1}
                onClick={() => set("points", draft.points.filter((_, j) => j !== i))}
              >
                <X aria-hidden />
              </Button>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" data-testid="add-point" onClick={() => set("points", [...draft.points, { ...EMPTY_POINT }])}>
          <Plus aria-hidden />
          Add point
        </Button>
      </section>

      <Card>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormRow label="Overall result" htmlFor="rec-result">
            <ChoiceSelect
              id="rec-result"
              testId="rec-result"
              value={result}
              onChange={(v) => set("result", v)}
              choices={[
                { value: "pass", label: "Pass" },
                { value: "fail", label: "Fail" },
              ]}
            />
          </FormRow>
          <div className="flex items-center gap-2 sm:pt-7">
            <Checkbox id="rec-adjusted" data-testid="rec-adjusted" checked={draft.adjusted} onCheckedChange={(v) => set("adjusted", v === true)} />
            <Label htmlFor="rec-adjusted">Adjusted during calibration</Label>
          </div>
          <FormRow label="Notes" htmlFor="rec-notes" className="space-y-1.5 sm:col-span-2">
            <Textarea id="rec-notes" data-testid="rec-notes" value={draft.notes} onChange={(e) => set("notes", e.target.value)} />
          </FormRow>
          {draft.id ? null : (
            <FormRow label="External report (optional)" htmlFor="rec-report" className="space-y-1.5 sm:col-span-2">
              <Input id="rec-report" data-testid="rec-report" type="file" onChange={(e) => setReport(e.target.files?.[0] ?? null)} />
            </FormRow>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="submit" data-testid="rec-save" disabled={saving}>
          {saving ? "Saving…" : draft.id ? "Save changes" : "Save calibration"}
        </Button>
      </div>
    </form>
  );
}

import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ChoiceSelect } from "@/client/components/ChoiceSelect";
import { FormDialog } from "@/client/components/FormDialog";
import { FormRow } from "@/client/components/FormRow";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Textarea } from "@/client/components/ui/textarea";
import { toastError } from "@/client/lib/errors";
import { saveEquipment } from "@/serverFunctions/equipment";

export interface EquipmentValues {
  id?: string;
  name: string;
  code: string;
  serial: string;
  manufacturer: string;
  model: string;
  category: string;
  location: string;
  owner: string;
  ownerEmail: string;
  range: string;
  condition: "good" | "fair" | "damaged";
  intervalDays: number | string;
  toleranceNotes: string;
  referenceStandard: string;
  status: "active" | "out_of_service";
  nextDueDate: string;
}

export const BLANK_EQUIPMENT: EquipmentValues = {
  name: "",
  code: "",
  serial: "",
  manufacturer: "",
  model: "",
  category: "",
  location: "",
  owner: "",
  ownerEmail: "",
  range: "",
  condition: "good",
  intervalDays: 365,
  toleranceNotes: "",
  referenceStandard: "",
  status: "active",
  nextDueDate: "",
};

const TEXT_FIELDS = [
  ["name", "Name", "eq-name"],
  ["code", "Equipment ID", "eq-code"],
  ["serial", "Serial number", "eq-serial"],
  ["manufacturer", "Manufacturer", "eq-manufacturer"],
  ["model", "Model", "eq-model"],
  ["category", "Category", "eq-category"],
  ["location", "Location", "eq-location"],
  ["owner", "Owner or department", "eq-owner"],
  ["ownerEmail", "Owner email", "eq-owner-email"],
  ["range", "Range", "eq-range"],
  ["referenceStandard", "Reference standard", "eq-reference"],
] as const;

export function EquipmentDialog({
  initial,
  calibrated,
  onClose,
  onSaved,
}: {
  initial: EquipmentValues;
  /** Has records, so the next due date follows them. */
  calibrated: boolean;
  onClose: () => void;
  onSaved?: (id: string) => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof EquipmentValues>(key: K, value: EquipmentValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  async function submit(event?: React.FormEvent) {
    event?.preventDefault();
    setSaving(true);
    try {
      const saved = await saveEquipment({
        data: { ...values, intervalDays: Number(values.intervalDays), nextDueDate: calibrated ? "" : values.nextDueDate },
      });
      if (saved.duplicates.length) {
        toast.warning(`Serial ${values.serial} is also on ${saved.duplicates.join(", ")}.`);
      } else {
        toast.success(values.id ? "Equipment saved" : "Equipment added");
      }
      await router.invalidate();
      onSaved?.(saved.id);
      onClose();
    } catch (error) {
      toastError(error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormDialog
      title={values.id ? "Edit equipment" : "Add equipment"}
      onClose={onClose}
      actions={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button data-testid="eq-save" disabled={saving} onClick={() => submit()}>
            {values.id ? "Save" : "Add"}
          </Button>
        </>
      }
    >
      <form
        data-testid="equipment-dialog"
        onSubmit={submit}
        className="grid max-h-[60vh] grid-cols-1 gap-3 overflow-y-auto px-0.5 sm:grid-cols-2"
      >
        {TEXT_FIELDS.map(([key, label, testId]) => (
          <FormRow key={key} label={label} htmlFor={testId}>
            <Input
              id={testId}
              data-testid={testId}
              type={key === "ownerEmail" ? "email" : "text"}
              value={values[key]}
              required={key === "name" || key === "code"}
              onChange={(e) => set(key, e.target.value)}
            />
          </FormRow>
        ))}
        <FormRow label="Interval (days)" htmlFor="eq-interval">
          <Input
            id="eq-interval"
            data-testid="eq-interval"
            type="number"
            min={1}
            value={values.intervalDays}
            onChange={(e) => set("intervalDays", e.target.value)}
          />
        </FormRow>
        {calibrated ? null : (
          <FormRow label="Next due date" htmlFor="eq-next-due">
            <Input
              id="eq-next-due"
              data-testid="eq-next-due"
              type="date"
              value={values.nextDueDate}
              onChange={(e) => set("nextDueDate", e.target.value)}
            />
          </FormRow>
        )}
        <FormRow label="Condition" htmlFor="eq-condition">
          <ChoiceSelect
            id="eq-condition"
            testId="eq-condition"
            value={values.condition}
            onChange={(v) => set("condition", v)}
            choices={[
              { value: "good", label: "Good" },
              { value: "fair", label: "Fair" },
              { value: "damaged", label: "Damaged" },
            ]}
          />
        </FormRow>
        <FormRow label="Status" htmlFor="eq-status">
          <ChoiceSelect
            id="eq-status"
            testId="eq-status"
            value={values.status}
            onChange={(v) => set("status", v)}
            choices={[
              { value: "active", label: "Active" },
              { value: "out_of_service", label: "Out of service" },
            ]}
          />
        </FormRow>
        <FormRow label="Tolerance notes" htmlFor="eq-tolerance" className="space-y-1.5 sm:col-span-2">
          <Textarea
            id="eq-tolerance"
            data-testid="eq-tolerance"
            value={values.toleranceNotes}
            onChange={(e) => set("toleranceNotes", e.target.value)}
          />
        </FormRow>
        <button type="submit" hidden />
      </form>
    </FormDialog>
  );
}

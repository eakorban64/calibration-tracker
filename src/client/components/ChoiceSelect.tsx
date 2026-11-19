import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";

export interface Choice<T extends string> {
  value: T;
  label: string;
}

/** A single-choice select over a short list of labelled values. */
export function ChoiceSelect<T extends string>({
  value,
  choices,
  onChange,
  testId,
  id,
  label,
  className,
  disabled,
}: {
  value: T;
  choices: readonly Choice<T>[];
  onChange: (value: T) => void;
  testId?: string;
  id?: string;
  /** An accessible name when no visible label points at it. */
  label?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <Select
      value={value}
      items={choices.map((c) => ({ value: c.value, label: c.label }))}
      onValueChange={(next) => {
        if (next !== null) onChange(next as T);
      }}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        data-testid={testId}
        aria-label={label}
        className={className ?? "w-full"}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {choices.map((c) => (
          <SelectItem key={c.value} value={c.value}>
            {c.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

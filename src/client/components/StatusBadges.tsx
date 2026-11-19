import { Badge } from "@/client/components/ui/badge";
import { STATE_LABEL, type CalState } from "@/lib/calibration";

const STATE_VARIANT = {
  current: "success",
  due_soon: "warning",
  overdue: "destructive",
  failed: "destructive",
  unscheduled: "outline",
} as const;

export function StateBadge({ state, testId }: { state: CalState; testId?: string }) {
  return (
    <Badge variant={STATE_VARIANT[state]} data-testid={testId}>
      {STATE_LABEL[state]}
    </Badge>
  );
}

export function ResultBadge({ result, testId }: { result: string; testId?: string }) {
  return (
    <Badge variant={result === "pass" ? "success" : "destructive"} data-testid={testId}>
      {result === "pass" ? "Pass" : "Fail"}
    </Badge>
  );
}

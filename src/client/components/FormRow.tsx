import type { ReactNode } from "react";
import { Label } from "@/client/components/ui/label";

/** A labelled control in a form grid. */
export function FormRow({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className ?? "space-y-1.5"}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

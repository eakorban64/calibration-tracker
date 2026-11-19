import { toast } from "sonner";

/** The sentence to show for a failed server call. */
export function messageOf(error: unknown): string {
  if (error instanceof Error) {
    // Validation errors arrive as zod's JSON list of issues.
    try {
      const issues = JSON.parse(error.message) as { message?: string }[];
      if (Array.isArray(issues) && issues[0]?.message) return issues[0].message;
    } catch {
      // Not JSON: the message is already a sentence.
    }
    return error.message;
  }
  return "That didn't work. Try again.";
}

export function toastError(error: unknown): void {
  toast.error(messageOf(error));
}

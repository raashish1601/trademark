"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ApiError, useReport } from "../api";
import { REPORT_REASONS } from "../schemas";
import { SignInGate } from "./sign-in-gate";

/** Twitter-style report flow: pick a reason, optional context, submit. */
export function ReportDialog({
  open,
  onOpenChange,
  targetType,
  targetId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetType: "post" | "comment";
  targetId: string;
}) {
  const report = useReport();
  const [reason, setReason] = React.useState<(typeof REPORT_REASONS)[number]["id"]>("spam");
  const [note, setNote] = React.useState("");
  const [gateOpen, setGateOpen] = React.useState(false);

  const submit = async () => {
    try {
      await report.mutateAsync({ targetType, targetId, reason, note: note.trim() || undefined });
      toast.success("Reported — our team will review it. Thank you.");
      onOpenChange(false);
      setNote("");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setGateOpen(true);
        return;
      }
      toast.error("Could not submit the report");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Report {targetType}</DialogTitle>
            <DialogDescription>
              What&apos;s wrong with it? Reports are anonymous to the author.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5" role="radiogroup" aria-label="Report reason">
              {REPORT_REASONS.map((r) => (
                <button
                  key={r.id}
                  role="radio"
                  aria-checked={reason === r.id}
                  onClick={() => setReason(r.id)}
                  className={cn(
                    "w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                    reason === r.id
                      ? "border-accent bg-accent/10 text-foreground"
                      : "text-muted hover:bg-surface-2"
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="report-note">Anything else? (optional)</Label>
              <Textarea
                id="report-note"
                rows={2}
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              onClick={submit}
              disabled={report.isPending}
              aria-busy={report.isPending}
            >
              {report.isPending && <Loader2 className="animate-spin" aria-hidden />}
              Submit report
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <SignInGate open={gateOpen} onOpenChange={setGateOpen} onAuthed={submit} />
    </>
  );
}

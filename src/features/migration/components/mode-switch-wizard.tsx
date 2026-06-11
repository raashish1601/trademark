"use client";

import * as React from "react";
import { ArrowRightLeft, CheckCircle2, Cloud, Database, HardDrive } from "lucide-react";
import { toast } from "sonner";
import { useDbSession } from "@/providers/db-session-provider";
import { useSession } from "@/lib/auth-client";
import { createLibsqlDb } from "@/lib/db/adapters/libsql";
import { createLocalDb, resetLocalDb } from "@/lib/db/adapters/local";
import { saveByodCreds, clearByodCreds, setStoredMode } from "@/lib/db/byod-store";
import type { DbClient, StorageMode } from "@/lib/db/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { AuthForm } from "@/features/auth";
import { copyDatabase, verifyCopy, type CopyReport } from "../copy-engine";

type Target = StorageMode; // hosted | byod | local
type Phase = "pick" | "byod-creds" | "hosted-auth" | "copying" | "done";

const TARGET_META: Record<Target, { icon: typeof Cloud; title: string; desc: string }> = {
  hosted: { icon: Cloud, title: "Move to hosted", desc: "We host an isolated database for you. Sign-in required." },
  byod: { icon: Database, title: "Move to your own database", desc: "Your Turso DB, your data — we never see it." },
  local: { icon: HardDrive, title: "Move to this browser", desc: "Store the journal locally in this browser (no account)." },
};

async function getHostedDb(): Promise<DbClient> {
  let res = await fetch("/api/db/token", { method: "POST" });
  if (res.status === 404) {
    const prov = await fetch("/api/db/provision", { method: "POST" });
    if (!prov.ok) throw new Error(((await prov.json()) as { error?: string }).error ?? "Provisioning failed");
    res = await fetch("/api/db/token", { method: "POST" });
  }
  if (!res.ok) throw new Error("Sign in first to use hosted storage");
  const data = (await res.json()) as { url: string; token: string };
  return createLibsqlDb(data.url, data.token);
}

/** Switch storage mode between any of the three modes. Copies client-side, verifies, then flips. */
export function ModeSwitchWizard() {
  const { state } = useDbSession();
  const { data: session } = useSession();
  const [open, setOpen] = React.useState(false);
  const [phase, setPhase] = React.useState<Phase>("pick");
  const [target, setTarget] = React.useState<Target>("byod");
  const [progress, setProgress] = React.useState({ pct: 0, label: "" });
  const [report, setReport] = React.useState<CopyReport[] | null>(null);
  const credsRef = React.useRef({ url: "", token: "" });

  if (state.status !== "ready") return null;
  const mode: StorageMode = state.mode;
  const targets: Target[] = (["hosted", "byod", "local"] as Target[]).filter((t) => t !== mode);

  const runCopy = async (targetDb: DbClient, finalize: () => Promise<void>) => {
    setPhase("copying");
    try {
      const reports = await copyDatabase(state.db, targetDb, (p) => {
        setProgress({
          pct: p.total > 0 ? Math.round((p.done / p.total) * 100) : 100,
          label: `${p.table} (${p.done}/${p.total})`,
        });
      });
      const verdict = verifyCopy(reports);
      if (!verdict.ok) {
        toast.error(`Verification failed: ${verdict.failures.join(", ")} — nothing was switched.`);
        setPhase("pick");
        return;
      }
      setReport(reports);
      await finalize();
      setPhase("done");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Migration failed — nothing was switched.");
      setPhase("pick");
    }
  };

  const recordServerMode = async (m: "hosted" | "byod") => {
    // The server only tracks hosted/byod (for the grace-period + DB mapping).
    // Switching to local needs no server record; switching from local has none to update.
    if (mode === "local") return;
    await fetch("/api/mode/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: m }),
    }).catch(() => undefined);
  };

  const switchToByod = async () => {
    const { url, token } = credsRef.current;
    const targetDb = createLibsqlDb(url, token);
    await targetDb.execute("SELECT 1").catch(() => {
      throw new Error("Could not connect — check URL and token");
    });
    await runCopy(targetDb, async () => {
      await saveByodCreds({ url, token });
      setStoredMode("byod");
      await recordServerMode("byod");
    });
  };

  const switchToHosted = async () => {
    const targetDb = await getHostedDb();
    await runCopy(targetDb, async () => {
      setStoredMode("hosted");
      clearByodCreds();
      await recordServerMode("hosted");
    });
  };

  const switchToLocal = async () => {
    // Start from a clean local DB so we get an exact copy, not a merge with old demo data.
    await resetLocalDb();
    const targetDb = await createLocalDb();
    await runCopy(targetDb, async () => {
      setStoredMode("local");
      clearByodCreds();
    });
  };

  const pickTarget = (t: Target) => {
    setTarget(t);
    if (t === "byod") setPhase("byod-creds");
    else if (t === "local") void switchToLocal();
    else if (session) void switchToHosted();
    else setPhase("hosted-auth");
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => { setPhase("pick"); setOpen(true); }}>
        <ArrowRightLeft className="h-3.5 w-3.5" /> Switch storage mode
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Switch storage mode</DialogTitle>
            <DialogDescription>
              Your data is copied directly from your browser — it never passes through our servers.
              Nothing is switched until every table is verified.
            </DialogDescription>
          </DialogHeader>

          {phase === "pick" && (
            <div className="space-y-2">
              {targets.map((t) => {
                const meta = TARGET_META[t];
                return (
                  <button
                    key={t}
                    className="flex w-full items-center gap-3 rounded-lg border p-3 text-left hover:border-accent"
                    onClick={() => pickTarget(t)}
                  >
                    <meta.icon className="h-5 w-5 shrink-0 text-accent" aria-hidden />
                    <div>
                      <div className="text-sm font-semibold">{meta.title}</div>
                      <div className="text-xs text-muted">
                        {meta.desc}
                        {t === "byod" && mode === "hosted" && " Hosted copy is deleted after 30 days."}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {phase === "byod-creds" && (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void switchToByod();
              }}
            >
              <div className="space-y-1">
                <Label htmlFor="switch-url">Your Turso database URL</Label>
                <Input
                  id="switch-url"
                  required
                  placeholder="libsql://my-journal-you.turso.io"
                  onChange={(e) => (credsRef.current.url = e.target.value.trim())}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="switch-token">Auth token</Label>
                <Input
                  id="switch-token"
                  required
                  type="password"
                  onChange={(e) => (credsRef.current.token = e.target.value.trim())}
                />
              </div>
              <Button type="submit" className="w-full">Copy my data &amp; switch</Button>
            </form>
          )}

          {phase === "hosted-auth" && <AuthForm onAuthed={() => void switchToHosted()} />}

          {phase === "copying" && (
            <div className="space-y-3 py-4" aria-busy="true">
              <Progress value={progress.pct} />
              <p className="text-center text-xs text-muted">Copying {progress.label}…</p>
            </div>
          )}

          {phase === "done" && report && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-profit">
                <CheckCircle2 className="h-5 w-5" aria-hidden />
                <span className="text-sm font-semibold">Verified &amp; switched to {TARGET_META[target].title.replace("Move to ", "")}.</span>
              </div>
              <div className="max-h-40 space-y-0.5 overflow-y-auto rounded-lg border p-3 text-xs text-muted">
                {report.map((r) => (
                  <div key={r.table} className="flex justify-between">
                    <span>{r.table}</span>
                    <span>
                      {r.targetCount}/{r.sourceCount} rows ✓
                    </span>
                  </div>
                ))}
              </div>
              <Button className="w-full" onClick={() => location.assign("/app/dashboard")}>
                Reload app
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

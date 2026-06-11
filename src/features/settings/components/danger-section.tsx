"use client";

import * as React from "react";
import { toast } from "sonner";
import { useDbSession, useDb } from "@/providers/db-session-provider";
import { signOut, useSession } from "@/lib/auth-client";
import { deleteLocalDb } from "@/lib/db/adapters/local";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm-dialog";

export function DangerSection() {
  const { mode } = useDb();
  const { disconnect } = useDbSession();
  const { data: session } = useSession();
  const confirmDialog = useConfirm();
  const [busy, setBusy] = React.useState(false);

  const deleteAccount = async () => {
    const first = await confirmDialog({
      title: "Delete account & hosted database?",
      description: "Your account AND your hosted journal database will be deleted.",
      confirmLabel: "Continue",
      destructive: true,
    });
    if (!first) return;
    const second = await confirmDialog({
      title: "Last chance",
      description: "Everything will be permanently deleted. This cannot be undone.",
      confirmLabel: "Delete everything",
      destructive: true,
    });
    if (!second) return;
    setBusy(true);
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      if (!res.ok) throw new Error("Deletion failed");
      await signOut();
      disconnect();
      location.assign("/");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Deletion failed");
      setBusy(false);
    }
  };

  const wipeLocal = async () => {
    const ok = await confirmDialog({
      title: "Wipe local data?",
      description: "All journal data stored in this browser will be removed.",
      confirmLabel: "Wipe data",
      destructive: true,
    });
    if (!ok) return;
    await deleteLocalDb();
    disconnect();
    location.assign("/");
  };

  return (
    <Card className="border-loss/40">
      <CardHeader>
        <CardTitle className="text-loss">Danger zone</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {mode === "hosted" && session && (
          <Button variant="destructive" size="sm" onClick={deleteAccount} disabled={busy}>
            Delete account & hosted database
          </Button>
        )}
        {mode === "local" && (
          <Button variant="destructive" size="sm" onClick={wipeLocal}>
            Wipe local data
          </Button>
        )}
        {mode === "byod" && (
          <Button
            variant="destructive"
            size="sm"
            onClick={async () => {
              const ok = await confirmDialog({
                title: "Disconnect this database?",
                description: "Your data stays safe in your Turso account.",
                confirmLabel: "Disconnect",
                destructive: true,
              });
              if (ok) {
                disconnect();
                location.assign("/");
              }
            }}
          >
            Disconnect database
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

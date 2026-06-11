"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

const ConfirmContext = React.createContext<((opts: ConfirmOptions) => Promise<boolean>) | null>(
  null
);

/**
 * Promise-based in-app confirmation — replaces every native confirm().
 * Usage: const confirm = useConfirm(); if (await confirm({ title: "Delete?" })) …
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<
    (ConfirmOptions & { resolve: (ok: boolean) => void }) | null
  >(null);

  const confirm = React.useCallback(
    (opts: ConfirmOptions) => new Promise<boolean>((resolve) => setState({ ...opts, resolve })),
    []
  );

  const close = (ok: boolean) => {
    state?.resolve(ok);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={Boolean(state)} onOpenChange={(open) => !open && close(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {state?.destructive && <AlertTriangle className="h-4 w-4 text-loss" aria-hidden />}
              {state?.title}
            </DialogTitle>
            {state?.description && <DialogDescription>{state.description}</DialogDescription>}
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => close(false)} autoFocus>
              {state?.cancelLabel ?? "Cancel"}
            </Button>
            <Button
              variant={state?.destructive ? "destructive" : "default"}
              size="sm"
              onClick={() => close(true)}
            >
              {state?.confirmLabel ?? "Confirm"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = React.useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return ctx;
}

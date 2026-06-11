"use client";

import * as React from "react";
import { useForm, useFieldArray, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PnlText } from "@/components/shared/pnl-text";
import { cn } from "@/lib/utils";
import { tradeFormSchema, type TradeFormValues } from "../schemas";
import { useAccounts, usePlaybooks, useSaveTrade } from "../queries";
import { aggregateLegs, deriveTradeNumbers, nowLocalInput } from "../utils";
import { TagPicker } from "./tag-picker";

/**
 * Field order is deliberate (journaling priority): instrument → direction →
 * execution (qty/entry/exit) → risk plan (SL/target — drives R-multiple and
 * plan-vs-actual review) → setup & conviction → psychology tags → notes →
 * timing (auto-filled) → charges override. Everything is visible — hiding the
 * risk plan behind a toggle meant nobody filled it.
 */
interface TradeFormProps {
  tradeId?: string;
  defaults?: Partial<TradeFormValues>;
  onSaved?: () => void;
  /** Reports dirty state so the host dialog can guard accidental dismissal. */
  onDirtyChange?: (dirty: boolean) => void;
  /** Persists in-progress values (quick-add) so nothing is ever lost. */
  onDraftChange?: (values: Partial<TradeFormValues>) => void;
  onSavedClearDraft?: () => void;
}

export function TradeForm({
  tradeId,
  defaults,
  onSaved,
  onDirtyChange,
  onDraftChange,
  onSavedClearDraft,
}: TradeFormProps) {
  const { data: accounts = [] } = useAccounts();
  const { data: playbooks = [] } = usePlaybooks();
  const saveTrade = useSaveTrade();

  const form = useForm<TradeFormValues>({
    resolver: zodResolver(tradeFormSchema) as Resolver<TradeFormValues>,
    defaultValues: {
      accountId: accounts[0]?.id ?? "",
      symbol: "",
      segment: "OPT",
      direction: "long",
      openedAt: nowLocalInput(),
      tagIds: [],
      ...defaults,
    },
  });
  const { register, handleSubmit, watch, control, setValue, formState } = form;
  const legsArray = useFieldArray({ control, name: "legs" });
  const [legsMode, setLegsMode] = React.useState(Boolean(defaults?.legs?.length));

  // Default the account once accounts load.
  React.useEffect(() => {
    if (!watch("accountId") && accounts[0]) setValue("accountId", accounts[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts]);

  // Surface dirty state + stream a draft of every change to the host.
  React.useEffect(() => {
    onDirtyChange?.(formState.isDirty);
  }, [formState.isDirty, onDirtyChange]);
  React.useEffect(() => {
    if (!onDraftChange) return;
    const sub = watch((values) => onDraftChange(values as Partial<TradeFormValues>));
    return () => sub.unsubscribe();
  }, [watch, onDraftChange]);

  // Legs mode: headline qty/avg-entry/avg-exit/times always mirror the legs.
  const watchedLegs = watch("legs");
  const direction = watch("direction");
  React.useEffect(() => {
    if (!legsMode || !watchedLegs?.length) return;
    const a = aggregateLegs(watchedLegs, direction);
    setValue("qty", a.qty);
    setValue("avgEntry", a.avgEntry as number);
    setValue("avgExit", a.avgExit);
    if (a.openedAt) setValue("openedAt", a.openedAt);
    setValue("closedAt", a.closedAt ?? undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(watchedLegs), direction, legsMode]);

  const toggleLegsMode = (on: boolean) => {
    setLegsMode(on);
    if (on) {
      // Seed legs from whatever is already typed in the simple fields.
      const v = form.getValues();
      const entrySide = v.direction === "long" ? ("buy" as const) : ("sell" as const);
      const exitSide = v.direction === "long" ? ("sell" as const) : ("buy" as const);
      const seed = [
        {
          side: entrySide,
          qty: v.qty || ("" as unknown as number),
          price: v.avgEntry || ("" as unknown as number),
          time: v.openedAt,
        },
      ];
      if (v.avgExit)
        seed.push({ side: exitSide, qty: v.qty, price: v.avgExit, time: v.closedAt || v.openedAt });
      setValue("legs", seed);
    } else {
      setValue("legs", undefined);
    }
  };

  const legsSummary =
    legsMode && watchedLegs?.length ? aggregateLegs(watchedLegs, direction) : null;

  const values = watch();
  const account = accounts.find((a) => a.id === values.accountId);
  const preview = React.useMemo(() => {
    try {
      const parsed = tradeFormSchema.safeParse(values);
      if (!parsed.success || parsed.data.avgExit == null) return null;
      return deriveTradeNumbers(parsed.data, account?.charge_profile ?? "zerodha");
    } catch {
      return null;
    }
  }, [values, account]);

  const onSubmit = handleSubmit(async (data) => {
    try {
      await saveTrade.mutateAsync({ values: data, id: tradeId });
      toast.success(tradeId ? "Trade updated" : "Trade saved");
      onSavedClearDraft?.();
      onSaved?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save trade");
    }
  });

  const err = (name: keyof TradeFormValues) =>
    formState.errors[name]?.message as string | undefined;
  const segment = values.segment;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2 space-y-1">
          <Label>Symbol</Label>
          <Input
            placeholder="NIFTY / RELIANCE"
            autoCapitalize="characters"
            {...register("symbol")}
          />
          {err("symbol") && <p className="text-xs text-loss">{err("symbol")}</p>}
        </div>
        <div className="space-y-1">
          <Label>Segment</Label>
          <Controller
            control={control}
            name="segment"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OPT">Options</SelectItem>
                  <SelectItem value="FUT">Futures</SelectItem>
                  <SelectItem value="EQ">Equity</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      {segment === "OPT" && (
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label>Strike</Label>
            <Input type="number" step="any" placeholder="24500" {...register("strike")} />
            {err("strike") && <p className="text-xs text-loss">{err("strike")}</p>}
          </div>
          <div className="space-y-1">
            <Label>CE / PE</Label>
            <Controller
              control={control}
              name="optionType"
              render={({ field }) => (
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CE">CE</SelectItem>
                    <SelectItem value="PE">PE</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-1">
            <Label>Expiry</Label>
            <Input type="date" {...register("expiry")} />
          </div>
        </div>
      )}

      <div className="space-y-1">
        <Label>Direction</Label>
        <Controller
          control={control}
          name="direction"
          render={({ field }) => (
            <div className="grid grid-cols-2 gap-2">
              {(["long", "short"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => field.onChange(d)}
                  className={cn(
                    "h-9 rounded-lg border text-sm font-medium capitalize transition-colors",
                    field.value === d
                      ? d === "long"
                        ? "border-profit bg-profit/15 text-profit"
                        : "border-loss bg-loss/15 text-loss"
                      : "text-muted hover:bg-surface-2"
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          )}
        />
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="legs-mode" className="text-xs text-muted">
          Multiple legs (scale in / out, partial exits)
        </Label>
        <Switch id="legs-mode" checked={legsMode} onCheckedChange={toggleLegsMode} />
      </div>

      {legsMode ? (
        <div className="space-y-2">
          {legsArray.fields.map((field, i) => (
            <div
              key={field.id}
              className="grid grid-cols-[5.5rem_1fr_1fr_1fr_2rem] items-end gap-1.5"
            >
              <div className="space-y-1">
                {i === 0 && <Label className="text-[11px]">Side</Label>}
                <Controller
                  control={control}
                  name={`legs.${i}.side`}
                  render={({ field: f }) => (
                    <Select value={f.value} onValueChange={f.onChange}>
                      <SelectTrigger aria-label={`Leg ${i + 1} side`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="buy">Buy</SelectItem>
                        <SelectItem value="sell">Sell</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-1">
                {i === 0 && <Label className="text-[11px]">Qty</Label>}
                <Input
                  type="number"
                  aria-label={`Leg ${i + 1} qty`}
                  {...register(`legs.${i}.qty`)}
                />
              </div>
              <div className="space-y-1">
                {i === 0 && <Label className="text-[11px]">Price ₹</Label>}
                <Input
                  type="number"
                  step="any"
                  aria-label={`Leg ${i + 1} price`}
                  {...register(`legs.${i}.price`)}
                />
              </div>
              <div className="space-y-1">
                {i === 0 && <Label className="text-[11px]">Time</Label>}
                <Input
                  type="datetime-local"
                  aria-label={`Leg ${i + 1} time`}
                  {...register(`legs.${i}.time`)}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove leg ${i + 1}`}
                className="text-muted hover:text-loss"
                disabled={legsArray.fields.length <= 1}
                onClick={() => legsArray.remove(i)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                legsArray.append({
                  side: direction === "long" ? "sell" : "buy",
                  qty: "" as unknown as number,
                  price: "" as unknown as number,
                  time: nowLocalInput(),
                })
              }
            >
              <Plus className="h-3.5 w-3.5" aria-hidden /> Add leg
            </Button>
            {legsSummary && legsSummary.qty > 0 && (
              <p className="text-xs text-muted">
                {legsSummary.qty} @ ₹{legsSummary.avgEntry}
                {legsSummary.closed
                  ? ` → ₹${legsSummary.avgExit} (closed)`
                  : legsSummary.exitQty > 0
                    ? ` · ${legsSummary.exitQty} exited — still open`
                    : " · open"}
              </p>
            )}
          </div>
          {err("qty") && <p className="text-xs text-loss">Add at least one entry-side leg</p>}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label>Qty</Label>
            <Input type="number" placeholder="75" {...register("qty")} />
            {err("qty") && <p className="text-xs text-loss">{err("qty")}</p>}
          </div>
          <div className="space-y-1">
            <Label>Entry ₹</Label>
            <Input type="number" step="any" placeholder="120.50" {...register("avgEntry")} />
            {err("avgEntry") && <p className="text-xs text-loss">{err("avgEntry")}</p>}
          </div>
          <div className="space-y-1">
            <Label>Exit ₹</Label>
            <Input type="number" step="any" placeholder="blank = open" {...register("avgExit")} />
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* Risk plan — SL first: it powers R-multiples and plan-vs-actual review. */}
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label>Stop loss</Label>
            <Input
              type="number"
              step="any"
              placeholder="risk per trade"
              {...register("plannedSl")}
            />
          </div>
          <div className="space-y-1">
            <Label>Target</Label>
            <Input type="number" step="any" {...register("plannedTarget")} />
          </div>
          <div className="space-y-1">
            <Label>Planned entry</Label>
            <Input type="number" step="any" {...register("plannedEntry")} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label>Playbook / setup</Label>
            <Controller
              control={control}
              name="playbookId"
              render={({ field }) => (
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    {playbooks.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-1">
            <Label>Confidence</Label>
            <Controller
              control={control}
              name="confidence"
              render={({ field }) => (
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => field.onChange(field.value === n ? undefined : n)}
                      className={cn(
                        "h-9 flex-1 rounded-lg border text-sm transition-colors",
                        field.value && field.value >= n
                          ? "border-accent bg-accent/15 text-accent"
                          : "text-muted hover:bg-surface-2"
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )}
            />
          </div>
        </div>
        <Controller
          control={control}
          name="tagIds"
          render={({ field }) => <TagPicker value={field.value} onChange={field.onChange} />}
        />
        <div className="space-y-1">
          <Label>Notes</Label>
          <Textarea placeholder="What was the thesis? What did you see?" {...register("notes")} />
        </div>
        {/* Timing auto-fills to "now" — editing it is the exception, so it sits low. */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label>Opened at</Label>
            <Input type="datetime-local" {...register("openedAt")} />
          </div>
          <div className="space-y-1">
            <Label>Closed at</Label>
            <Input type="datetime-local" {...register("closedAt")} />
          </div>
        </div>
        <div className="space-y-1">
          <Label>Charges override ₹ (blank = auto-calculated)</Label>
          <Input type="number" step="any" {...register("manualCharges")} />
        </div>
      </div>

      {preview && (
        <div className="flex items-center justify-between rounded-lg border bg-surface-2 px-3 py-2 text-sm">
          <span className="text-muted text-xs">
            Gross <PnlText value={preview.gross} /> · Charges{" "}
            <span className="font-money">₹{preview.charges.toFixed(0)}</span>
            {preview.r != null && <> · {preview.r}R</>}
          </span>
          <PnlText value={preview.net} className="text-base font-semibold" />
        </div>
      )}

      <Button type="submit" className="w-full" disabled={saveTrade.isPending}>
        {saveTrade.isPending ? "Saving…" : tradeId ? "Update trade" : "Save trade"}
      </Button>
    </form>
  );
}

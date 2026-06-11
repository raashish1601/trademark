"use client";

import * as React from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, toDateKey } from "@/lib/utils";

/**
 * In-house date & date-time pickers (native inputs looked... native).
 * Values stay in the native string formats ("YYYY-MM-DD" / "YYYY-MM-DDTHH:mm")
 * so forms, schemas and persistence are untouched.
 */

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const MONTHS =
  "January February March April May June July August September October November December".split(
    " "
  );

function CalendarGrid({
  view,
  value,
  onPick,
}: {
  view: Date;
  value: string | null;
  onPick: (key: string) => void;
}) {
  const year = view.getFullYear();
  const month = view.getMonth();
  const offset = (new Date(year, month, 1).getDay() + 6) % 7; // Monday-start
  const days = new Date(year, month + 1, 0).getDate();
  const todayK = toDateKey(new Date());

  return (
    <div className="grid w-64 grid-cols-7 gap-0.5 text-center">
      {WEEKDAYS.map((d, i) => (
        <div key={i} className="micro-label py-1">
          {d}
        </div>
      ))}
      {Array.from({ length: offset }).map((_, i) => (
        <div key={`e${i}`} />
      ))}
      {Array.from({ length: days }).map((_, i) => {
        const key = toDateKey(new Date(year, month, i + 1));
        const selected = value === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onPick(key)}
            aria-label={key}
            aria-pressed={selected}
            className={cn(
              "h-8 rounded-md text-sm transition-colors",
              selected ? "bg-accent font-semibold text-accent-fg" : "hover:bg-surface-2",
              !selected && key === todayK && "ring-1 ring-accent/60"
            )}
          >
            {i + 1}
          </button>
        );
      })}
    </div>
  );
}

function MonthNav({ view, setView }: { view: Date; setView: (d: Date) => void }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <button
        type="button"
        aria-label="Previous month"
        className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-foreground"
        onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="text-sm font-semibold">
        {MONTHS[view.getMonth()]} {view.getFullYear()}
      </span>
      <button
        type="button"
        aria-label="Next month"
        className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-foreground"
        onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

const triggerCls =
  "flex h-9 w-full items-center gap-2 rounded-lg border bg-transparent px-3 text-sm transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50";

/** Plain date picker — value "YYYY-MM-DD" or "". */
export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  disabled,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [view, setView] = React.useState(() => (value ? new Date(value) : new Date()));

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o && value) setView(new Date(value));
      }}
    >
      <PopoverTrigger asChild>
        <button type="button" className={triggerCls} disabled={disabled} aria-label={ariaLabel}>
          <CalendarIcon className="h-4 w-4 text-muted" aria-hidden />
          {value ? (
            new Date(value + "T12:00:00").toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          ) : (
            <span className="text-muted">{placeholder}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent>
        <MonthNav view={view} setView={setView} />
        <CalendarGrid
          view={view}
          value={value || null}
          onPick={(key) => {
            onChange(key);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

/** Date + time picker — value "YYYY-MM-DDTHH:mm" or "". */
export function DateTimePicker({
  value,
  onChange,
  placeholder = "Pick date & time",
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  "aria-label"?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const dateKey = value ? value.slice(0, 10) : null;
  const time = value ? value.slice(11, 16) : "09:15"; // NSE open as the friendly default
  const [view, setView] = React.useState(() => (dateKey ? new Date(dateKey) : new Date()));

  const setPart = (nextDate: string | null, nextTime: string) => {
    onChange(`${nextDate ?? toDateKey(new Date())}T${nextTime}`);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o && dateKey) setView(new Date(dateKey));
      }}
    >
      <PopoverTrigger asChild>
        <button type="button" className={triggerCls} aria-label={ariaLabel}>
          <CalendarIcon className="h-4 w-4 text-muted" aria-hidden />
          {value ? (
            <>
              {new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
              <span className="font-money text-muted">{time}</span>
            </>
          ) : (
            <span className="text-muted">{placeholder}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent>
        <MonthNav view={view} setView={setView} />
        <CalendarGrid view={view} value={dateKey} onPick={(key) => setPart(key, time)} />
        <div className="mt-3 flex items-center gap-2 border-t pt-3">
          <Clock className="h-4 w-4 text-muted" aria-hidden />
          <select
            aria-label="Hour"
            className="h-8 flex-1 rounded-md border bg-surface px-2 font-money text-sm"
            value={time.slice(0, 2)}
            onChange={(e) => setPart(dateKey, `${e.target.value}:${time.slice(3, 5)}`)}
          >
            {Array.from({ length: 24 }).map((_, h) => (
              <option key={h} value={String(h).padStart(2, "0")}>
                {String(h).padStart(2, "0")}
              </option>
            ))}
          </select>
          <span className="text-muted">:</span>
          <select
            aria-label="Minute"
            className="h-8 flex-1 rounded-md border bg-surface px-2 font-money text-sm"
            value={time.slice(3, 5)}
            onChange={(e) => setPart(dateKey, `${time.slice(0, 2)}:${e.target.value}`)}
          >
            {Array.from({ length: 60 }).map((_, m) => (
              <option key={m} value={String(m).padStart(2, "0")}>
                {String(m).padStart(2, "0")}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="rounded-md px-2 py-1.5 text-xs font-medium text-accent hover:bg-accent/10"
            onClick={() => setOpen(false)}
          >
            Done
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

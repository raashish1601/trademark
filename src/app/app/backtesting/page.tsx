"use client";

import { FlaskConical, LineChart, PlayCircle, Timer } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";

const PLANNED = [
  {
    icon: PlayCircle,
    title: "Replay your playbooks",
    text: "Run your saved setups against historical NIFTY & BANKNIFTY data and see how they would have performed.",
  },
  {
    icon: LineChart,
    title: "Strategy equity curves",
    text: "Win rate, expectancy, drawdown and R-distribution per strategy — before you risk real capital.",
  },
  {
    icon: Timer,
    title: "Walk-forward testing",
    text: "Validate on unseen periods so you know the edge isn't curve-fit.",
  },
];

export default function BacktestingPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Algo Backtesting" description="Test your strategies before the market does." />

      <div className="relative overflow-hidden rounded-xl border bg-surface px-6 py-14 text-center">
        <div className="hero-glow absolute inset-0" aria-hidden />
        <div className="relative">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15">
            <FlaskConical className="h-7 w-7 text-accent" aria-hidden />
          </span>
          <span className="mt-5 inline-block rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent">
            Coming soon
          </span>
          <h2 className="mt-3 text-2xl font-bold">Backtesting is on the way</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
            We&apos;re building a backtesting engine that connects directly to your playbooks — so the
            setups you journal are the setups you test.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {PLANNED.map((p) => (
          <div key={p.title} className="rounded-xl border border-dashed bg-surface/50 p-5">
            <p.icon className="h-5 w-5 text-muted" aria-hidden />
            <h3 className="mt-3 text-sm font-semibold text-muted">{p.title}</h3>
            <p className="mt-1.5 text-sm leading-6 text-muted/70">{p.text}</p>
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-muted">
        Want it sooner? Tell us in the feedback form — it directly shapes the roadmap.
      </p>
    </div>
  );
}

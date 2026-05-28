'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  className?: string;
}

export function MetricCard({ label, value, icon, className }: MetricCardProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10',
        className
      )}
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="[&>svg]:size-5">{icon}</span>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <span className="font-heading text-2xl font-semibold tracking-tight text-card-foreground">
        {value}
      </span>
    </div>
  );
}

interface DistributionBarProps {
  label: string;
  percentage: number;
  color: string;
}

export function DistributionBar({ label, percentage, color }: DistributionBarProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-card-foreground">{label}</span>
        <span className="tabular-nums text-muted-foreground">{percentage}%</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

interface DetailItemProps {
  label: string;
  value: string;
}

export function DetailItem({ label, value }: DetailItemProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="font-medium text-card-foreground">{value}</span>
    </div>
  );
}

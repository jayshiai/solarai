'use client';

import {
  Zap,
  Upload,
  FileText,
  BarChart3,
  AlertCircle,
  LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { useAppStore } from '@/lib/state';
import { cn } from '@/lib/utils';

interface NavItemProps {
  icon: LucideIcon;
  label: string | ReactNode;
  href: string;
  isActive: boolean;
}

function NavItem({ icon: Icon, label, href, isActive }: NavItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        'group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all outline-none select-none',
        'focus-visible:ring-2 focus-visible:ring-ring/50',
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      )}
    >
      <Icon className="size-5 shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function ModelStatusDot() {
  const trainingJob = useAppStore((s) => s.trainingJob);
  const pathname = usePathname();
  const [showBadge, setShowBadge] = useState(false);
  const isOnModelPage = pathname === '/model';

  useEffect(() => {
    if (isOnModelPage) {
      setShowBadge(false);
    }
  }, [isOnModelPage]);

  useEffect(() => {
    if (trainingJob && ['queued', 'training', 'complete', 'failed', 'cancelled'].includes(trainingJob.status)) {
      setShowBadge(true);
    } else {
      setShowBadge(false);
    }
  }, [trainingJob]);

  if (!showBadge || !trainingJob) return null;

  const statusColors: Record<string, { bg: string; tooltip: string }> = {
    queued: { bg: 'bg-amber-500', tooltip: 'Training queued' },
    training: { bg: 'bg-amber-500', tooltip: 'Training in progress' },
    complete: { bg: 'bg-emerald-500', tooltip: 'Training complete' },
    failed: { bg: 'bg-red-500', tooltip: 'Training failed' },
    cancelled: { bg: 'bg-red-500', tooltip: 'Training cancelled' },
  };

  const { bg, tooltip } = statusColors[trainingJob.status] || statusColors.queued;

  return (
    <Tooltip>
      <TooltipTrigger>
        <span className={cn('ml-2 size-2 shrink-0 rounded-full', bg)} />
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { correctionCount } = useAppStore();

  const isInspectActive = pathname === '/' || pathname.startsWith('/inspect');
  const isReportsActive = pathname.startsWith('/reports');
  const isModelActive = pathname === '/model';

  return (
    <TooltipProvider delay={300}>
      <aside className="fixed left-0 top-0 z-40 flex h-screen w-[240px] flex-col border-r border-border bg-background">
        <div className="flex items-center gap-2.5 px-4 py-4">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Zap className="size-5" />
          </div>
          <span className="text-base font-semibold tracking-tight text-foreground">
            SolarAI
          </span>
        </div>

        <Separator />

        <nav className="flex flex-col gap-1 p-3">
          <NavItem
            icon={Upload}
            label="Inspect"
            href="/"
            isActive={isInspectActive}
          />
          <NavItem
            icon={FileText}
            label="Reports"
            href="/reports"
            isActive={isReportsActive}
          />
          <NavItem
            icon={BarChart3}
            label={
              <span className="flex items-center">
                Model
                <ModelStatusDot />
              </span>
            }
            href="/model"
            isActive={isModelActive}
          />
        </nav>

        <div className="flex-1" />

        {correctionCount > 0 && (
          <>
            <Separator />
            <div className="p-3">
              <Tooltip>
                <TooltipTrigger>
                  <div className="flex items-center gap-2.5 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                    <AlertCircle className="size-5 shrink-0" />
                    <span className="font-medium">Corrections</span>
                    <Badge
                      variant="default"
                      className="ml-auto bg-destructive text-destructive-foreground"
                    >
                      {correctionCount}
                    </Badge>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  {correctionCount} correction{correctionCount !== 1 ? 's' : ''} pending
                </TooltipContent>
              </Tooltip>
            </div>
          </>
        )}
      </aside>
    </TooltipProvider>
  );
}

'use client';

import {
  Clock,
  Loader2,
  CheckCircle,
  XCircle,
  Play,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Progress,
  ProgressTrack,
  ProgressIndicator,
} from '@/components/ui/progress';
import { useAppStore } from '@/lib/state';
import { CORRECTION_THRESHOLD } from '@/lib/constants';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type StageStatus = 'pending' | 'active' | 'completed' | 'failed';

interface TrainingStage {
  id: string;
  name: string;
  description: string;
  status: StageStatus;
  progress?: number;
  timestamp?: string;
}

const STAGES: TrainingStage[] = [
  {
    id: 'data-collection',
    name: 'Data Collection',
    description: 'Gathering thermal imagery from inspection uploads',
    status: 'completed',
    timestamp: 'May 27, 2026 · 09:14 AM',
  },
  {
    id: 'dataset-generation',
    name: 'Dataset Generation',
    description: 'Building labeled dataset from corrections and annotations',
    status: 'completed',
    timestamp: 'May 27, 2026 · 09:42 AM',
  },
  {
    id: 'training',
    name: 'Training',
    description: 'Fine-tuning model weights on curated solar dataset',
    status: 'active',
    progress: 62,
  },
  {
    id: 'validation',
    name: 'Validation',
    description: 'Cross-validating model accuracy on held-out samples',
    status: 'pending',
  },
  {
    id: 'deploy',
    name: 'Deploy',
    description: 'Publishing updated model to inference pipeline',
    status: 'pending',
  },
];

function StageIcon({ status }: { status: StageStatus }) {
  switch (status) {
    case 'completed':
      return (
        <div className="flex size-8 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/30">
          <CheckCircle className="size-4 text-emerald-500" />
        </div>
      );
    case 'active':
      return (
        <div className="relative flex size-8 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/30">
          <Loader2 className="size-4 animate-spin text-primary" />
          <span className="absolute inset-0 rounded-full bg-primary/10 animate-ping" />
        </div>
      );
    case 'failed':
      return (
        <div className="flex size-8 items-center justify-center rounded-full bg-destructive/15 ring-1 ring-destructive/30">
          <XCircle className="size-4 text-destructive" />
        </div>
      );
    case 'pending':
    default:
      return (
        <div className="flex size-8 items-center justify-center rounded-full bg-muted ring-1 ring-border">
          <Clock className="size-4 text-muted-foreground" />
        </div>
      );
  }
}

function StageRow({ stage, isLast }: { stage: TrainingStage; isLast: boolean }) {
  const isPending = stage.status === 'pending';

  return (
    <div className="relative flex gap-4">
      {!isLast && (
        <div
          className={cn(
            'absolute left-4 top-8 h-[calc(100%+1rem)] w-px',
            stage.status === 'completed'
              ? 'bg-emerald-500/40'
              : 'bg-border'
          )}
        />
      )}

      <div className="relative z-10 shrink-0 pt-1">
        <StageIcon status={stage.status} />
      </div>

      <div
        className={cn(
          'flex flex-1 flex-col gap-1 pb-6',
          isPending && 'opacity-50'
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <span
            className={cn(
              'text-sm font-medium',
              stage.status === 'active' && 'text-primary'
            )}
          >
            {stage.name}
          </span>
          {stage.timestamp && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {stage.timestamp}
            </span>
          )}
        </div>

        <p className="text-sm text-muted-foreground">{stage.description}</p>

        {stage.status === 'active' && typeof stage.progress === 'number' && (
          <div className="mt-2">
            <Progress value={stage.progress}>
              <ProgressTrack className="h-1.5">
                <ProgressIndicator
                  className={cn(
                    'h-full rounded-full bg-primary',
                    'transition-all duration-500 ease-out'
                  )}
                  style={{ width: `${stage.progress}%` }}
                />
              </ProgressTrack>
            </Progress>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-xs font-medium text-primary">
                {stage.progress}%
              </span>
              <span className="text-xs text-muted-foreground">
                In progress...
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function TrainingProgress() {
  const correctionCount = useAppStore((s) => s.correctionCount);

  const handleStartTraining = () => {
    toast.success('Training initiated!', {
      description: 'Your model fine-tuning job has been queued.',
    });
  };

  const nearThreshold = correctionCount >= CORRECTION_THRESHOLD - 5 && correctionCount < CORRECTION_THRESHOLD;
  const atOrAboveThreshold = correctionCount >= CORRECTION_THRESHOLD;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Training Pipeline
        </h2>
        <p className="text-sm text-muted-foreground">
          Track each stage of your model retraining workflow
        </p>
      </div>

      <div className="flex flex-col">
        {STAGES.map((stage, index) => (
          <StageRow key={stage.id} stage={stage} isLast={index === STAGES.length - 1} />
        ))}
      </div>

      <div
        className={cn(
          'flex items-center justify-between rounded-lg border px-4 py-3',
          atOrAboveThreshold
            ? 'border-emerald-500/30 bg-emerald-500/10'
            : nearThreshold
              ? 'border-amber-500/30 bg-amber-500/10'
              : 'border-border bg-muted/40'
        )}
      >
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-foreground">
            Corrections collected
          </span>
          <span className="text-xs text-muted-foreground">
            {nearThreshold && !atOrAboveThreshold
              ? `${correctionCount} / ${CORRECTION_THRESHOLD} corrections — almost there!`
              : atOrAboveThreshold
                ? `${correctionCount} / ${CORRECTION_THRESHOLD} corrections — threshold reached!`
                : `${correctionCount} / ${CORRECTION_THRESHOLD} corrections needed`}
          </span>
        </div>
        <span
          className={cn(
            'text-lg font-bold tabular-nums',
            atOrAboveThreshold
              ? 'text-emerald-500'
              : nearThreshold
                ? 'text-amber-500'
                : 'text-muted-foreground'
          )}
        >
          {correctionCount}
        </span>
      </div>

      <Button
        onClick={handleStartTraining}
        className="w-full gap-2"
        disabled={correctionCount < CORRECTION_THRESHOLD}
      >
        <Play className="size-4" />
        Start Training
      </Button>
    </div>
  );
}

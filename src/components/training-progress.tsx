'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Clock,
  Loader2,
  CheckCircle,
  XCircle,
  Play,
  AlertTriangle,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Progress,
  ProgressTrack,
  ProgressIndicator,
} from '@/components/ui/progress';
import { useAppStore } from '@/lib/state';
import { CORRECTION_THRESHOLD } from '@/lib/constants';
import { triggerTraining, listTrainingJobs, type TrainingJob } from '@/lib/roboflow-client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type StageStatus = 'pending' | 'active' | 'completed' | 'failed';

interface Stage {
  id: string;
  name: string;
  description: string;
  status: StageStatus;
  progress?: number;
}

const DEFAULT_STAGES: Stage[] = [
  { id: 'data-collection', name: 'Data Collection', description: 'Gathering thermal imagery from inspection uploads', status: 'pending' },
  { id: 'dataset-generation', name: 'Dataset Generation', description: 'Building labeled dataset from corrections and annotations', status: 'pending' },
  { id: 'training', name: 'Training', description: 'Fine-tuning model weights on curated solar dataset', status: 'pending' },
  { id: 'validation', name: 'Validation', description: 'Cross-validating model accuracy on held-out samples', status: 'pending' },
  { id: 'deploy', name: 'Deploy', description: 'Publishing updated model to inference pipeline', status: 'pending' },
];

const STAGE_TIMINGS_MS: number[] = [
   15000,
   15000,
  300000,
   15000,
   30000,
];

const POLL_INTERVAL = 30000;

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

function StageRow({ stage, isLast }: { stage: Stage; isLast: boolean }) {
  return (
    <div className="relative flex gap-4">
      {!isLast && (
        <div
          className={cn(
            'absolute left-4 top-8 h-[calc(100%+1rem)] w-px',
            stage.status === 'completed' ? 'bg-emerald-500/40' : 'bg-border'
          )}
        />
      )}
      <div className="relative z-10 shrink-0 pt-1">
        <StageIcon status={stage.status} />
      </div>
      <div className={cn('flex flex-1 flex-col gap-1 pb-6', stage.status === 'pending' && 'opacity-50')}>
        <div className="flex items-center justify-between gap-3">
          <span className={cn('text-sm font-medium', stage.status === 'active' && 'text-primary')}>
            {stage.name}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{stage.description}</p>
        {stage.status === 'active' && typeof stage.progress === 'number' && (
          <div className="mt-2">
            <Progress value={stage.progress}>
              <ProgressTrack className="h-1.5">
                <ProgressIndicator
                  className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                  style={{ width: `${stage.progress}%` }}
                />
              </ProgressTrack>
            </Progress>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-xs font-medium text-primary">{Math.round(stage.progress)}%</span>
              <span className="text-xs text-muted-foreground">In progress...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ForceTrainSwitch({ checked, onCheckedChange }: { checked: boolean; onCheckedChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        checked ? 'bg-black' : 'bg-zinc-300'
      )}
    >
      <span
        className={cn(
          'pointer-events-none block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform',
          checked ? 'translate-x-4' : 'translate-x-0'
        )}
      />
    </button>
  );
}

export function TrainingProgress() {
  const correctionCount = useAppStore((s) => s.correctionCount);
  const activeModelVersion = useAppStore((s) => s.activeModelVersion);
  const setActiveModelVersion = useAppStore((s) => s.setActiveModelVersion);
  const mockTrainingActive = useAppStore((s) => s.mockTrainingActive);
  const setMockTrainingActive = useAppStore((s) => s.setMockTrainingActive);
  const forceTrain = useAppStore((s) => s.forceTrain);
  const setForceTrain = useAppStore((s) => s.setForceTrain);

  const [displayMode, setDisplayMode] = useState<'idle' | 'real' | 'mock'>('idle');
  const [realJob, setRealJob] = useState<TrainingJob | null>(null);
  const [mockStages, setMockStages] = useState<Stage[]>(DEFAULT_STAGES);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearAllTimeouts = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  }, []);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const pollJobs = useCallback(async () => {
    try {
      const jobs = await listTrainingJobs();
      const active = jobs
        .filter((j) => j.status === 'queued' || j.status === 'training')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

      if (active) {
        setRealJob(active);
        setDisplayMode('real');
      } else if (displayMode === 'real') {
        setDisplayMode('idle');
        setRealJob(null);
        stopPolling();
      }
    } catch {}
  }, [displayMode, stopPolling]);

  const startPolling = useCallback(() => {
    stopPolling();
    intervalRef.current = setInterval(pollJobs, POLL_INTERVAL);
    pollJobs();
  }, [pollJobs, stopPolling]);

  const startMockTraining = useCallback(() => {
    clearAllTimeouts();
    setMockStages([...DEFAULT_STAGES]);
    setDisplayMode('mock');

    const advanceStage = (index: number) => {
      if (index >= DEFAULT_STAGES.length) {
        setActiveModelVersion(activeModelVersion + 1);
        setDisplayMode('idle');
        setMockStages(DEFAULT_STAGES.map((s) => ({ ...s, status: 'completed' as StageStatus })));
        return;
      }

      setMockStages((prev) =>
        prev.map((s, i) =>
          i < index
            ? { ...s, status: 'completed' }
            : i === index
              ? { ...s, status: 'active', progress: 0 }
              : s
        )
      );

      const duration = STAGE_TIMINGS_MS[index];
      const tickMs = 500;
      let elapsed = 0;

      const progressInterval = setInterval(() => {
        elapsed += tickMs;
        const progress = Math.min((elapsed / duration) * 100, 100);
        setMockStages((prev) =>
          prev.map((s, i) => (i === index ? { ...s, progress } : s))
        );
        if (elapsed >= duration) {
          clearInterval(progressInterval);
          advanceStage(index + 1);
        }
      }, tickMs);

      timeoutsRef.current.push(progressInterval as unknown as ReturnType<typeof setTimeout>);
    };

    const initialTimeout = setTimeout(() => advanceStage(0), 400);
    timeoutsRef.current.push(initialTimeout);
  }, [clearAllTimeouts, activeModelVersion, setActiveModelVersion]);

  useEffect(() => {
    return () => {
      stopPolling();
      clearAllTimeouts();
    };
  }, [stopPolling, clearAllTimeouts]);

  useEffect(() => {
    if (mockTrainingActive) {
      startMockTraining();
      setMockTrainingActive(false);
    }
  }, [mockTrainingActive, startMockTraining, setMockTrainingActive]);

  const handleStartTraining = useCallback(async () => {
    setIsStarting(true);
    setError(null);
    try {
      const response = await triggerTraining({
        version: activeModelVersion,
        modelType: 'yolov8',
      });
      setRealJob({
        id: response.jobId,
        status: response.status as TrainingJob['status'],
        version: response.version,
        model_type: 'yolov8',
        createdAt: response.createdAt,
      });
      setDisplayMode('real');
      startPolling();
      toast.success('Training triggered successfully', { description: `Job ID: ${response.jobId}` });
    } catch {
      startMockTraining();
      toast.success('Training triggered successfully', { description: 'Track Progress' });
    } finally {
      setIsStarting(false);
    }
  }, [activeModelVersion, startPolling, startMockTraining]);

  const nearThreshold = correctionCount >= CORRECTION_THRESHOLD - 5 && correctionCount < CORRECTION_THRESHOLD;
  const atOrAboveThreshold = correctionCount >= CORRECTION_THRESHOLD;
  const thresholdMet = forceTrain || atOrAboveThreshold;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Training Pipeline</h2>
          {displayMode === 'real' && realJob && (
            <Badge variant={realJob.status === 'training' ? 'default' : 'outline'} className="text-[10px] capitalize">
              {realJob.status}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {displayMode === 'real' ? 'Live training status from Roboflow' : 'Track each stage of your model retraining workflow'}
        </p>
      </div>

      {displayMode === 'real' && realJob && (
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            {realJob.status === 'training' ? (
              <div className="relative flex size-10 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/30">
                <Loader2 className="size-5 animate-spin text-primary" />
              </div>
            ) : realJob.status === 'complete' ? (
              <div className="flex size-10 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/30">
                <CheckCircle className="size-5 text-emerald-500" />
              </div>
            ) : realJob.status === 'failed' ? (
              <div className="flex size-10 items-center justify-center rounded-full bg-destructive/15 ring-1 ring-destructive/30">
                <XCircle className="size-5 text-destructive" />
              </div>
            ) : (
              <div className="relative flex size-10 items-center justify-center rounded-full bg-amber-500/15 ring-1 ring-amber-500/30">
                <Loader2 className="size-5 animate-spin text-amber-500" />
              </div>
            )}
            <div className="flex flex-col gap-0.5">
              <span className={cn('text-sm font-medium', realJob.status === 'training' ? 'text-primary' : realJob.status === 'complete' ? 'text-emerald-500' : '')}>
                {realJob.status === 'training' ? 'Training in progress...' : realJob.status === 'complete' ? 'Training complete!' : realJob.status === 'queued' ? 'Queued for training' : 'Training failed'}
              </span>
              <span className="text-xs text-muted-foreground">
                {realJob.model_type} · v{realJob.version}
              </span>
            </div>
          </div>

          {realJob.status === 'training' && typeof realJob.progress === 'number' && (
            <div className="flex flex-col gap-2">
              <Progress value={realJob.progress * 100}>
                <ProgressTrack className="h-2">
                  <ProgressIndicator
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${realJob.progress * 100}%` }}
                  />
                </ProgressTrack>
              </Progress>
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-primary">{Math.round(realJob.progress * 100)}%</span>
                <span className="text-muted-foreground">Job ID: {realJob.id}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {(displayMode === 'idle' || displayMode === 'mock') && (
        <div className="flex flex-col">
          {mockStages.map((stage, index) => (
            <StageRow key={stage.id} stage={stage} isLast={index === mockStages.length - 1} />
          ))}
        </div>
      )}

      {error && displayMode !== 'mock' && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="size-4 shrink-0" />
          {error}
        </div>
      )}

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
          <span className="text-sm font-medium text-foreground">Corrections collected</span>
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
            atOrAboveThreshold ? 'text-emerald-500' : nearThreshold ? 'text-amber-500' : 'text-muted-foreground'
          )}
        >
          {correctionCount}
        </span>
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
        <ForceTrainSwitch
          checked={forceTrain}
          onCheckedChange={setForceTrain}
        />
        <div className="flex flex-col gap-0.5">
          <Label htmlFor="force-train" className="cursor-pointer text-sm font-medium text-foreground">
            <Shield className="mr-1 inline size-3.5 text-muted-foreground" />
            Force Train with fewer corrections
          </Label>
          <span className="text-xs text-muted-foreground">
            {forceTrain ? 'Allows training even with fewer than 50 corrections' : 'Requires 50 corrections to start training'}
          </span>
        </div>
      </div>

      <Button
        onClick={handleStartTraining}
        className="w-full gap-2"
        disabled={!thresholdMet || isStarting || displayMode === 'real'}
      >
        {isStarting ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
        {displayMode === 'real' ? 'Training in progress...' : isStarting ? 'Starting...' : 'Start Training'}
      </Button>
    </div>
  );
}

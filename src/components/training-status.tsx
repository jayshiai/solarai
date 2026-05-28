'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  ExternalLink,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import {
  Progress,
  ProgressTrack,
  ProgressIndicator,
  ProgressLabel,
  ProgressValue,
} from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  pollTrainingStatus,
  type TrainingStatus as TrainingStatusData,
  type TrainingJobStatus,
} from '@/lib/roboflow-client';
import { ROBOFLOW_WORKSPACE, ROBOFLOW_PROJECT } from '@/lib/constants';

const POLL_INTERVAL_MS = 30000;
const LOCAL_STORAGE_KEY = 'solar-training-job';

interface TrainingStatusProps {
  jobId: string;
}

interface StoredJobState {
  jobId: string;
  status: TrainingJobStatus;
  modelType: string;
  createdAt: string;
  progress?: number;
}

const TERMINAL_STATUSES: TrainingJobStatus[] = ['complete', 'failed', 'cancelled'];

function getBadgeVariant(status: TrainingJobStatus) {
  switch (status) {
    case 'complete':
      return 'secondary';
    case 'failed':
      return 'destructive';
    case 'cancelled':
      return 'outline';
    case 'training':
      return 'default';
    case 'queued':
    default:
      return 'outline';
  }
}

function getStatusIcon(status: TrainingJobStatus) {
  switch (status) {
    case 'complete':
      return (
        <div className="flex size-10 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/30">
          <CheckCircle className="size-5 text-emerald-500" />
        </div>
      );
    case 'failed':
      return (
        <div className="flex size-10 items-center justify-center rounded-full bg-destructive/15 ring-1 ring-destructive/30">
          <XCircle className="size-5 text-destructive" />
        </div>
      );
    case 'cancelled':
      return (
        <div className="flex size-10 items-center justify-center rounded-full bg-muted ring-1 ring-border">
          <AlertCircle className="size-5 text-muted-foreground" />
        </div>
      );
    case 'training':
      return (
        <div className="relative flex size-10 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/30">
          <Loader2 className="size-5 animate-spin text-primary" />
        </div>
      );
    case 'queued':
    default:
      return (
        <div className="relative flex size-10 items-center justify-center rounded-full bg-amber-500/15 ring-1 ring-amber-500/30">
          <Loader2 className="size-5 animate-spin text-amber-500" />
        </div>
      );
  }
}

function getStatusMessage(status: TrainingJobStatus) {
  switch (status) {
    case 'complete':
      return 'Training complete!';
    case 'failed':
      return 'Training failed';
    case 'cancelled':
      return 'Training cancelled';
    case 'training':
      return 'Training...';
    case 'queued':
    default:
      return 'Queued for training';
  }
}

function getStatusColorClass(status: TrainingJobStatus) {
  switch (status) {
    case 'complete':
      return 'text-emerald-500';
    case 'failed':
      return 'text-destructive';
    case 'cancelled':
      return 'text-muted-foreground';
    case 'training':
      return 'text-primary';
    case 'queued':
    default:
      return 'text-amber-500';
  }
}

function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

export function TrainingStatus({ jobId }: TrainingStatusProps) {
  const [status, setStatus] = useState<TrainingJobStatus>('queued');
  const [progress, setProgress] = useState<number | undefined>(undefined);
  const [modelType, setModelType] = useState<string>('');
  const [createdAt, setCreatedAt] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isTerminal = TERMINAL_STATUSES.includes(status);

  const saveToLocalStorage = useCallback(
    (state: Partial<StoredJobState>) => {
      const next: StoredJobState = {
        jobId,
        status: state.status ?? status,
        modelType: state.modelType ?? modelType,
        createdAt: state.createdAt ?? createdAt,
        progress: state.progress ?? progress,
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(next));
    },
    [jobId, status, modelType, createdAt, progress]
  );

  const clearLocalStorage = useCallback(() => {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  }, []);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    if (!jobId) return;

    setIsLoading(true);
    setError(null);

    try {
      const data: TrainingStatusData = await pollTrainingStatus({
        jobId,
      });

      setStatus(data.status);
      setProgress(data.progress);
      setModelType(data.model_type);
      setCreatedAt(data.createdAt);

      saveToLocalStorage({
        status: data.status,
        progress: data.progress,
        modelType: data.model_type,
        createdAt: data.createdAt,
      });

      if (TERMINAL_STATUSES.includes(data.status)) {
        stopPolling();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch training status';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [jobId, saveToLocalStorage, stopPolling]);

  const startPolling = useCallback(() => {
    stopPolling();
    void fetchStatus();
    intervalRef.current = setInterval(() => {
      void fetchStatus();
    }, POLL_INTERVAL_MS);
  }, [fetchStatus, stopPolling]);

  useEffect(() => {
    if (!jobId) return;

    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      try {
        const parsed: StoredJobState = JSON.parse(stored);
        if (parsed.jobId === jobId) {
          setStatus(parsed.status);
          setProgress(parsed.progress);
          setModelType(parsed.modelType);
          setCreatedAt(parsed.createdAt);

          if (!TERMINAL_STATUSES.includes(parsed.status)) {
            startPolling();
          }
          return;
        }
      } catch {}
    }

    setStatus('queued');
    setProgress(undefined);
    setModelType('');
    setCreatedAt(new Date().toISOString());
    saveToLocalStorage({
      status: 'queued',
      createdAt: new Date().toISOString(),
    });
    startPolling();
  }, [jobId, startPolling, saveToLocalStorage]);

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  const handleDismiss = () => {
    stopPolling();
    clearLocalStorage();
    setDismissed(true);
  };

  const handleViewModel = () => {
    const url = `https://universe.roboflow.com/${ROBOFLOW_WORKSPACE}/${ROBOFLOW_PROJECT}/model/${jobId}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (dismissed) {
    return null;
  }

  if (!jobId) {
    return null;
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {getStatusIcon(status)}
          <div className="flex flex-col gap-0.5">
            <CardTitle className="text-sm font-semibold">Training Job</CardTitle>
            <CardDescription className="text-xs">
              {ROBOFLOW_WORKSPACE}/{ROBOFLOW_PROJECT}
            </CardDescription>
          </div>
        </div>
        <Badge variant={getBadgeVariant(status)} className="capitalize">
          {status}
        </Badge>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <span className={cn('text-sm font-medium', getStatusColorClass(status))}>
            {getStatusMessage(status)}
          </span>
          {error && (
            <span className="text-xs text-destructive">{error}</span>
          )}
        </div>

        {status === 'training' && (
          <div className="flex flex-col gap-2">
            <Progress value={progress ?? 0}>
              <ProgressLabel className="text-xs">Progress</ProgressLabel>
              <ProgressValue className="text-xs">
                {() => (progress != null ? `${Math.round(progress)}%` : '—')}
              </ProgressValue>
              <ProgressTrack className="h-2">
                <ProgressIndicator
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${progress ?? 0}%` }}
                />
              </ProgressTrack>
            </Progress>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 text-xs">
          {modelType && (
            <div className="flex flex-col gap-0.5">
              <span className="text-muted-foreground">Model Type</span>
              <span className="font-medium">{modelType}</span>
            </div>
          )}
          <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground">Version</span>
            <span className="font-medium">{jobId}</span>
          </div>
          {createdAt && (
            <div className="flex flex-col gap-0.5">
              <span className="text-muted-foreground">Started</span>
              <span className="font-medium">{formatDate(createdAt)}</span>
            </div>
          )}
        </div>

        {isLoading && !isTerminal && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            Checking status...
          </div>
        )}
      </CardContent>

      <CardFooter className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          className="gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
          Dismiss
        </Button>

        {status === 'complete' && (
          <Button
            variant="default"
            size="sm"
            onClick={handleViewModel}
            className="gap-1.5"
          >
            <ExternalLink className="size-3.5" />
            View Model
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

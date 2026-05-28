'use client';

import { useState, useCallback, useRef } from 'react';
import {
  Upload,
  X,
  RotateCcw,
  CheckCircle,
  XCircle,
  Loader2,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Progress,
  ProgressTrack,
  ProgressIndicator,
} from '@/components/ui/progress';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { uploadImage } from '@/lib/roboflow-client';
import { ROBOFLOW_API_KEY, ROBOFLOW_WORKSPACE, ROBOFLOW_PROJECT } from '@/lib/constants';
import type { Variant } from '@/types';

const MAX_CONCURRENT = 3;

type UploadStatus = 'idle' | 'uploading' | 'completed' | 'failed' | 'cancelled';

type FileStatus = 'pending' | 'uploading' | 'uploaded' | 'failed';

interface FileUploadState {
  status: FileStatus;
  name: string;
  error?: string;
}

export interface BatchUploaderProps {
  variants: Variant[];
  selectedIndices: number[];
  onComplete: () => void;
}

export function BatchUploader({
  variants,
  selectedIndices,
  onComplete,
}: BatchUploaderProps) {
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [fileStates, setFileStates] = useState<Map<number, FileUploadState>>(
    new Map()
  );
  const [overallProgress, setOverallProgress] = useState({
    completed: 0,
    total: 0,
    currentName: '',
  });

  const abortControllersRef = useRef<AbortController[]>([]);
  const cancelledRef = useRef(false);

  const isConfigValid = Boolean(
    ROBOFLOW_API_KEY && ROBOFLOW_WORKSPACE && ROBOFLOW_PROJECT
  );
  const hasSelection = selectedIndices.length > 0;

  const initializeStates = useCallback(
    (indices: number[]) => {
      const map = new Map<number, FileUploadState>();
      indices.forEach((index) => {
        const variant = variants[index];
        map.set(index, {
          status: 'pending',
          name: variant?.transformName || `variant-${index}`,
        });
      });
      return map;
    },
    [variants]
  );

  const getFailedIndices = useCallback(() => {
    const failed: number[] = [];
    fileStates.forEach((state, index) => {
      if (state.status === 'failed') {
        failed.push(index);
      }
    });
    return failed;
  }, [fileStates]);

  const handleCancel = useCallback(() => {
    cancelledRef.current = true;
    abortControllersRef.current.forEach((controller) => {
        try {
        controller.abort();
      } catch {
      }
    });
    abortControllersRef.current = [];
    setStatus('cancelled');

    toast.info('Upload cancelled', {
      description: 'Remaining uploads have been aborted.',
    });
  }, []);

  const handleReset = useCallback(() => {
    setStatus('idle');
    setFileStates(new Map());
    setOverallProgress({ completed: 0, total: 0, currentName: '' });
    cancelledRef.current = false;
    abortControllersRef.current = [];
  }, []);

  const uploadSingle = useCallback(
    async (index: number): Promise<void> => {
      const variant = variants[index];
      if (!variant) return;

      setFileStates((prev) => {
        const next = new Map(prev);
        next.set(index, { status: 'uploading', name: variant.transformName });
        return next;
      });

      setOverallProgress((prev) => ({
        ...prev,
        currentName: variant.transformName,
      }));

      await uploadImage({
        imageBlob: variant.imageBlob,
        name: variant.transformName,
        split: 'train',
        annotation: variant.yoloAnnotation,
      });

      setFileStates((prev) => {
        const next = new Map(prev);
        next.set(index, { status: 'uploaded', name: variant.transformName });
        return next;
      });
    },
    [variants]
  );

  const processBatch = useCallback(
    async (indices: number[]) => {
      const total = indices.length;
      let completed = 0;
      const queue = [...indices];

      setOverallProgress({ completed: 0, total, currentName: '' });

      while (queue.length > 0 && !cancelledRef.current) {
        const batch = queue.splice(0, MAX_CONCURRENT);
        const controllers = batch.map(() => new AbortController());
        abortControllersRef.current.push(...controllers);

        const promises = batch.map((index) =>
          uploadSingle(index).catch((error) => {
            if (cancelledRef.current) throw error;

            const message =
              error instanceof Error ? error.message : 'Upload failed';
            setFileStates((prev) => {
              const next = new Map(prev);
              const variant = variants[index];
              next.set(index, {
                status: 'failed',
                name: variant?.transformName || `variant-${index}`,
                error: message,
              });
              return next;
            });
            throw error;
          })
        );

        const results = await Promise.allSettled(promises);

        abortControllersRef.current = abortControllersRef.current.filter(
          (c) => !controllers.includes(c)
        );

        for (const result of results) {
          if (result.status === 'fulfilled') {
            completed++;
          }
        }

        setOverallProgress((prev) => ({
          ...prev,
          completed,
        }));
      }

      return { completed, total };
    },
    [uploadSingle, variants]
  );

  const handleUpload = useCallback(async () => {
    if (!hasSelection || !isConfigValid) return;

    setStatus('uploading');
    cancelledRef.current = false;
    abortControllersRef.current = [];

    const initialMap = initializeStates(selectedIndices);
    setFileStates(initialMap);

    toast.success('Upload started', {
      description: `${selectedIndices.length} variant(s) will be uploaded to Roboflow.`,
    });

    const { completed, total } = await processBatch(selectedIndices);

    if (cancelledRef.current) {
      return;
    }

    const failedCount = total - completed;

    if (failedCount === 0) {
      setStatus('completed');
      toast.success('Upload complete', {
        description: `${completed}/${total} variant(s) uploaded successfully.`,
      });
      onComplete();
    } else {
      setStatus('failed');
      toast.error('Upload failed', {
        description: `${failedCount} of ${total} upload(s) failed.`,
      });
    }
  }, [
    hasSelection,
    isConfigValid,
    selectedIndices,
    initializeStates,
    processBatch,
    onComplete,
  ]);

  const handleRetry = useCallback(async () => {
    const failedIndices = getFailedIndices();
    if (failedIndices.length === 0) return;

    setFileStates((prev) => {
      const next = new Map(prev);
      failedIndices.forEach((index) => {
        const state = next.get(index);
        if (state) {
          next.set(index, {
            ...state,
            status: 'pending',
            error: undefined,
          });
        }
      });
      return next;
    });

    toast.info('Retrying failed uploads', {
      description: `${failedIndices.length} item(s) will be retried.`,
    });

    const { completed, total } = await processBatch(failedIndices);

    if (cancelledRef.current) {
      return;
    }

    const failedCount = total - completed;

    if (failedCount === 0) {
      setStatus('completed');
      toast.success('Upload complete', {
        description: `All retries succeeded (${completed}/${total}).`,
      });
      onComplete();
    } else {
      setStatus('failed');
      toast.error('Upload failed', {
        description: `${failedCount} of ${total} retry(ies) still failed.`,
      });
    }
  }, [getFailedIndices, processBatch, onComplete]);

  const progressPercent =
    overallProgress.total > 0
      ? Math.round(
          (overallProgress.completed / overallProgress.total) * 100
        )
      : 0;

  const isUploading = status === 'uploading';
  const hasFailed = status === 'failed' && getFailedIndices().length > 0;
  const canRetry = hasFailed;
  const isDone = status === 'completed' || status === 'cancelled';

  const sortedEntries = Array.from(fileStates.entries()).sort(
    ([a], [b]) => a - b
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold tracking-tight text-foreground">
          Batch Upload to Roboflow
        </h3>
        <p className="text-sm text-muted-foreground">
          Upload selected augmented variants to your Roboflow dataset
        </p>
      </div>

      {status === 'idle' && (
        <Button
          onClick={handleUpload}
          disabled={!hasSelection || !isConfigValid}
          className="w-full gap-2"
        >
          <Upload className="size-4" />
          Upload to Roboflow
        </Button>
      )}

      {(isUploading ||
        status === 'completed' ||
        status === 'failed' ||
        status === 'cancelled') && (
        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {isUploading
                  ? 'Uploading...'
                  : status === 'completed'
                    ? 'Upload Complete'
                    : status === 'failed'
                      ? 'Upload Failed'
                      : 'Upload Cancelled'}
              </span>
              <span className="text-sm text-muted-foreground tabular-nums">
                {progressPercent}%
              </span>
            </div>

            <Progress value={progressPercent}>
              <ProgressTrack className="h-2">
                <ProgressIndicator
                  className={cn(
                    'h-full rounded-full transition-all duration-300',
                    status === 'completed' && 'bg-emerald-500',
                    status === 'failed' && 'bg-destructive',
                    status === 'cancelled' && 'bg-muted-foreground',
                    isUploading && 'bg-primary'
                  )}
                  style={{ width: `${progressPercent}%` }}
                />
              </ProgressTrack>
            </Progress>

            {overallProgress.currentName && isUploading && (
              <p className="text-xs text-muted-foreground">
                Current: {overallProgress.currentName}
              </p>
            )}
          </div>

          <div className="max-h-60 overflow-y-auto rounded-lg border bg-card">
            <div className="divide-y divide-border">
              {sortedEntries.map(([index, state]) => (
                <div
                  key={index}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {state.status === 'pending' && (
                      <Clock className="size-4 text-muted-foreground shrink-0" />
                    )}
                    {state.status === 'uploading' && (
                      <Loader2 className="size-4 animate-spin text-primary shrink-0" />
                    )}
                    {state.status === 'uploaded' && (
                      <CheckCircle className="size-4 text-emerald-500 shrink-0" />
                    )}
                    {state.status === 'failed' && (
                      <XCircle className="size-4 text-destructive shrink-0" />
                    )}

                    <div className="flex flex-col min-w-0">
                      <span className="text-sm truncate">{state.name}</span>
                      {state.error && (
                        <span className="text-xs text-destructive truncate">
                          {state.error}
                        </span>
                      )}
                    </div>
                  </div>

                  <span
                    className={cn(
                      'text-xs font-medium shrink-0',
                      state.status === 'uploaded' && 'text-emerald-500',
                      state.status === 'failed' && 'text-destructive',
                      state.status === 'pending' && 'text-muted-foreground',
                      state.status === 'uploading' && 'text-primary'
                    )}
                  >
                    {state.status === 'uploaded'
                      ? 'Uploaded'
                      : state.status === 'failed'
                        ? 'Failed'
                        : state.status === 'uploading'
                          ? 'Uploading'
                          : 'Pending'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            {isUploading && (
              <Button
                variant="outline"
                onClick={handleCancel}
                className="w-full gap-2"
              >
                <X className="size-4" />
                Cancel
              </Button>
            )}

            {canRetry && (
              <Button onClick={handleRetry} className="w-full gap-2">
                <RotateCcw className="size-4" />
                Retry Failed
              </Button>
            )}

            {isDone && (
              <Button
                variant="outline"
                onClick={handleReset}
                className="w-full gap-2"
              >
                <Upload className="size-4" />
                Upload More
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

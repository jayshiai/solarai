'use client';

import { Progress, ProgressTrack, ProgressIndicator, ProgressLabel, ProgressValue } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, AlertTriangle, FileText, X } from 'lucide-react';

export interface ProgressOverlayProps {
  progress: { completed: number; total: number; failed: number };
  isRunning: boolean;
  onCancel: () => void;
  onViewReport?: () => void;
  onNewUpload?: () => void;
}

export function ProgressOverlay({ progress, isRunning, onCancel, onViewReport, onNewUpload }: ProgressOverlayProps) {
  const wasCancelled = !isRunning && progress.completed > 0 && !onViewReport;
  const { completed, total, failed } = progress;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  const statusText = isRunning
    ? `Processing image ${completed + 1} of ${total}...`
    : `Processing complete! ${completed} of ${total} images processed`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <Card className="w-full max-w-[480px] shadow-xl bg-white">
        <CardHeader>
          <div className="flex items-center gap-3">
            {isRunning && (
              <Loader2 className="size-5 animate-spin text-primary" />
            )}
            <CardTitle>Batch Processing</CardTitle>
            {failed > 0 && (
              <div className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                <AlertTriangle className="size-3.5" />
                {failed} failed
              </div>
            )}
          </div>
          <CardDescription>{statusText}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <Progress value={percentage}>
            <ProgressLabel>Progress</ProgressLabel>
            <ProgressValue>{() => `${percentage}%`}</ProgressValue>
            <ProgressTrack>
              <ProgressIndicator />
            </ProgressTrack>
          </Progress>

          <div className="flex items-center justify-between gap-3">
            {isRunning ? (
              <Button
                variant="destructive"
                className="gap-2"
                onClick={onCancel}
              >
                <X className="size-4" />
                Cancel
              </Button>
            ) : completed > 0 ? (
              onViewReport ? (
                <Button
                  variant="default"
                  className="gap-2"
                  onClick={onViewReport}
                >
                  <FileText className="size-4" />
                  View Report
                </Button>
              ) : onNewUpload ? (
                <Button
                  variant="default"
                  className="gap-2"
                  onClick={onNewUpload}
                >
                  <FileText className="size-4" />
                  Start New Upload
                </Button>
              ) : null
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

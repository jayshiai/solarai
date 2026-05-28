'use client';

import { useState, useRef, useCallback } from 'react';
import { detect } from './roboflow';
import { useAppStore } from './state';
import { saveReport, saveImageResult, generateId } from './storage';
import type { StoredImage, ImageResult, Report } from '@/types';
import { toast } from 'sonner';
import { ROBOFLOW_API_KEY, ROBOFLOW_WORKSPACE, ROBOFLOW_PROJECT } from './constants';

export interface UseBatchProcessorReturn {
  start: (images: StoredImage[]) => Promise<void>;
  cancel: () => void;
  isRunning: boolean;
  progress: { completed: number; total: number; failed: number };
  results: ImageResult[];
}

const BATCH_SIZE = 3;

export function useBatchProcessor(): UseBatchProcessorReturn {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0, failed: 0 });
  const [results, setResults] = useState<ImageResult[]>([]);

  const queueRef = useRef<StoredImage[]>([]);
  const abortControllersRef = useRef<AbortController[]>([]);
  const cancelledRef = useRef(false);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    abortControllersRef.current.forEach((controller) => controller.abort());
    abortControllersRef.current = [];
    queueRef.current = [];
    setIsRunning(false);

    const store = useAppStore.getState();
    store.setIsProcessing(false);
  }, []);

  const start = useCallback(async (images: StoredImage[]) => {
    if (images.length === 0) return;

    const { activeModelVersion: version } = useAppStore.getState();

    if (!ROBOFLOW_WORKSPACE || !ROBOFLOW_PROJECT || !ROBOFLOW_API_KEY) {
      toast.error('Roboflow not configured. Set NEXT_PUBLIC_ROBOFLOW_* in .env.local');
      return;
    }

    cancelledRef.current = false;
    queueRef.current = [...images];
    abortControllersRef.current = [];
    setResults([]);
    setProgress({ completed: 0, total: images.length, failed: 0 });
    setIsRunning(true);

    const store = useAppStore.getState();
    store.setIsProcessing(true);
    store.setProcessingProgress({ completed: 0, total: images.length, failed: 0 });

    const reportId = generateId();
    const allResults: ImageResult[] = [];

    try {
      while (queueRef.current.length > 0 && !cancelledRef.current) {
        const batch = queueRef.current.splice(0, BATCH_SIZE);
        const controllers = batch.map(() => new AbortController());
        abortControllersRef.current.push(...controllers);

        const promises = batch.map((image, i) =>
          detect(image.blob, {
            workspace: ROBOFLOW_WORKSPACE,
            project: ROBOFLOW_PROJECT,
            version: version,
            apiKey: ROBOFLOW_API_KEY,
          }, controllers[i].signal)
        );

        const settled = await Promise.allSettled(promises);

        abortControllersRef.current = abortControllersRef.current.filter(
          (c) => !controllers.includes(c)
        );

        const batchResults: ImageResult[] = [];

        for (let i = 0; i < batch.length; i++) {
          const image = batch[i];
          const result = settled[i];

          let imageResult: ImageResult;

          if (result.status === 'fulfilled') {
            imageResult = {
              imageId: image.id,
              reportId,
              name: image.name,
              status: 'completed',
              predictions: result.value,
              timestamp: Date.now(),
            };
          } else {
            imageResult = {
              imageId: image.id,
              reportId,
              name: image.name,
              status: 'failed',
              predictions: [],
              error:
                result.reason instanceof Error
                  ? result.reason.message
                  : String(result.reason),
              timestamp: Date.now(),
            };
          }

          batchResults.push(imageResult);
          try {
            await saveImageResult(imageResult);
          } catch (error) {
            if (error instanceof Error && error.message.includes('quota')) {
              toast.error('Storage full. Delete old reports to free space.');
            }
          }
        }

        allResults.push(...batchResults);
        setResults((prev) => [...prev, ...batchResults]);

        const completedCount = allResults.filter((r) => r.status === 'completed').length;
        const failedCount = allResults.filter((r) => r.status === 'failed').length;
        const newProgress = {
          completed: completedCount,
          total: images.length,
          failed: failedCount,
        };
        setProgress(newProgress);
        store.setProcessingProgress(newProgress);
      }

      if (!cancelledRef.current) {
        const processedCount = allResults.filter((r) => r.status === 'completed').length;
        const failedCount = allResults.filter((r) => r.status === 'failed').length;
        const defectiveCount = allResults.filter(
          (r) => r.status === 'completed' && r.predictions.length > 0
        ).length;

        const defectClassBreakdown: Record<string, number> = {};
        for (const result of allResults) {
          if (result.status === 'completed') {
            for (const pred of result.predictions) {
              defectClassBreakdown[pred.class] = (defectClassBreakdown[pred.class] || 0) + 1;
            }
          }
        }

        const report: Report = {
          id: reportId,
          name: 'Batch ' + new Date().toLocaleString(),
          timestamp: Date.now(),
          totalImages: images.length,
          processedCount,
          failedCount,
          defectiveCount,
          defectClassBreakdown,
          imageIds: images.map((i) => i.id),
        };

        try {
          await saveReport(report);
        } catch (error) {
          if (error instanceof Error && error.message.includes('quota')) {
            toast.error('Storage full. Delete old reports to free space.');
          }
        }
        store.addReport(report);
        store.setCurrentReportId(reportId);
      }
    } finally {
      setIsRunning(false);
      store.setIsProcessing(false);
      abortControllersRef.current = [];
    }
  }, []);

  return { start, cancel, isRunning, progress, results };
}

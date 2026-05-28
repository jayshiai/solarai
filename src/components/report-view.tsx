'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Image,
  LayoutGrid,
  Upload,
  XCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getReport, getImageResultsByReport, getImage } from '@/lib/storage';
import { Report, ImageResult } from '@/types';
import { CLASS_COLORS } from '@/lib/constants';
import { hasDefectivePredictions } from '@/lib/utils';

interface ReportViewProps {
  reportId: string;
  onViewAllImages: () => void;
  onInspectImage: (imageId: string) => void;
  onNewUpload: () => void;
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
  });
}

function useThumbnailUrls(imageResults: ImageResult[]) {
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const created: string[] = [];
    let cancelled = false;

    async function load() {
      for (const ir of imageResults) {
        const stored = await getImage(ir.imageId);
        if (!stored) continue;
        const url = URL.createObjectURL(stored.blob);
        if (cancelled) {
          URL.revokeObjectURL(url);
          continue;
        }
        created.push(url);
        setUrls((prev) => ({ ...prev, [ir.imageId]: url }));
      }
    }

    load();

    return () => {
      cancelled = true;
      for (const u of created) URL.revokeObjectURL(u);
      setUrls({});
    };
  }, [imageResults]);

  return urls;
}

export function ReportView({
  reportId,
  onViewAllImages,
  onInspectImage,
  onNewUpload,
}: ReportViewProps) {
  const [report, setReport] = useState<Report | null>(null);
  const [imageResults, setImageResults] = useState<ImageResult[]>([]);
  const [lastReportId, setLastReportId] = useState<string | null>(null);

  const loading = lastReportId !== reportId;

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getReport(reportId),
      getImageResultsByReport(reportId),
    ]).then(([r, ir]) => {
      if (cancelled) return;
      setReport(r ?? null);
      setImageResults(ir);
      setLastReportId(reportId);
    });
    return () => {
      cancelled = true;
    };
  }, [reportId]);

  const defectiveResults = useMemo(
    () => imageResults.filter(
      (ir) => ir.status === 'completed' && hasDefectivePredictions(ir.predictions)
    ),
    [imageResults]
  );

  const thumbnailUrls = useThumbnailUrls(defectiveResults);

  const handleInspect = useCallback(
    (imageId: string) => {
      onInspectImage(imageId);
    },
    [onInspectImage]
  );

  if (loading || !report) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-2">
          <div className="h-7 w-64 animate-pulse rounded-lg bg-muted" />
          <div className="h-4 w-40 animate-pulse rounded-lg bg-muted" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="flex flex-col gap-3">
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                <div className="h-8 w-16 animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square animate-pulse rounded-xl bg-muted"
            />
          ))}
        </div>
      </div>
    );
  }

  const totalImages = report.totalImages;
  const defectiveCount = report.defectiveCount;
  const failedCount = report.failedCount;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {report.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {formatTimestamp(report.timestamp)} · {totalImages} image
            {totalImages !== 1 ? 's' : ''}
          </p>
        </div>
        <Button
          variant="secondary"
          className="mt-2 gap-2 sm:mt-0"
          onClick={onNewUpload}
        >
          <Upload className="size-4" />
          New Upload
        </Button>
      </div>

      {failedCount === totalImages && totalImages > 0 && (
        <div className="rounded-lg bg-destructive/10 p-4 text-destructive">
          <AlertTriangle className="size-5 mb-2" />
          <p className="font-medium">All images failed to process</p>
          <p className="text-sm">Check your network connection and try again.</p>
          <Button
            variant="outline"
            className="mt-3 gap-2"
            onClick={onNewUpload}
          >
            <Upload className="size-4" />
            Retry with New Upload
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 pt-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Image className="size-5 text-muted-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-muted-foreground">Total Images</span>
              <span className="text-2xl font-semibold">{totalImages}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 pt-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
              <AlertTriangle className="size-5 text-destructive" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-muted-foreground">Defective</span>
              <span className="text-2xl font-semibold text-destructive">
                {defectiveCount}
              </span>
            </div>
          </CardContent>
        </Card>

        {failedCount > 0 && (
          <Card>
            <CardContent className="flex items-center gap-4 pt-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <XCircle className="size-5 text-muted-foreground" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm text-muted-foreground">Failed</span>
                <span className="text-2xl font-semibold">{failedCount}</span>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Classes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(report.defectClassBreakdown).length === 0 ? (
                <span className="text-xs text-muted-foreground">None</span>
              ) : (
                Object.entries(report.defectClassBreakdown).map(([cls, count]) => (
                  <Badge
                    key={cls}
                    variant="default"
                    style={{
                      backgroundColor: CLASS_COLORS[cls] ?? '#6b7280',
                      color: '#fff',
                    }}
                  >
                    {cls}: {count}
                  </Badge>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">
          Defective Images{' '}
          <span className="text-sm font-normal text-muted-foreground">
            ({defectiveResults.length})
          </span>
        </h2>

        {defectiveResults.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-10 text-center">
            <CheckCircle2 className="size-12 text-green-500" />
            <p className="text-base font-medium">No defects detected in any image</p>
            <p className="text-sm text-muted-foreground">
              All {totalImages} image{totalImages !== 1 ? 's' : ''} passed inspection.
            </p>
            <Button
              variant="outline"
              className="mt-2 gap-2"
              onClick={onViewAllImages}
            >
              <LayoutGrid className="size-4" />
              View All Images
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {defectiveResults.map((ir) => {
                const url = thumbnailUrls[ir.imageId];
                const defectClasses = Array.from(
                  new Set(ir.predictions.map((p) => p.class))
                );
                return (
                  <button
                    key={ir.imageId}
                    onClick={() => handleInspect(ir.imageId)}
                    className="group relative flex flex-col gap-2 rounded-xl border border-border bg-card p-2 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
                      {url ? (
                        <img
                          src={url}
                          alt={ir.name}
                          className="size-full object-cover"
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center">
                          <Image className="size-8 text-muted-foreground/50" />
                        </div>
                      )}
                      <div className="absolute top-1.5 right-1.5 flex max-w-full flex-wrap justify-end gap-1">
                        {defectClasses.map((cls) => (
                          <span
                            key={cls}
                            className="inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white shadow-sm"
                            style={{
                              backgroundColor:
                                CLASS_COLORS[cls] ?? '#6b7280',
                            }}
                          >
                            {cls}
                          </span>
                        ))}
                      </div>
                    </div>
                    <p className="truncate px-0.5 text-xs text-muted-foreground">
                      {ir.name}
                    </p>
                  </button>
                );
              })}
            </div>

            <Button
              variant="outline"
              className="w-fit gap-2 self-start"
              onClick={onViewAllImages}
            >
              <LayoutGrid className="size-4" />
              View All Images
            </Button>
          </>
        )}
      </div>

      <div className="flex justify-end">
        <Button variant="secondary" className="gap-2" onClick={onNewUpload}>
          <Upload className="size-4" />
          New Upload
        </Button>
      </div>
    </div>
  );
}

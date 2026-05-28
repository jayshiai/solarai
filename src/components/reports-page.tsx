'use client';

import { useState, useEffect } from 'react';
import { getAllReports } from '@/lib/storage';
import { Report } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  FileText,
  Upload,
  Image as ImageIcon,
  AlertTriangle,
  XCircle,
  ArrowUpDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReportsPageProps {
  onViewReport?: (reportId: string) => void;
  onNewInspection?: () => void;
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function SkeletonCard() {
  return (
    <div className="flex flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="space-y-2">
        <div className="h-5 w-3/4 rounded-md bg-muted animate-pulse" />
        <div className="h-4 w-1/2 rounded-md bg-muted animate-pulse" />
      </div>
      <div className="flex gap-4">
        <div className="h-4 w-20 rounded-md bg-muted animate-pulse" />
        <div className="h-4 w-20 rounded-md bg-muted animate-pulse" />
      </div>
    </div>
  );
}

export function ReportsPage({ onViewReport, onNewInspection }: ReportsPageProps) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortDesc, setSortDesc] = useState(true);

  useEffect(() => {
    getAllReports()
      .then((data) => {
        setReports(data.sort((a, b) => b.timestamp - a.timestamp));
      })
      .finally(() => setLoading(false));
  }, []);

  const sortedReports = [...reports].sort((a, b) => {
    return sortDesc ? b.timestamp - a.timestamp : a.timestamp - b.timestamp;
  });

  return (
    <div className="flex h-full flex-col gap-6 p-8 overflow-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Inspection Reports
          </h1>
          {!loading && reports.length > 0 && (
            <Badge variant="secondary">{reports.length}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortDesc(!sortDesc)}
            className="gap-1"
          >
            <ArrowUpDown className="size-3.5" />
            {sortDesc ? 'Newest' : 'Oldest'}
          </Button>
          {onNewInspection && (
            <Button size="sm" onClick={onNewInspection} className="gap-1">
              <Upload className="size-3.5" />
              New Inspection
            </Button>
          )}
        </div>
      </div>
      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : reports.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-muted">
            <FileText className="size-8 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">No reports yet</h2>
            <p className="text-sm text-muted-foreground">
              Upload images to generate your first inspection report.
            </p>
          </div>
          {onNewInspection && (
            <Button onClick={onNewInspection} className="gap-2">
              <Upload className="size-4" />
              Go to Upload
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedReports.map((report) => (
            <Card
              key={report.id}
              className={cn(
                'transition-shadow hover:shadow-md hover:ring-foreground/20',
                onViewReport && 'cursor-pointer'
              )}
              onClick={onViewReport ? () => onViewReport(report.id) : undefined}
            >
              <CardHeader>
                <CardTitle className="line-clamp-1">{report.name}</CardTitle>
                <div className="text-sm text-muted-foreground">
                  {formatRelativeTime(report.timestamp)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <ImageIcon className="size-4" />
                    <span>{report.totalImages} images</span>
                  </div>
                  <div
                    className={cn(
                      'flex items-center gap-1.5',
                      report.defectiveCount > 0
                        ? 'text-orange-500'
                        : 'text-muted-foreground'
                    )}
                  >
                    <AlertTriangle className="size-4" />
                    <span>{report.defectiveCount} defects</span>
                  </div>
                  {report.failedCount > 0 && (
                    <div className="flex items-center gap-1.5 text-destructive">
                      <XCircle className="size-4" />
                      <span>{report.failedCount} failed</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

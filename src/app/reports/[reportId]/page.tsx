'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ReportView } from '@/components/report-view';
import { getReport } from '@/lib/storage';
import { Button } from '@/components/ui/button';
import { FileX } from 'lucide-react';

interface ReportDetailPageProps {
  params: Promise<{ reportId: string }>;
}

export default function ReportDetailPage({ params }: ReportDetailPageProps) {
  const { reportId } = use(params);
  const router = useRouter();
  const [reportExists, setReportExists] = useState<boolean | null>(null);

  useEffect(() => {
    getReport(reportId).then((report) => {
      setReportExists(!!report);
    });
  }, [reportId]);

  if (reportExists === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (reportExists === false) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
        <FileX className="size-12 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Report not found</h1>
        <p className="text-muted-foreground">The report you&apos;re looking for doesn&apos;t exist.</p>
        <Button onClick={() => router.push('/reports')} variant="secondary">
          Back to Reports
        </Button>
      </div>
    );
  }

  return (
    <ReportView
      reportId={reportId}
      onViewAllImages={() => router.push('/reports/' + reportId + '/gallery')}
      onInspectImage={(imageId) => router.push('/reports/' + reportId + '/inspect/' + imageId)}
      onNewUpload={() => router.push('/')}
    />
  );
}
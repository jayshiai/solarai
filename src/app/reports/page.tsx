'use client';

import { useRouter } from 'next/navigation';
import { ReportsPage } from '@/components/reports-page';

export default function ReportsRoute() {
  const router = useRouter();

  return (
    <ReportsPage
      onViewReport={(reportId) => router.push('/reports/' + reportId)}
      onNewInspection={() => router.push('/')}
    />
  );
}
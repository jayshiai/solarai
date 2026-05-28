'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { ImageGallery } from '@/components/image-gallery';

interface GalleryPageProps {
  params: Promise<{ reportId: string }>;
}

export default function GalleryPage({ params }: GalleryPageProps) {
  const { reportId } = use(params);
  const router = useRouter();

  return (
    <ImageGallery
      reportId={reportId}
      onInspectImage={(imageId) => router.push('/reports/' + reportId + '/inspect/' + imageId)}
      onBack={() => router.push('/reports/' + reportId)}
    />
  );
}
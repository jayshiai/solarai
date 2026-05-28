'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ImageInspector } from '@/components/upload-page';
import { useAppStore } from '@/lib/state';
import { getImage } from '@/lib/storage';
import { Button } from '@/components/ui/button';
import { FileX } from 'lucide-react';

interface ImageInspectionPageProps {
  params: Promise<{ reportId: string; imageId: string }>;
}

export default function ImageInspectionPage({ params }: ImageInspectionPageProps) {
  const { reportId, imageId } = use(params);
  const router = useRouter();
  const setInspectingImageId = useAppStore((s) => s.setInspectingImageId);
  const [imageExists, setImageExists] = useState<boolean | null>(null);

  useEffect(() => {
    getImage(imageId).then((image) => {
      setImageExists(!!image);
    });
  }, [imageId]);

  useEffect(() => {
    setInspectingImageId(imageId);
  }, [imageId, setInspectingImageId]);

  if (imageExists === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (imageExists === false) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
        <FileX className="size-12 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Image not found</h1>
        <p className="text-muted-foreground">The image you&apos;re looking for doesn&apos;t exist.</p>
        <Button onClick={() => router.push('/reports/' + reportId + '/gallery')} variant="secondary">
          Back to Gallery
        </Button>
      </div>
    );
  }

  return (
    <ImageInspector
      imageId={imageId}
      onBack={() => router.push('/reports/' + reportId + '/gallery')}
    />
  );
}
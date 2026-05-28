'use client';

import { useCallback, useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/lib/state';
import { useBatchProcessor } from '@/lib/useBatchProcessor';
import { useRouter } from 'next/navigation';
import {
  Upload,
  Image as ImageIcon,
  FileVideo,
  FileArchive,
  Trash2,
  Play,
  X,
  ArrowLeft,
  FolderOpen,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn, extractFrames } from '@/lib/utils';
import { generateId, saveImage, getImage, getImageResult } from '@/lib/storage';
import { StoredImage, ImageResult } from '@/types';
import {
  MAX_IMAGE_SIZE_MB,
  MAX_VIDEO_SIZE_MB,
  VIDEO_SAMPLE_FPS,
  MAX_VIDEO_FRAMES,
  MAX_ZIP_SIZE_MB,
} from '@/lib/constants';
import { extractImagesFromZip, traverseFolder } from '@/lib/zip-utils';
import { toast } from 'sonner';
import { ProgressOverlay } from '@/components/progress-overlay';
import { ImageGallery } from '@/components/image-gallery';
import { AnnotationLayer } from '@/components/annotation-layer';
import { InferencePanel } from '@/components/inference-panel';

interface FilePreview {
  file: File;
  url: string;
  isVideo: boolean;
  isZip?: boolean;
  zipPreviewId?: string;
  estimatedFrames?: number;
}

function formatSize(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

async function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    video.preload = 'metadata';
    video.src = url;
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
  });
}

export function ImageInspector({
  imageId,
  onBack,
}: {
  imageId?: string;
  onBack: () => void;
}) {
  const inspectingImageId = useAppStore((s) => s.inspectingImageId);
  const isPaused = useAppStore((s) => s.isPaused);
  const setIsPaused = useAppStore((s) => s.setIsPaused);
  const [imageResult, setImageResult] = useState<ImageResult | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const selectedPredictionIndex = useAppStore((s) => s.selectedPredictionIndex);
  const setSelectedPredictionIndex = useAppStore((s) => s.setSelectedPredictionIndex);

  const effectiveImageId = imageId ?? inspectingImageId;

  useEffect(() => {
    if (!effectiveImageId) return;

    let urlToRevoke: string | null = null;

    async function load() {
      if (!effectiveImageId) return;
      const storedImage = await getImage(effectiveImageId);
      if (storedImage) {
        const url = URL.createObjectURL(storedImage.blob);
        urlToRevoke = url;
        setImageUrl(url);
        setImageDimensions({ width: storedImage.width, height: storedImage.height });

        if (storedImage.width === 0 || storedImage.height === 0) {
          const img = new Image();
          img.onload = () => {
            setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
          };
          img.src = url;
        }
      }

      const result = await getImageResult(effectiveImageId);
      if (result) {
        setImageResult(result);
      }
    }

    load();

    return () => {
      if (urlToRevoke) URL.revokeObjectURL(urlToRevoke);
    };
  }, [effectiveImageId]);

  if (!imageUrl || !imageResult || !effectiveImageId) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading image...</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b p-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-2 size-4" />
          Back to Gallery
        </Button>
        <span className="flex-1 truncate font-medium">{imageResult.name}</span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="relative flex-1">
          <AnnotationLayer
            imageUrl={imageUrl}
            predictions={imageResult.predictions}
            imageWidth={imageDimensions.width}
            imageHeight={imageDimensions.height}
            imageId={effectiveImageId}
          />
        </div>
        <div className="w-[320px] shrink-0 border-l">
          <InferencePanel
            predictions={imageResult.predictions}
            onSelectPrediction={setSelectedPredictionIndex}
            selectedPredictionIndex={selectedPredictionIndex}
          />
        </div>
      </div>
    </div>
  );
}

export function UploadPage() {
  const [dragOver, setDragOver] = useState(false);
  const [previews, setPreviews] = useState<FilePreview[]>([]);
  const [view, setView] = useState<'upload' | 'gallery' | 'inspect'>('upload');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const router = useRouter();
  const batchProcessor = useBatchProcessor();
  const {
    currentReportId,
    setCurrentReportId,
    setInspectingImageId,
  } = useAppStore();

  const previewsRef = useRef(previews);
  useEffect(() => {
    previewsRef.current = previews;
  });

  useEffect(() => {
    return () => {
      previewsRef.current.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, []);

  function isZipFile(file: File): boolean {
    return file.name.toLowerCase().endsWith('.zip') || file.type === 'application/zip' || file.type === 'application/x-zip-compressed';
  }

  const validateFile = useCallback((file: File): boolean => {
    const isZip = isZipFile(file);
    if (!isZip && !file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      toast.error(`${file.name}: Unsupported file type`);
      return false;
    }
    const sizeMB = file.size / (1024 * 1024);
    if (file.type.startsWith('image/') && sizeMB > MAX_IMAGE_SIZE_MB) {
      toast.error(
        `${file.name} too large (${sizeMB.toFixed(1)}MB). Max: ${MAX_IMAGE_SIZE_MB}MB`
      );
      return false;
    }
    if (file.type.startsWith('video/') && sizeMB > MAX_VIDEO_SIZE_MB) {
      toast.error(
        `${file.name} too large (${sizeMB.toFixed(1)}MB). Max: ${MAX_VIDEO_SIZE_MB}MB`
      );
      return false;
    }
    if (isZip && sizeMB > MAX_ZIP_SIZE_MB) {
      toast.error(
        `${file.name} too large (${sizeMB.toFixed(1)}MB). Max: ${MAX_ZIP_SIZE_MB}MB`
      );
      return false;
    }
    return true;
  }, []);

  const handleZipFile = useCallback(async (zipFile: File) => {
    setIsExtracting(true);
    setExtractionProgress({ current: 0, total: 0 });
    const zipPreviewId = `zip-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    setPreviews((prev) => [
      ...prev,
      { file: zipFile, url: '', isVideo: false, isZip: true, zipPreviewId },
    ]);

    try {
      const extracted = await extractImagesFromZip(zipFile, (current, total) => {
        setExtractionProgress({ current, total });
      });

      if (extracted.length === 0) {
        toast.error('No supported images found in ZIP');
        return;
      }

      const newPreviews: FilePreview[] = [];
      for (const item of extracted) {
        const sizeMB = item.file.size / (1024 * 1024);
        if (sizeMB > MAX_IMAGE_SIZE_MB) {
          toast.warning(`${item.name}: Too large (${sizeMB.toFixed(1)}MB), skipped`);
          continue;
        }
        const url = URL.createObjectURL(item.file);
        newPreviews.push({ file: item.file, url, isVideo: false });
      }

      setPreviews((prev) => {
        const withoutZip = prev.filter((p) => p.zipPreviewId !== zipPreviewId);
        return [...withoutZip, ...newPreviews];
      });
      toast.success(`Extracted ${newPreviews.length} images from ${zipFile.name}`);
    } catch (error) {
      setPreviews((prev) => prev.filter((p) => p.zipPreviewId !== zipPreviewId));
      const message = error instanceof Error ? error.message : 'Failed to extract ZIP';
      toast.error(message);
    } finally {
      setIsExtracting(false);
      setExtractionProgress({ current: 0, total: 0 });
    }
  }, []);

  const addFiles = useCallback(async (files: FileList | null) => {
    if (!files) return;
    const newPreviews: FilePreview[] = [];
    for (const file of Array.from(files)) {
      if (isZipFile(file)) {
        await handleZipFile(file);
        continue;
      }
      if (!validateFile(file)) continue;
      const url = URL.createObjectURL(file);
      const isVideo = file.type.startsWith('video/');
      let estimatedFrames: number | undefined;
      if (isVideo) {
        const duration = await getVideoDuration(file);
        estimatedFrames = Math.min(
          Math.floor(duration * VIDEO_SAMPLE_FPS),
          MAX_VIDEO_FRAMES
        );
      }
      newPreviews.push({ file, url, isVideo, estimatedFrames });
    }
    if (newPreviews.length > 0) {
      setPreviews((prev) => [...prev, ...newPreviews]);
    }
  }, [handleZipFile, validateFile]);

  const removeFile = useCallback((index: number) => {
    setPreviews((prev) => {
      const preview = prev[index];
      if (preview) URL.revokeObjectURL(preview.url);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const clearFiles = useCallback(() => {
    setPreviews((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.url));
      return [];
    });
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);

      const items = e.dataTransfer.items;
      if (items && items.length > 0) {
        const files: File[] = [];
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const entry = item.webkitGetAsEntry?.();
          if (entry) {
            if (entry.isDirectory) {
              const folderFiles = await traverseFolder(entry as FileSystemDirectoryEntry);
              files.push(...folderFiles);
            } else if (entry.isFile) {
              const file = item.getAsFile();
              if (file) files.push(file);
            }
          } else {
            const file = item.getAsFile();
            if (file) files.push(file);
          }
        }

        const dt = new DataTransfer();
        files.forEach((f) => dt.items.add(f));
        await addFiles(dt.files);
        return;
      }

      addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      addFiles(e.target.files);
      e.target.value = '';
    },
    [addFiles]
  );

  const handleStartProcessing = useCallback(async () => {
    if (previews.length === 0) return;
    const allImages: StoredImage[] = [];
    const nameCounts: Record<string, number> = {};

    function getUniqueName(baseName: string): string {
      if (!nameCounts[baseName]) {
        nameCounts[baseName] = 1;
        return baseName;
      }
      nameCounts[baseName]++;
      const ext = baseName.lastIndexOf('.');
      if (ext > 0) {
        return `${baseName.slice(0, ext)} (${nameCounts[baseName]})${baseName.slice(ext)}`;
      }
      return `${baseName} (${nameCounts[baseName]})`;
    }

    for (const preview of previews) {
      if (preview.isVideo) {
        try {
          const frameBlobs = await extractFrames(preview.file);
          frameBlobs.forEach((blob, i) => {
            const frameName = getUniqueName(`${preview.file.name}-frame-${i}`);
            allImages.push({
              id: generateId(),
              name: frameName,
              blob,
              type: 'video-frame',
              width: 0,
              height: 0,
              timestamp: Date.now(),
            });
          });
        } catch {
          toast.error(`Could not extract frames from ${preview.file.name}`);
          continue;
        }
      } else {
        const blob = new Blob([await preview.file.arrayBuffer()], {
          type: preview.file.type,
        });
        const uniqueName = getUniqueName(preview.file.name);
        allImages.push({
          id: generateId(),
          name: uniqueName,
          blob,
          type: 'image',
          width: 0,
          height: 0,
          timestamp: Date.now(),
        });
      }
    }

    if (allImages.length === 0) {
      toast.error('No images could be prepared for processing.');
      return;
    }

    await Promise.all(allImages.map((image) => saveImage(image)));
    batchProcessor.start(allImages);
  }, [previews, batchProcessor]);

  const handleNewUpload = useCallback(() => {
    setCurrentReportId(null);
    clearFiles();
    setView('upload');
  }, [setCurrentReportId, clearFiles]);

  if (view === 'inspect') {
    return <ImageInspector onBack={() => setView('gallery')} />;
  }

  if (view === 'gallery' && currentReportId) {
    return (
      <ImageGallery
        reportId={currentReportId}
        onInspectImage={(imageId) => {
          setInspectingImageId(imageId);
          setView('inspect');
        }}
        onBack={() => currentReportId ? router.push('/reports/' + currentReportId) : setView('upload')}
      />
    );
  }

  if (batchProcessor.isRunning || batchProcessor.progress.completed > 0) {
    return (
      <ProgressOverlay
        progress={batchProcessor.progress}
        isRunning={batchProcessor.isRunning}
        onCancel={batchProcessor.cancel}
        onViewReport={currentReportId ? () => router.push('/reports/' + currentReportId) : undefined}
        onNewUpload={handleNewUpload}
      />
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center p-8 overflow-auto">
      <div
        className={cn(
          'flex w-full max-w-2xl h-[50vh] flex-col items-center justify-center gap-6 rounded-2xl border-2 border-dashed p-12 transition-colors shrink-0',
          dragOver
            ? 'border-primary bg-primary/5'
            : 'border-border bg-card'
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <div className="flex size-16 items-center justify-center rounded-full bg-muted">
          <Upload className="size-8 text-muted-foreground" />
        </div>
        <div className="flex flex-col items-center gap-2 text-center">
          <h2 className="text-lg font-semibold text-foreground">
            Upload Thermal Imagery
          </h2>
          <p className="text-sm text-muted-foreground">
            Drag and drop images, videos, ZIP files, or folders
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => document.getElementById('file-upload')?.click()}
          >
            <ImageIcon className="size-4" />
            Browse Files
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => document.getElementById('folder-upload')?.click()}
          >
            <FolderOpen className="size-4" />
            Browse Folder
          </Button>
        </div>
        <input
          id="file-upload"
          type="file"
          accept=".zip,image/*,video/*"
          multiple
          className="hidden"
          onChange={handleInputChange}
        />
        <input
          id="folder-upload"
          type="file"
          className="hidden"
          onChange={handleInputChange}
          ref={(el) => {
            if (el) {
              el.setAttribute('webkitdirectory', '');
              el.setAttribute('directory', '');
            }
          }}
        />
        {isExtracting && (
          <div className="flex flex-col items-center gap-1 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              Extracting ZIP...
            </div>
            {extractionProgress.total > 0 && (
              <span className="text-xs">
                {extractionProgress.current} of {extractionProgress.total} images
              </span>
            )}
          </div>
        )}
      </div>

      {previews.length > 0 && (
        <div className="w-full max-w-xl mt-6 space-y-3">
          {previews.map((preview, index) => (
            <Card key={index} className="p-3 flex items-start gap-3">
              <div className=' flex justify-between gap-3'>
                {preview.isZip ? (
                <div className="flex size-12 items-center justify-center rounded bg-muted shrink-0">
                  <FileArchive className="size-6 text-muted-foreground" />
                </div>
              ) : preview.isVideo ? (
                <div className="flex size-12 items-center justify-center rounded bg-muted shrink-0">
                  <FileVideo className="size-6 text-muted-foreground" />
                </div>
              ) : (
                <img
                  src={preview.url}
                  alt={preview.file.name}
                  className="size-12 object-cover rounded shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {preview.file.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatSize(preview.file.size)}
                  {preview.isVideo &&
                    preview.estimatedFrames !== undefined && (
                      <> · {preview.estimatedFrames} frames (1 FPS)</>
                    )}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeFile(index)}
                aria-label={`Remove ${preview.file.name}`}
              >
                <Trash2 className="size-4 text-muted-foreground" />
              </Button>
              </div>
            </Card>
          ))}

          <div className="flex gap-3 justify-center pt-4">
            <Button
              variant="outline"
              onClick={clearFiles}
              className="gap-2"
            >
              <X className="size-4" />
              Clear All
            </Button>
            <Button
              onClick={handleStartProcessing}
              disabled={previews.length === 0}
              className="gap-2"
            >
              <Play className="size-4" />
              Start Processing
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

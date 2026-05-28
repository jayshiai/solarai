'use client';

import * as React from 'react';
import { useRef, useState, useCallback, useLayoutEffect, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/lib/state';
import { saveCorrection, generateId } from '@/lib/storage';
import { ANOMALY_CLASSES } from '@/lib/constants';
import { Prediction } from '@/types';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface AnnotationLayerProps {
  imageUrl: string;
  predictions: Prediction[];
  imageWidth: number;
  imageHeight: number;
  imageId: string;
}

interface DrawRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function AnnotationLayer({
  imageUrl,
  predictions,
  imageWidth,
  imageHeight,
  imageId,
}: AnnotationLayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgBounds, setImgBounds] = useState({ left: 0, top: 0, width: 0, height: 0 });

  const measureImage = useCallback(() => {
    const img = imgRef.current;
    const container = containerRef.current;
    if (!img || !container) return;

    const imgRect = img.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    setImgBounds({
      left: imgRect.left - containerRect.left,
      top: imgRect.top - containerRect.top,
      width: imgRect.width,
      height: imgRect.height,
    });
  }, []);

  useLayoutEffect(() => {
    measureImage();
  }, [imageUrl, imageWidth, imageHeight, measureImage]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver(() => {
      measureImage();
    });
    ro.observe(container);
    window.addEventListener('resize', measureImage);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measureImage);
    };
  }, [measureImage]);

  const isPaused = useAppStore((s) => s.isPaused);
  const setIsPaused = useAppStore((s) => s.setIsPaused);
  const mode = useAppStore((s) => s.annotationMode);
  const setMode = useAppStore((s) => s.setAnnotationMode);
  const isDrawing = useAppStore((s) => s.isDrawing);
  const setIsDrawing = useAppStore((s) => s.setIsDrawing);
  const selectedPredictionIndex = useAppStore(
    (s) => s.selectedPredictionIndex
  );
  const setSelectedPredictionIndex = useAppStore(
    (s) => s.setSelectedPredictionIndex
  );
  const addCorrection = useAppStore((s) => s.addCorrection);
  const corrections = useAppStore((s) => s.corrections);

  const [drawRect, setDrawRect] = useState<DrawRect | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<string>(
    ANOMALY_CLASSES[0]
  );

  const mouseToImageCoords = useCallback(
    (clientX: number, clientY: number) => {
      const container = containerRef.current;
      if (!container) return { x: 0, y: 0 };

      const rect = container.getBoundingClientRect();
      const relX = clientX - rect.left - imgBounds.left;
      const relY = clientY - rect.top - imgBounds.top;

      const scaleX = imageWidth / imgBounds.width;
      const scaleY = imageHeight / imgBounds.height;

      return {
        x: Math.max(0, Math.min(imageWidth, relX * scaleX)),
        y: Math.max(0, Math.min(imageHeight, relY * scaleY)),
      };
    },
    [imgBounds, imageWidth, imageHeight]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isPaused || mode !== 'draw') return;
      const coords = mouseToImageCoords(e.clientX, e.clientY);
      setIsDrawing(true);
      setDrawRect({
        x: coords.x,
        y: coords.y,
        width: 0,
        height: 0,
      });
    },
    [isPaused, mode, mouseToImageCoords, setIsDrawing]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDrawing || !drawRect) return;
      const coords = mouseToImageCoords(e.clientX, e.clientY);
      setDrawRect({
        x: Math.min(drawRect.x, coords.x),
        y: Math.min(drawRect.y, coords.y),
        width: Math.abs(coords.x - drawRect.x),
        height: Math.abs(coords.y - drawRect.y),
      });
    },
    [isDrawing, drawRect, mouseToImageCoords]
  );

  const handleMouseUp = useCallback(() => {
    if (!isDrawing || !drawRect) return;
    setIsDrawing(false);
    if (drawRect.width > 5 && drawRect.height > 5) {
      setDialogOpen(true);
    } else {
      setDrawRect(null);
    }
  }, [isDrawing, drawRect, setIsDrawing]);

  const handleSaveCorrection = useCallback(() => {
    if (!drawRect) return;

    const correction = {
      id: generateId(),
      imageId,
      label: selectedClass,
      x: drawRect.x,
      y: drawRect.y,
      width: drawRect.width,
      height: drawRect.height,
      timestamp: Date.now(),
    };

    addCorrection(correction);
    saveCorrection(correction);

    setDialogOpen(false);
    setDrawRect(null);
    setMode('select');
  }, [drawRect, imageId, selectedClass, addCorrection, setMode]);

  const handlePredictionClick = useCallback(
    (index: number) => {
      if (!isPaused) return;

      if (mode === 'select') {
        setSelectedPredictionIndex(
          selectedPredictionIndex === index ? null : index
        );
      }

      if (mode === 'delete') {
        setSelectedPredictionIndex(null);
      }
    },
    [isPaused, mode, selectedPredictionIndex, setSelectedPredictionIndex]
  );

  const handleDeleteCorrection = useCallback(
    (correctionId: string) => {
      if (!isPaused || mode !== 'delete') return;
      const updated = corrections.filter((c) => c.id !== correctionId);
      useAppStore.setState({ corrections: updated });
    },
    [isPaused, mode, corrections]
  );

  const svgRects = predictions.map((pred, i) => {
    const isSelected = selectedPredictionIndex === i;
    return (
      <rect
        key={`pred-${i}`}
        x={pred.x - pred.width / 2}
        y={pred.y - pred.height / 2}
        width={pred.width}
        height={pred.height}
        fill="none"
        stroke={isSelected ? '#10b981' : '#ef4444'}
        strokeWidth={isSelected ? 3 : 2}
        className="cursor-pointer transition-all"
        onClick={(e) => {
          e.stopPropagation();
          handlePredictionClick(i);
        }}
        onMouseEnter={() => {
          if (!isPaused) return;
          setSelectedPredictionIndex(i);
        }}
      />
    );
  });

  const correctionRects = corrections
    .filter((corr) => corr.imageId === imageId)
    .map((corr) => {
      const isDeleteMode = mode === 'delete';
      return (
        <rect
          key={corr.id}
          x={corr.x}
          y={corr.y}
          width={corr.width}
          height={corr.height}
          fill="rgba(59, 130, 246, 0.15)"
          stroke="#3b82f6"
          strokeWidth={2}
          strokeDasharray="6 4"
          className={cn(
            'transition-all',
            isDeleteMode && 'cursor-pointer hover:stroke-red-500'
          )}
          onClick={(e) => {
            e.stopPropagation();
            if (isDeleteMode) handleDeleteCorrection(corr.id);
          }}
        />
      );
    });

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center">
      <div
        ref={containerRef}
        className="relative w-full h-full flex items-center justify-center overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img
          ref={imgRef}
          src={imageUrl}
          alt="Annotation target"
          className="max-w-full max-h-full object-contain"
          style={{ pointerEvents: 'none' }}
          draggable={false}
        />
        <svg
          className="absolute"
          style={{
            pointerEvents: isPaused ? 'auto' : 'none',
            left: imgBounds.left,
            top: imgBounds.top,
            width: imgBounds.width,
            height: imgBounds.height,
          }}
          viewBox={`0 0 ${imageWidth} ${imageHeight}`}
        >
          {svgRects}
          {correctionRects}
          {isDrawing && drawRect && (
            <rect
              x={drawRect.x}
              y={drawRect.y}
              width={drawRect.width}
              height={drawRect.height}
              fill="rgba(16, 185, 129, 0.15)"
              stroke="#10b981"
              strokeWidth={2}
              strokeDasharray="4 4"
            />
          )}
        </svg>
      </div>

      {isPaused && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-xl bg-white border border-border shadow-lg p-1.5 z-50">
          <Button
            variant={mode === 'select' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('select')}
            className={cn(
              'gap-1.5',
              mode === 'select'
                ? 'shadow-md ring-1 ring-primary/30'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
            </svg>
            Select
          </Button>
          <Button
            variant={mode === 'draw' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('draw')}
            className={cn(
              'gap-1.5',
              mode === 'draw'
                ? 'shadow-md ring-1 ring-primary/30'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            </svg>
            Draw
          </Button>
          <Button
            variant={mode === 'delete' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('delete')}
            className={cn(
              'gap-1.5',
              mode === 'delete'
                ? 'shadow-md ring-1 ring-primary/30'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
            Delete
          </Button>
          <div className="w-px h-6 bg-border mx-1" />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setIsPaused(false);
              setMode('select');
            }}
            className="gap-1.5"
          >
            <Check className="size-4" />
            Done
          </Button>
        </div>
      )}

      {/* Class picker dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle>Assign Class Label</DialogTitle>
            <DialogDescription>
              Select the anomaly class for the drawn bounding box.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 bg-white">
            <Select
              value={selectedClass}
              onValueChange={(val) => val && setSelectedClass(val)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select class…" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                {ANOMALY_CLASSES.map((cls) => (
                  <SelectItem key={cls} value={cls}>
                    {cls}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveCorrection}>Save Correction</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

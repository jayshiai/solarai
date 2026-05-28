'use client';

import { useMemo } from 'react';
import { Info, BoxSelect } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/state';
import { CLASS_COLORS } from '@/lib/constants';
import { Prediction } from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface InferencePanelProps {
  predictions: Prediction[];
  onSelectPrediction: (index: number | null) => void;
  selectedPredictionIndex: number | null;
}

export function InferencePanel({
  predictions,
  onSelectPrediction,
  selectedPredictionIndex,
}: InferencePanelProps) {
  const router = useRouter();
  const {
    confidenceThreshold,
    setConfidenceThreshold,
    activeModelVersion,
  } = useAppStore();

  const filteredPredictions = useMemo(() => {
    return predictions
      .map((p, i) => ({ ...p, originalIndex: i }))
      .filter((p) => p.confidence >= confidenceThreshold);
  }, [predictions, confidenceThreshold]);

  return (
    <div className="flex h-full w-full flex-col border-l border-border bg-background">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          Detection Results
        </h2>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="text-xs cursor-pointer hover:bg-accent transition-colors"
            onClick={() => router.push('/model')}
          >
            Model v{activeModelVersion}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {filteredPredictions.length} found
          </Badge>
        </div>
      </div>

      <div className="border-b border-border px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">
            Confidence Threshold
          </label>
          <span className="text-xs font-semibold tabular-nums text-foreground">
            {(confidenceThreshold * 100).toFixed(0)}%
          </span>
        </div>
        <Slider
          value={[confidenceThreshold * 100]}
          min={0}
          max={100}
          step={5}
          onValueChange={(value) => {
            const val = Array.isArray(value) ? value[0] : value;
            if (typeof val === 'number') {
              setConfidenceThreshold(val / 100);
            }
          }}
        />
      </div>

      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="flex flex-col gap-2 p-3">
            {filteredPredictions.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center text-muted-foreground">
                <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                  <Info className="size-5" />
                </div>
                <p className="text-sm font-medium">No anomalies detected</p>
                <p className="max-w-[200px] text-xs">
                  Try lowering the confidence threshold or upload a different image.
                </p>
              </div>
            )}

            {filteredPredictions.map((prediction) => {
              const isSelected =
                selectedPredictionIndex === prediction.originalIndex;
              const color =
                CLASS_COLORS[prediction.class] ||
                '#71717a';

              return (
                <button
                  key={prediction.originalIndex}
                  type="button"
                  onClick={() =>
                    onSelectPrediction(
                      isSelected ? null : prediction.originalIndex
                    )
                  }
                  className={cn(
                    'group relative flex w-full flex-col gap-1.5 rounded-lg border border-transparent bg-card px-3 py-2.5 text-left transition-all',
                    'hover:border-border hover:bg-accent',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                    isSelected && 'border-border bg-accent'
                  )}
                  style={{
                    borderLeftWidth: '3px',
                    borderLeftColor: color,
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="text-sm font-semibold text-foreground"
                      style={{ color: isSelected ? undefined : color }}
                    >
                      {prediction.class}
                    </span>
                    <Badge
                      variant="secondary"
                      className="shrink-0 text-xs tabular-nums"
                    >
                      {(prediction.confidence * 100).toFixed(1)}%
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <BoxSelect className="size-3.5 shrink-0" />
                    <span className="tabular-nums">
                      x:{Math.round(prediction.x)} y:{Math.round(prediction.y)}{' '}
                      w:{Math.round(prediction.width)} h:
                      {Math.round(prediction.height)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Check, Eye } from 'lucide-react';
import { Variant } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface VariantPreviewProps {
  variants: Variant[];
  onSelectionChange: (selectedIndices: number[]) => void;
}

export function VariantPreview({ variants, onSelectionChange }: VariantPreviewProps) {
  const [selected, setSelected] = useState<Set<number>>(() => {
    const all = new Set<number>();
    variants.forEach((_, i) => all.add(i));
    return all;
  });

  const [objectUrls, setObjectUrls] = useState<Map<number, string>>(new Map());

  useEffect(() => {
    const urls = new Map<number, string>();
    variants.forEach((variant, index) => {
      urls.set(index, URL.createObjectURL(variant.imageBlob));
    });
    setObjectUrls(urls);

    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [variants]);

  const toggleIndex = useCallback((index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(variants.map((_, i) => i)));
  }, [variants]);

  const deselectAll = useCallback(() => {
    setSelected(new Set());
  }, []);

  useEffect(() => {
    onSelectionChange(Array.from(selected).sort((a, b) => a - b));
  }, [selected, onSelectionChange]);

  const getAnnotationCount = (yoloAnnotation: string) => {
    if (!yoloAnnotation.trim()) return 0;
    return yoloAnnotation.trim().split('\n').length;
  };

  if (variants.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 py-12 text-muted-foreground">
        <Eye className="size-8 opacity-50" />
        <p className="text-sm font-medium">No variants to preview</p>
      </div>
    );
  }

  const allSelected = selected.size === variants.length;
  const noneSelected = selected.size === 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{selected.size}</span>
          <span>of</span>
          <span className="font-medium text-foreground">{variants.length}</span>
          <span>selected</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={selectAll}
            disabled={allSelected}
            className="h-7 text-xs"
          >
            Select All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={deselectAll}
            disabled={noneSelected}
            className="h-7 text-xs"
          >
            Deselect All
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {variants.map((variant, index) => {
          const isChecked = selected.has(index);
          const annotationCount = getAnnotationCount(variant.yoloAnnotation);
          const imgSrc = objectUrls.get(index);

          return (
            <Card
              key={index}
              className={cn(
                'group/card relative cursor-pointer overflow-hidden rounded-xl border transition-all duration-200',
                isChecked
                  ? 'border-primary/60 ring-1 ring-primary/20'
                  : 'border-border hover:border-primary/40 hover:ring-1 hover:ring-primary/10'
              )}
              onClick={() => toggleIndex(index)}
            >
              <div
                className={cn(
                  'absolute right-2 top-2 z-10 flex size-6 items-center justify-center rounded-md border-2 transition-all',
                  isChecked
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background/80 text-transparent hover:border-primary/60'
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleIndex(index);
                }}
              >
                <Check className="size-3.5" />
              </div>

              <div className="relative aspect-square overflow-hidden bg-muted">
                {imgSrc && (
                  <img
                    src={imgSrc}
                    alt={variant.transformName}
                    className="h-full w-full object-cover transition-transform duration-200 group-hover/card:scale-[1.03]"
                    loading="lazy"
                  />
                )}
              </div>

              <CardContent className="flex flex-col gap-1.5 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-semibold text-foreground">
                    {variant.transformName}
                  </span>
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    {annotationCount} annotation{annotationCount !== 1 ? 's' : ''}
                  </Badge>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {variant.width} × {variant.height}
                </span>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

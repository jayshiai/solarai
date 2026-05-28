'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bug, ChevronDown, ChevronRight, RotateCcw, CheckCircle, AlertTriangle } from 'lucide-react';
import { getAllCorrections, getImage, getImageResult } from '@/lib/storage';
import { generateVariants, convertToYOLO, type AugmentBBox } from '@/lib/augment';
import { ANOMALY_CLASSES } from '@/lib/constants';
import type { Correction, Variant } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface CorrectionGroup {
  imageId: string;
  corrections: Correction[];
  imageUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
}

interface InspectionResult {
  variantIndex: number;
  transformName: string;
  dimensions: string;
  annotationCount: number;
  annotations: {
    lineIndex: number;
    raw: string;
    classId: number;
    cx: number;
    cy: number;
    w: number;
    h: number;
    valid: boolean;
    errors: string[];
  }[];
  allValid: boolean;
}

export function DebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [groups, setGroups] = useState<CorrectionGroup[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [generatingGroupId, setGeneratingGroupId] = useState<string | null>(null);
  const [inspections, setInspections] = useState<Map<string, InspectionResult[]>>(new Map());
  const [lastRefresh, setLastRefresh] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    const corrections = await getAllCorrections();
    const groupedMap = new Map<string, Correction[]>();
    for (const c of corrections) {
      if (!groupedMap.has(c.imageId)) groupedMap.set(c.imageId, []);
      groupedMap.get(c.imageId)!.push(c);
    }

    const loadedGroups: CorrectionGroup[] = [];
    for (const [imageId, corrections] of groupedMap) {
      const img = await getImage(imageId);
      loadedGroups.push({
        imageId,
        corrections,
        imageUrl: img ? URL.createObjectURL(img.blob) : undefined,
        imageWidth: img?.width,
        imageHeight: img?.height,
      });
    }
    setGroups(loadedGroups);
    setLastRefresh(Date.now());
  }, []);

  useEffect(() => {
    if (isOpen) refresh();
  }, [isOpen, refresh]);

  const toggleGroup = (imageId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(imageId)) next.delete(imageId);
      else next.add(imageId);
      return next;
    });
  };

  const inspectGroup = async (group: CorrectionGroup) => {
    setGeneratingGroupId(group.imageId);
    try {
      const img = await getImage(group.imageId);
      if (!img) return;

      const bboxes: AugmentBBox[] = [];

      const result = await getImageResult(group.imageId);
      if (result && result.predictions.length > 0) {
        for (const pred of result.predictions) {
          bboxes.push({
            x: pred.x - pred.width / 2,
            y: pred.y - pred.height / 2,
            width: pred.width,
            height: pred.height,
            label: pred.class as AugmentBBox['label'],
          });
        }
      }

      for (const c of group.corrections) {
        bboxes.push({
          x: c.x,
          y: c.y,
          width: c.width,
          height: c.height,
          label: c.label as AugmentBBox['label'],
        });
      }

      const variants = await generateVariants(img.blob, bboxes);
      const results: InspectionResult[] = variants.map((v, vi) => {
        const lines = v.yoloAnnotation.trim().split('\n').filter(Boolean);
        const parsed = lines.map((line, li) => {
          const parts = line.split(' ');
          const errors: string[] = [];
          let valid = true;

          if (parts.length !== 5) {
            valid = false;
            errors.push(`Expected 5 values, got ${parts.length}`);
          }

          const nums = parts.map(Number);
          const [classId, cx, cy, w, h] = nums;

          if (!Number.isInteger(classId) || classId < 0 || classId >= ANOMALY_CLASSES.length) {
            valid = false;
            errors.push(`Invalid class_id: ${classId} (must be 0-${ANOMALY_CLASSES.length - 1})`);
          }

          [cx, cy, w, h].forEach((val, idx) => {
            if (Number.isNaN(val)) {
              valid = false;
              errors.push(`${['cx','cy','w','h'][idx]} is NaN`);
            } else if (val < 0 || val > 1) {
              valid = false;
              errors.push(`${['cx','cy','w','h'][idx]}=${val.toFixed(4)} out of [0,1] range`);
            }
          });

          return {
            lineIndex: li,
            raw: line,
            classId,
            cx,
            cy,
            w,
            h,
            valid,
            errors,
          };
        });

        return {
          variantIndex: vi,
          transformName: v.transformName,
          dimensions: `${v.width}×${v.height}`,
          annotationCount: lines.length,
          annotations: parsed,
          allValid: parsed.every((a) => a.valid),
        };
      });

      setInspections((prev) => new Map(prev).set(group.imageId, results));
    } finally {
      setGeneratingGroupId(null);
    }
  };

  const downloadVariant = async (group: CorrectionGroup, variantIndex: number) => {
    const img = await getImage(group.imageId);
    if (!img) return;
    const bboxes: AugmentBBox[] = group.corrections.map((c) => ({
      x: c.x,
      y: c.y,
      width: c.width,
      height: c.height,
      label: c.label as AugmentBBox['label'],
    }));
    const variants = await generateVariants(img.blob, bboxes);
    const v = variants[variantIndex];
    if (!v) return;

    const imgUrl = URL.createObjectURL(v.imageBlob);
    const a = document.createElement('a');
    a.href = imgUrl;
    a.download = `debug_${group.imageId.slice(0, 8)}_${v.transformName}.jpg`;
    a.click();
    URL.revokeObjectURL(imgUrl);

    const txtBlob = new Blob([v.yoloAnnotation], { type: 'text/plain' });
    const txtUrl = URL.createObjectURL(txtBlob);
    const b = document.createElement('a');
    b.href = txtUrl;
    b.download = `debug_${group.imageId.slice(0, 8)}_${v.transformName}.txt`;
    b.click();
    URL.revokeObjectURL(txtUrl);
  };

  const totalCorrections = groups.reduce((sum, g) => sum + g.corrections.length, 0);

  return (
    <div className="fixed bottom-4 right-4 z-[9999]">
      {!isOpen ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(true)}
          className="gap-2 shadow-lg border-amber-500/30 bg-background/95 backdrop-blur"
        >
          <Bug className="size-4 text-amber-500" />
          <span className="text-xs">Debug</span>
          {totalCorrections > 0 && (
            <Badge variant="secondary" className="text-[10px] h-5">
              {totalCorrections}
            </Badge>
          )}
        </Button>
      ) : (
        <div className="w-[520px] max-h-[70vh] flex flex-col rounded-xl border border-border bg-background/95 backdrop-blur shadow-2xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Bug className="size-4 text-amber-500" />
              <span className="text-sm font-semibold">Data Pipeline Inspector</span>
              <Badge variant="outline" className="text-[10px]">
                {groups.length} image(s) · {totalCorrections} correction(s)
              </Badge>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="size-7" onClick={refresh} title="Refresh">
                <RotateCcw className="size-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="size-7" onClick={() => setIsOpen(false)} title="Close">
                <ChevronDown className="size-3.5" />
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {groups.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-8">
                No corrections found in IndexedDB.
                <br />
                Draw some bounding boxes first!
              </div>
            ) : (
              groups.map((group) => {
                const isExpanded = expandedGroups.has(group.imageId);
                const inspection = inspections.get(group.imageId);
                const isGenerating = generatingGroupId === group.imageId;

                return (
                  <div
                    key={group.imageId}
                    className="rounded-lg border border-border overflow-hidden"
                  >
                    <button
                      onClick={() => toggleGroup(group.imageId)}
                      className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
                    >
                      {isExpanded ? (
                        <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
                      )}
                      <span className="text-xs font-mono text-muted-foreground shrink-0">
                        {group.imageId.slice(0, 12)}…
                      </span>
                      <Badge variant="secondary" className="text-[10px] h-5">
                        {group.corrections.length} correction(s)
                      </Badge>
                      {group.imageWidth && group.imageHeight && (
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {group.imageWidth}×{group.imageHeight}
                        </span>
                      )}
                    </button>

                    {isExpanded && (
                      <div className="px-3 pb-3 space-y-3 border-t border-border">
                        <div className="pt-2">
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
                            Raw Corrections (IndexedDB)
                          </div>
                          <div className="rounded-md border border-border overflow-hidden">
                            <table className="w-full text-[11px]">
                              <thead className="bg-muted/50">
                                <tr>
                                  <th className="px-2 py-1 text-left font-medium text-muted-foreground">Label</th>
                                  <th className="px-2 py-1 text-right font-medium text-muted-foreground">x</th>
                                  <th className="px-2 py-1 text-right font-medium text-muted-foreground">y</th>
                                  <th className="px-2 py-1 text-right font-medium text-muted-foreground">w</th>
                                  <th className="px-2 py-1 text-right font-medium text-muted-foreground">h</th>
                                </tr>
                              </thead>
                              <tbody>
                                {group.corrections.map((c) => (
                                  <tr key={c.id} className="border-t border-border/50">
                                    <td className="px-2 py-1 font-mono">{c.label}</td>
                                    <td className="px-2 py-1 text-right font-mono">{Math.round(c.x)}</td>
                                    <td className="px-2 py-1 text-right font-mono">{Math.round(c.y)}</td>
                                    <td className="px-2 py-1 text-right font-mono">{Math.round(c.width)}</td>
                                    <td className="px-2 py-1 text-right font-mono">{Math.round(c.height)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {!inspection && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => inspectGroup(group)}
                            disabled={isGenerating}
                            className="w-full gap-2 text-xs"
                          >
                            {isGenerating ? (
                              <RotateCcw className="size-3.5 animate-spin" />
                            ) : (
                              <Bug className="size-3.5" />
                            )}
                            Generate & Inspect Variants
                          </Button>
                        )}

                        {inspection && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                                Variant Inspection ({inspection.length} generated)
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-[10px]"
                                onClick={() => inspectGroup(group)}
                                disabled={isGenerating}
                              >
                                Regenerate
                              </Button>
                            </div>

                            {inspection.map((result) => (
                              <div
                                key={result.variantIndex}
                                className={cn(
                                  'rounded-md border overflow-hidden',
                                  result.allValid
                                    ? 'border-emerald-500/20 bg-emerald-500/5'
                                    : 'border-red-500/20 bg-red-500/5'
                                )}
                              >
                                <div className="flex items-center gap-2 px-2.5 py-1.5">
                                  {result.allValid ? (
                                    <CheckCircle className="size-3.5 text-emerald-500 shrink-0" />
                                  ) : (
                                    <AlertTriangle className="size-3.5 text-red-500 shrink-0" />
                                  )}
                                  <span className="text-xs font-medium">{result.transformName}</span>
                                  <span className="text-[10px] text-muted-foreground">
                                    {result.dimensions} · {result.annotationCount} annotation(s)
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-5 text-[10px] ml-auto"
                                    onClick={() => downloadVariant(group, result.variantIndex)}
                                  >
                                    Download
                                  </Button>
                                </div>

                                {result.annotations.length > 0 && (
                                  <div className="border-t border-border/50 px-2.5 py-1.5 space-y-1">
                                    {result.annotations.map((anno) => (
                                      <div key={anno.lineIndex} className="font-mono text-[10px] leading-relaxed">
                                        {anno.valid ? (
                                          <span className="text-emerald-600">
                                            ✓ {anno.classId} {anno.cx.toFixed(4)} {anno.cy.toFixed(4)} {anno.w.toFixed(4)} {anno.h.toFixed(4)}
                                          </span>
                                        ) : (
                                          <div>
                                            <span className="text-red-500">✗ {anno.raw || '(empty)'}</span>
                                            <div className="text-red-400 pl-3 mt-0.5">
                                              {anno.errors.map((e, i) => (
                                                <div key={i}>→ {e}</div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="px-4 py-2 border-t border-border text-[10px] text-muted-foreground flex justify-between">
            <span>Refreshed {new Date(lastRefresh).toLocaleTimeString()}</span>
            <span>{ANOMALY_CLASSES.join(', ')}</span>
          </div>
        </div>
      )}
    </div>
  );
}

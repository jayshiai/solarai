'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Brain,
  Target,
  Layers,
  Clock,
  Database,
  Play,
  GitBranch,
  Loader2,
  AlertCircle,
  Zap,
} from 'lucide-react';
import { useAppStore } from '@/lib/state';
import { getAllCorrections, getImage, getImageResult } from '@/lib/storage';
import { generateVariants, type AugmentBBox } from '@/lib/augment';
import { triggerTraining } from '@/lib/roboflow-client';
import { MetricCard, DistributionBar, DetailItem } from '@/components/model-metrics';
import { TrainingProgress } from '@/components/training-progress';
import { VariantPreview } from '@/components/variant-preview';
import { BatchUploader } from '@/components/batch-uploader';
import { TrainingStatus } from '@/components/training-status';
import { ModelVersionSelector } from '@/components/model-version-selector';
import { DebugPanel } from '@/components/debug-panel';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ANOMALY_CLASSES, CLASS_COLORS, ROBOFLOW_WORKSPACE, ROBOFLOW_PROJECT, ROBOFLOW_API_KEY } from '@/lib/constants';
import type { Correction, Variant } from '@/types';

function getClassColor(label: string): string {
  return CLASS_COLORS[label] || '#71717a';
}

export function ModelPage() {
  const correctionCount = useAppStore((s) => s.correctionCount);
  const trainingJob = useAppStore((s) => s.trainingJob);
  const setTrainingJob = useAppStore((s) => s.setTrainingJob);
  const activeModelVersion = useAppStore((s) => s.activeModelVersion);

  const [allCorrections, setAllCorrections] = useState<Correction[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [selectedVariantIndices, setSelectedVariantIndices] = useState<number[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [isStartingTraining, setIsStartingTraining] = useState(false);

  useEffect(() => {
    getAllCorrections().then(setAllCorrections).catch(() => {
      setAllCorrections([]);
    });
  }, []);

  const hasConfig = Boolean(
    ROBOFLOW_WORKSPACE && ROBOFLOW_PROJECT && ROBOFLOW_API_KEY
  );
  const hasCorrections = allCorrections.length > 0;

  const handleGenerateVariants = useCallback(async () => {
    if (!hasCorrections) return;
    setIsGenerating(true);
    setVariants([]);
    setUploadComplete(false);
    setSelectedVariantIndices([]);

    try {
      const grouped = new Map<string, Correction[]>();
      for (const c of allCorrections) {
        if (!grouped.has(c.imageId)) grouped.set(c.imageId, []);
        grouped.get(c.imageId)!.push(c);
      }

      const allVariants: Variant[] = [];

      for (const [imageId, corrections] of grouped) {
        const image = await getImage(imageId);
        if (!image) continue;

        const bboxes: AugmentBBox[] = [];

        const result = await getImageResult(imageId);
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

        for (const c of corrections) {
          bboxes.push({
            x: c.x,
            y: c.y,
            width: c.width,
            height: c.height,
            label: c.label as AugmentBBox['label'],
          });
        }

        const imageVariants = await generateVariants(image.blob, bboxes);
        allVariants.push(...imageVariants);
      }

      setVariants(allVariants);
      toast.success(
        `Generated ${allVariants.length} variants from ${grouped.size} image(s)`
      );
    } catch (error) {
      toast.error('Failed to generate variants', {
        description:
          error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsGenerating(false);
    }
  }, [hasCorrections, allCorrections]);

  const handleStartTraining = useCallback(async () => {
    if (!hasConfig || !uploadComplete) return;
    setIsStartingTraining(true);
    try {
      const response = await triggerTraining({
        version: activeModelVersion,
        modelType: 'yolov8',
      });
      setTrainingJob({
        id: response.jobId,
        status: response.status,
        project: ROBOFLOW_PROJECT,
        version: response.version,
      });
      toast.success('Training started', {
        description: `Job ID: ${response.jobId}`,
      });
    } catch (error) {
      toast.error('Failed to start training', {
        description:
          error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsStartingTraining(false);
    }
  }, [hasConfig, uploadComplete, activeModelVersion, setTrainingJob]);

  const classDistribution = useMemo(() => {
    const dist = new Map<string, number>();
    for (const cls of ANOMALY_CLASSES) dist.set(cls, 0);
    for (const c of allCorrections) {
      dist.set(c.label, (dist.get(c.label) || 0) + 1);
    }
    const total = allCorrections.length || 1;
    return Array.from(dist.entries()).map(([label, count]) => ({
      label,
      percentage: Math.round((count / total) * 100),
      color: getClassColor(label),
    }));
  }, [allCorrections]);

  return (
    <div className="flex h-full flex-col gap-8 p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Model Overview
        </h1>
        <p className="text-sm text-muted-foreground">
          Monitor model performance, training pipeline, and class distributions
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Model Version"
          value={`v${activeModelVersion}`}
          icon={<Layers />}
        />
        <MetricCard
          label="Corrections"
          value={String(correctionCount)}
          icon={<Target />}
        />
        <MetricCard
          label="Classes"
          value={String(ANOMALY_CLASSES.length)}
          icon={<Brain />}
        />
        <MetricCard
          label="Training Status"
          value={trainingJob ? trainingJob.status : 'Idle'}
          icon={<Clock />}
        />
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="pipeline">
            Retraining Pipeline
            {hasCorrections && (
              <Badge variant="default" className="ml-2 text-[10px]">
                Ready
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
              <h3 className="text-sm font-semibold text-foreground">
                Class Distribution
              </h3>
              <div className="flex flex-col gap-4">
                {classDistribution.map((d) => (
                  <DistributionBar
                    key={d.label}
                    label={d.label}
                    percentage={d.percentage}
                    color={d.color}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
              <h3 className="text-sm font-semibold text-foreground">
                Training Pipeline
              </h3>
              <TrainingProgress />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="mb-4 text-sm font-semibold text-foreground">
              Model Details
            </h3>
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
              <DetailItem label="Architecture" value="YOLOv8-nano" />
              <DetailItem label="Input Size" value="640 x 640" />
              <DetailItem
                label="Dataset Size"
                value={`${allCorrections.length} corrections`}
              />
              <DetailItem label="Epochs" value="150" />
              <DetailItem label="Batch Size" value="16" />
              <DetailItem label="Learning Rate" value="0.001" />
              <DetailItem label="Optimizer" value="AdamW" />
              <DetailItem label="Framework" value="PyTorch 2.1" />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="pipeline" className="mt-6 flex flex-col gap-6">
          {hasCorrections ? (
            <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
              <div className="flex items-center gap-2">
                <Database className="size-5 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">
                  Dataset Generation
                </h3>
                <Badge variant="secondary">
                  {allCorrections.length} correction
                  {allCorrections.length !== 1 ? 's' : ''}
                </Badge>
              </div>

              {variants.length === 0 ? (
                <div className="flex flex-col gap-4">
                  <p className="text-sm text-muted-foreground">
                    Generate augmented variants from your corrections to create
                    a training dataset.
                  </p>
                  <Button
                    onClick={handleGenerateVariants}
                    disabled={isGenerating}
                    className="w-fit gap-2"
                  >
                    {isGenerating ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Zap className="size-4" />
                    )}
                    Generate from Corrections
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  <VariantPreview
                    variants={variants}
                    onSelectionChange={setSelectedVariantIndices}
                  />
                  <BatchUploader
                    variants={variants}
                    selectedIndices={selectedVariantIndices}
                    onComplete={() => setUploadComplete(true)}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 py-12 text-muted-foreground">
              <AlertCircle className="size-8 opacity-50" />
              <p className="text-sm font-medium">
                Add corrections during image inspection to enable retraining
              </p>
            </div>
          )}

          
          {trainingJob && hasConfig && (
            <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
              <div className="flex items-center gap-2">
                <Play className="size-5 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">
                  Training Status
                </h3>
              </div>
              <TrainingStatus
                jobId={trainingJob.id}
              />
            </div>
          )}

          {uploadComplete && !trainingJob && hasConfig && (
            <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
              <div className="flex items-center gap-2">
                <Play className="size-5 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">
                  Start Training
                </h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Your dataset has been uploaded. Start training on Roboflow.
              </p>
              <Button
                onClick={handleStartTraining}
                disabled={isStartingTraining}
                className="w-fit gap-2"
              >
                {isStartingTraining ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Play className="size-4" />
                )}
                Start Training
              </Button>
            </div>
          )}

          
          {hasConfig && (
            <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
              <div className="flex items-center gap-2">
                <GitBranch className="size-5 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">
                  Model Versions
                </h3>
                {activeModelVersion > 0 && (
                  <Badge variant="default">Active: v{activeModelVersion}</Badge>
                )}
              </div>
              <ModelVersionSelector />
            </div>
          )}
        </TabsContent>
      </Tabs>
      <DebugPanel />
    </div>
  );
}

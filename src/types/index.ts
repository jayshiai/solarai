export interface Prediction {
  class: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Correction {
  id: string;
  imageId: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  timestamp: number;
}

export interface StoredImage {
  id: string;
  name: string;
  blob: Blob;
  type: 'image' | 'video-frame';
  width: number;
  height: number;
  timestamp: number;
}

export interface ModelInfo {
  version: string;
  accuracy: number;
  classes: string[];
  classDistribution: Record<string, number>;
  lastTrained: string;
}

export interface TrainingStage {
  name: string;
  status: 'pending' | 'active' | 'completed' | 'failed';
  progress: number;
  description: string;
}

export type ImageProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ImageResult {
  imageId: string;
  reportId: string;
  name: string;
  status: ImageProcessingStatus;
  predictions: Prediction[];
  error?: string;
  timestamp: number;
}

export interface Report {
  id: string;
  name: string;
  timestamp: number;
  totalImages: number;
  processedCount: number;
  failedCount: number;
  defectiveCount: number;
  defectClassBreakdown: Record<string, number>;
  imageIds: string[];
}

export interface Variant {
  imageBlob: Blob;
  yoloAnnotation: string;
  transformName: string;
  width: number;
  height: number;
}
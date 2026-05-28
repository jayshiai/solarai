'use client';

import { ROBOFLOW_API_URL, MAX_IMAGE_DIMENSION } from './constants';
import { Prediction } from '@/types';

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000];
const TIMEOUT_MS = 30000;

export async function detect(
  imageFile: File | Blob,
  config: { workspace: string; project: string; version: number; apiKey: string },
  signal?: AbortSignal
): Promise<Prediction[]> {
  if (!config.workspace || !config.project || !config.apiKey) {
    console.error('Roboflow config is incomplete:', config);
    return [];
  }

  // const url = `${ROBOFLOW_API_URL}/${config.workspace}/${config.project}/${config.version}?api_key=${config.apiKey}`;
  const url = `${ROBOFLOW_API_URL}/solar-thermal/2?api_key=${config.apiKey}`;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const base64String = await fileToBase64(imageFile);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      // Forward external abort signal to internal controller
      if (signal) {
        signal.addEventListener('abort', () => {
          controller.abort();
          clearTimeout(timeoutId);
        });
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: base64String,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 429 || response.status >= 500) {
          throw new Error(`Retryable error: ${response.status}`);
        }
        console.error('Roboflow API error:', response.status);
        return [];
      }

      const result = await response.json();
      return normalizePredictions(result.predictions || []);

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }
      if (attempt < MAX_RETRIES - 1) {
        await sleep(RETRY_DELAYS[attempt]);
      } else {
        console.error('Inference failed after retries:', error);
        return [];
      }
    }
  }

  return [];
}

function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function normalizePredictions(raw: unknown[]): Prediction[] {
  return raw
    .filter((p): p is Record<string, unknown> =>
      p !== null && typeof p === 'object' && typeof (p as Record<string, unknown>).confidence === 'number'
    )
    .map(p => ({
      class: String(p.class || 'Unknown'),
      confidence: Number(p.confidence),
      x: Number(p.x),
      y: Number(p.y),
      width: Number(p.width),
      height: Number(p.height),
    }));
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function resizeImage(file: File, maxDim: number = MAX_IMAGE_DIMENSION): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob failed'));
      }, 'image/jpeg', 0.92);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

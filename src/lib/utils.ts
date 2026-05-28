import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { VIDEO_SAMPLE_FPS, MAX_VIDEO_FRAMES } from './constants';
import type { Prediction } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function extractFrames(
  videoFile: File,
  sampleFps = VIDEO_SAMPLE_FPS,
  maxFrames = MAX_VIDEO_FRAMES
): Promise<Blob[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(videoFile);
    video.muted = true;

    video.onloadedmetadata = () => {
      const duration = video.duration;
      const totalFrames = Math.min(Math.floor(duration * sampleFps), maxFrames);
      const interval = duration / totalFrames;
      const frames: Blob[] = [];
      let currentTime = 0;

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;

      const captureFrame = () => {
        if (frames.length >= totalFrames) {
          URL.revokeObjectURL(video.src);
          resolve(frames);
          return;
        }
        video.currentTime = currentTime;
        currentTime += interval;
      };

      video.onseeked = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) frames.push(blob);
          captureFrame();
        }, 'image/jpeg', 0.92);
      };

      video.onerror = () => reject(new Error('Video decoding failed'));
      captureFrame();
    };
  });
}

export function hasDefectivePredictions(predictions: Prediction[]): boolean {
  return predictions.some((p) => p.class !== 'Panel');
}

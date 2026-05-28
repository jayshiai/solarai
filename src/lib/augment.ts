import { ANOMALY_CLASSES } from './constants';
import type { Variant } from '@/types';

export interface AugmentBBox {
  x: number;
  y: number;
  width: number;
  height: number;
  label: (typeof ANOMALY_CLASSES)[number];
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas toBlob produced null'));
    }, 'image/jpeg', 0.95);
  });
}

export function convertToYOLO(
  bbox: AugmentBBox,
  imageWidth: number,
  imageHeight: number
): string {
  const classId = ANOMALY_CLASSES.indexOf(bbox.label);
  if (classId === -1) {
    throw new Error(`Unknown class label: ${bbox.label}`);
  }

  const centerX = (bbox.x + bbox.width / 2) / imageWidth;
  const centerY = (bbox.y + bbox.height / 2) / imageHeight;
  const normWidth = bbox.width / imageWidth;
  const normHeight = bbox.height / imageHeight;

  const clamp = (v: number) => Math.max(0, Math.min(1, v));

  return `${classId} ${clamp(centerX)} ${clamp(centerY)} ${clamp(normWidth)} ${clamp(normHeight)}`;
}

interface TransformDef {
  name: string;
  getCanvasSize: (W: number, H: number) => { width: number; height: number };
  setupContext: (ctx: CanvasRenderingContext2D, W: number, H: number) => void;
  transformBBox: (bbox: AugmentBBox, W: number, H: number) => AugmentBBox;
}

const TRANSFORMS: TransformDef[] = [
  {
    name: 'original',
    getCanvasSize: (W, H) => ({ width: W, height: H }),
    setupContext: () => {},
    transformBBox: (bbox) => bbox,
  },
  {
    name: 'rotate_90_cw',
    getCanvasSize: (W, H) => ({ width: H, height: W }),
    setupContext: (ctx, _W, H) => {
      ctx.translate(H, 0);
      ctx.rotate(Math.PI / 2);
    },
    transformBBox: (bbox, _W, H) => ({
      ...bbox,
      x: H - bbox.y - bbox.height,
      y: bbox.x,
      width: bbox.height,
      height: bbox.width,
    }),
  },
  {
    name: 'rotate_180',
    getCanvasSize: (W, H) => ({ width: W, height: H }),
    setupContext: (ctx, W, H) => {
      ctx.translate(W, H);
      ctx.rotate(Math.PI);
    },
    transformBBox: (bbox, W, H) => ({
      ...bbox,
      x: W - bbox.x - bbox.width,
      y: H - bbox.y - bbox.height,
      width: bbox.width,
      height: bbox.height,
    }),
  },
  {
    name: 'rotate_270_cw',
    getCanvasSize: (W, H) => ({ width: H, height: W }),
    setupContext: (ctx, W, _H) => {
      ctx.translate(0, W);
      ctx.rotate(-Math.PI / 2);
    },
    transformBBox: (bbox, W, _H) => ({
      ...bbox,
      x: bbox.y,
      y: W - bbox.x - bbox.width,
      width: bbox.height,
      height: bbox.width,
    }),
  },
  {
    name: 'flip_horizontal',
    getCanvasSize: (W, H) => ({ width: W, height: H }),
    setupContext: (ctx, W, _H) => {
      ctx.translate(W, 0);
      ctx.scale(-1, 1);
    },
    transformBBox: (bbox, W, _H) => ({
      ...bbox,
      x: W - bbox.x - bbox.width,
      y: bbox.y,
      width: bbox.width,
      height: bbox.height,
    }),
  },
  {
    name: 'flip_vertical',
    getCanvasSize: (W, H) => ({ width: W, height: H }),
    setupContext: (ctx, _W, H) => {
      ctx.translate(0, H);
      ctx.scale(1, -1);
    },
    transformBBox: (bbox, _W, H) => ({
      ...bbox,
      x: bbox.x,
      y: H - bbox.y - bbox.height,
      width: bbox.width,
      height: bbox.height,
    }),
  },
  {
    name: 'flip_h_then_90_cw',
    getCanvasSize: (W, H) => ({ width: H, height: W }),
    setupContext: (ctx, W, H) => {
      ctx.translate(H, W);
      ctx.rotate(Math.PI / 2);
      ctx.scale(-1, 1);
    },
    transformBBox: (bbox, W, H) => {
      const flippedX = W - bbox.x - bbox.width;
      return {
        ...bbox,
        x: H - bbox.y - bbox.height,
        y: flippedX,
        width: bbox.height,
        height: bbox.width,
      };
    },
  },
  {
    name: 'flip_v_then_90_cw',
    getCanvasSize: (W, H) => ({ width: H, height: W }),
    setupContext: (ctx, W, H) => {
      ctx.translate(H, 0);
      ctx.rotate(Math.PI / 2);
      ctx.scale(1, -1);
    },
    transformBBox: (bbox, W, H) => {
      const flippedY = H - bbox.y - bbox.height;
      return {
        ...bbox,
        x: H - flippedY - bbox.height,
        y: bbox.x,
        width: bbox.height,
        height: bbox.width,
      };
    },
  },
];

async function applyTransform(
  img: HTMLImageElement,
  bboxes: AugmentBBox[],
  transform: TransformDef
): Promise<Variant> {
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const { width: canvasW, height: canvasH } = transform.getCanvasSize(W, H);

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas 2D context');
  }

  transform.setupContext(ctx, W, H);
  ctx.drawImage(img, 0, 0);

  const transformedBboxes = bboxes.map((bbox) =>
    transform.transformBBox(bbox, W, H)
  );

  const yoloLines = transformedBboxes.map((bbox) =>
    convertToYOLO(bbox, canvasW, canvasH)
  );

  const imageBlob = await canvasToBlob(canvas);

  return {
    imageBlob,
    yoloAnnotation: yoloLines.join('\n'),
    transformName: transform.name,
    width: canvasW,
    height: canvasH,
  };
}

export async function generateVariants(
  imageBlob: Blob,
  bboxes: AugmentBBox[]
): Promise<Variant[]> {
  const url = URL.createObjectURL(imageBlob);
  try {
    const img = await loadImage(url);

    // Process transforms in batches to avoid blocking the main thread
    const batchSize = 4;
    const results: Variant[] = [];

    for (let i = 0; i < TRANSFORMS.length; i += batchSize) {
      const batch = TRANSFORMS.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((t) => applyTransform(img, bboxes, t))
      );
      results.push(...batchResults);

      // Yield to event loop between batches
      if (i + batchSize < TRANSFORMS.length) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    return results;
  } finally {
    URL.revokeObjectURL(url);
  }
}

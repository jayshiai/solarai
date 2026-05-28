export const ANOMALY_CLASSES = [
  'Hotspot',
  'Diode Failure',
  'Sun Glare / False Positive',
  'Soiling',
] as const;

export const CLASS_COLORS: Record<string, string> = {
  'Hotspot': '#ef4444',
  'Diode Failure': '#f97316',
  'Sun Glare / False Positive': '#eab308',
  'Soiling': '#3b82f6',
};

export const CONFIDENCE_THRESHOLD_DEFAULT = 0.5;
export const CORRECTION_THRESHOLD = 50;
export const MAX_IMAGE_SIZE_MB = 10;
export const MAX_VIDEO_SIZE_MB = 100;
export const MAX_VIDEO_FRAMES = 500;
export const VIDEO_SAMPLE_FPS = 1;
export const MAX_ZIP_SIZE_MB = 100;
export const MAX_FILES_PER_ZIP = 500;
export const ALLOWED_ZIP_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'tiff'] as const;
export const MAX_IMAGE_DIMENSION = 1920;

export const ROBOFLOW_API_URL = 'https://serverless.roboflow.com';
export const ROBOFLOW_API_KEY = process.env.NEXT_PUBLIC_ROBOFLOW_API_KEY || '';
export const ROBOFLOW_WORKSPACE = process.env.NEXT_PUBLIC_ROBOFLOW_WORKSPACE || '';
export const ROBOFLOW_PROJECT = process.env.NEXT_PUBLIC_ROBOFLOW_PROJECT || '';
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { StoredImage, Correction, Report, ImageResult } from '@/types';

const DB_NAME = 'solar-dashboard';
const DB_VERSION = 2;

interface SolarDB extends DBSchema {
  images: {
    key: string;
    value: StoredImage;
  };
  corrections: {
    key: string;
    value: Correction;
    indexes: { 'by-image': string };
  };
  reports: {
    key: string;
    value: Report;
  };
  imageResults: {
    key: string;
    value: ImageResult;
    indexes: { 'by-report': string };
  };
}

async function getDB(): Promise<IDBPDatabase<SolarDB>> {
  return openDB<SolarDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Create images store (v1)
      if (!db.objectStoreNames.contains('images')) {
        db.createObjectStore('images', { keyPath: 'id' });
      }
      // Create corrections store (v1)
      if (!db.objectStoreNames.contains('corrections')) {
        const correctionsStore = db.createObjectStore('corrections', { keyPath: 'id' });
        correctionsStore.createIndex('by-image', 'imageId');
      }
      // Create reports store (v2)
      if (!db.objectStoreNames.contains('reports')) {
        db.createObjectStore('reports', { keyPath: 'id' });
      }
      // Create imageResults store (v2)
      if (!db.objectStoreNames.contains('imageResults')) {
        const imageResultsStore = db.createObjectStore('imageResults', { keyPath: 'imageId' });
        imageResultsStore.createIndex('by-report', 'reportId');
      }
    },
  });
}

export async function saveImage(image: StoredImage): Promise<void> {
  try {
    const db = await getDB();
    await db.put('images', image);
  } catch (error) {
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      throw new Error('Storage quota exceeded. Please delete old reports to free space.');
    }
    throw error;
  }
}

export async function getImage(id: string): Promise<StoredImage | undefined> {
  const db = await getDB();
  return db.get('images', id);
}

export async function getAllImages(): Promise<StoredImage[]> {
  const db = await getDB();
  return db.getAll('images');
}

export async function deleteImage(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('images', id);
  const corrections = await getCorrectionsByImage(id);
  for (const c of corrections) {
    await db.delete('corrections', c.id);
  }
}

export async function saveCorrection(correction: Correction): Promise<void> {
  try {
    const db = await getDB();
    await db.put('corrections', correction);
  } catch (error) {
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      throw new Error('Storage quota exceeded. Please delete old reports to free space.');
    }
    throw error;
  }
}

export async function getAllCorrections(): Promise<Correction[]> {
  const db = await getDB();
  return db.getAll('corrections');
}

export async function getCorrectionsByImage(imageId: string): Promise<Correction[]> {
  const db = await getDB();
  return db.getAllFromIndex('corrections', 'by-image', imageId);
}

export async function getCorrectionCount(): Promise<number> {
  const db = await getDB();
  return db.count('corrections');
}

export async function flushCorrections(): Promise<void> {
  const db = await getDB();
  const all = await db.getAll('corrections');
  const tx = db.transaction('corrections', 'readwrite');
  for (const c of all) {
    await tx.store.delete(c.id);
  }
  await tx.done;
}

export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export async function getAllReports(): Promise<Report[]> {
  const db = await getDB();
  return db.getAll('reports');
}

export async function saveReport(report: Report): Promise<void> {
  try {
    const db = await getDB();
    await db.put('reports', report);
  } catch (error) {
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      throw new Error('Storage quota exceeded. Please delete old reports to free space.');
    }
    throw error;
  }
}

export async function getReport(id: string): Promise<Report | undefined> {
  const db = await getDB();
  return db.get('reports', id);
}

export async function deleteReport(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('reports', id);
}

export async function saveImageResult(result: ImageResult): Promise<void> {
  try {
    const db = await getDB();
    await db.put('imageResults', result);
  } catch (error) {
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      throw new Error('Storage quota exceeded. Please delete old reports to free space.');
    }
    throw error;
  }
}

export async function getImageResult(imageId: string): Promise<ImageResult | undefined> {
  const db = await getDB();
  return db.get('imageResults', imageId);
}

export async function getImageResultsByReport(reportId: string): Promise<ImageResult[]> {
  const db = await getDB();
  return db.getAllFromIndex('imageResults', 'by-report', reportId);
}

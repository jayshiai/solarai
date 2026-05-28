import JSZip from 'jszip';
import {
  ALLOWED_ZIP_IMAGE_EXTENSIONS,
  MAX_FILES_PER_ZIP,
} from './constants';

export interface ExtractedImage {
  file: File;
  name: string;
}

export function isSupportedImageFile(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase();
  return !!ext && ALLOWED_ZIP_IMAGE_EXTENSIONS.includes(ext as typeof ALLOWED_ZIP_IMAGE_EXTENSIONS[number]);
}

export function sanitizeZipFilename(name: string): string {
  const normalized = name.replace(/\\/g, '/');
  const basename = normalized.split('/').pop() || '';
  return basename.replace(/^\.+/, '');
}

export async function extractImagesFromZip(
  zipFile: File,
  onProgress?: (current: number, total: number) => void
): Promise<ExtractedImage[]> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(zipFile);
  } catch {
    throw new Error('Invalid or corrupted ZIP file');
  }

  const entries = Object.values(zip.files);
  const imageEntries: JSZip.JSZipObject[] = [];

  for (const entry of entries) {
    if (entry.dir) continue;

    const sanitizedName = sanitizeZipFilename(entry.name);
    if (sanitizedName.toLowerCase().endsWith('.zip')) continue;

    const ext = sanitizedName.split('.').pop()?.toLowerCase();
    if (!ext || !ALLOWED_ZIP_IMAGE_EXTENSIONS.includes(ext as typeof ALLOWED_ZIP_IMAGE_EXTENSIONS[number])) {
      continue;
    }

    imageEntries.push(entry);
  }

  const totalImageCount = Math.min(imageEntries.length, MAX_FILES_PER_ZIP);
  const results: ExtractedImage[] = [];

  for (let i = 0; i < imageEntries.length; i++) {
    if (results.length >= MAX_FILES_PER_ZIP) break;

    const entry = imageEntries[i];
    const sanitizedName = sanitizeZipFilename(entry.name);
    const ext = sanitizedName.split('.').pop()?.toLowerCase() || '';

    const data = (entry as unknown as { _data?: { compressedSize: number; uncompressedSize: number } })._data;
    const compressedSize = data?.compressedSize ?? 0;
    const uncompressedSize = data?.uncompressedSize ?? 0;
    if (compressedSize > 0) {
      const ratio = uncompressedSize / compressedSize;
      if (ratio > 100 && uncompressedSize > 1024 * 1024) {
        throw new Error('Potential ZIP bomb detected. This archive appears malicious.');
      }
    }

    const blob: Blob = await entry.async('blob');
    const file = new File([blob], sanitizedName, { type: blob.type || 'image/' + ext });

    results.push({ file, name: sanitizedName });

    if (onProgress) {
      onProgress(results.length, totalImageCount);
    }
  }

  return results;
}

export function traverseFolder(
  entry: FileSystemDirectoryEntry
): Promise<File[]> {
  return new Promise((resolve, reject) => {
    const reader = entry.createReader();
    const files: File[] = [];

    function readEntries() {
      reader.readEntries(
        (entries) => {
          if (entries.length === 0) {
            resolve(files);
            return;
          }

          const promises: Promise<void>[] = [];

          for (const item of entries) {
            if (item.isDirectory) {
              promises.push(
                traverseFolder(item as FileSystemDirectoryEntry).then((nested) => {
                  files.push(...nested);
                })
              );
            } else if (item.isFile) {
              promises.push(
                new Promise<void>((res) => {
                  (item as FileSystemFileEntry).file(
                    (file) => {
                      if (isSupportedImageFile(file)) {
                        files.push(file);
                      }
                      res();
                    },
                    () => res()
                  );
                })
              );
            }
          }

          Promise.all(promises).then(readEntries).catch(reject);
        },
        (err) => reject(err)
      );
    }

    readEntries();
  });
}

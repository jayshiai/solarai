'use client';

import { ROBOFLOW_API_KEY, ROBOFLOW_WORKSPACE, ROBOFLOW_PROJECT } from './constants';

export interface UploadParams {
  imageBlob: Blob;
  name: string;
  split?: 'train' | 'valid' | 'test';
  annotation: string;
}

export interface TrainingParams {
  version: number;
  modelType: string;
  epochs?: number;
  speed?: 'fast' | 'accurate';
}

export interface TrainingResponse {
  jobId: string;
  status: string;
  version: number;
  createdAt: string;
}

export interface PollParams {
  jobId: string;
}

export type TrainingJobStatus = 'queued' | 'training' | 'complete' | 'failed' | 'cancelled';

export interface TrainingStatus {
  id: string;
  status: TrainingJobStatus;
  progress?: number;
  model_type: string;
  createdAt: string;
}

export type ListVersionsParams = Record<string, never>;

export interface VersionInfo {
  version: number;
  created: string;
  [key: string]: unknown;
}

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000];
const TIMEOUT_MS = 30000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeError(response: Response, context: string): Error {
  return new Error(`${context}: HTTP ${response.status} ${response.statusText}`);
}

async function fetchWithRetry<T>(url: string, options: RequestInit, context: string): Promise<T> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 429 || response.status >= 500) {
          if (attempt < MAX_RETRIES - 1) {
            await sleep(RETRY_DELAYS[attempt]);
            continue;
          }
        }
        throw normalizeError(response, context);
      }

      const data = await response.json();
      if (data.error) throw new Error(`${context}: ${data.error}`);
      return data as T;

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`${context}: Request timed out after ${TIMEOUT_MS}ms`);
      }
      if (error instanceof Error && error.message.startsWith(`${context}:`)) throw error;
      if (attempt < MAX_RETRIES - 1) {
        await sleep(RETRY_DELAYS[attempt]);
        continue;
      }
      throw new Error(`${context}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  throw new Error(`${context}: Max retries exceeded`);
}

function requireConfig(): void {
  if (!ROBOFLOW_WORKSPACE) {
    throw new Error('Roboflow workspace not configured. Set NEXT_PUBLIC_ROBOFLOW_WORKSPACE in .env.local');
  }
  if (!ROBOFLOW_PROJECT) {
    throw new Error('Roboflow project not configured. Set NEXT_PUBLIC_ROBOFLOW_PROJECT in .env.local');
  }
  if (!ROBOFLOW_API_KEY) {
    throw new Error('Roboflow API key not configured. Set NEXT_PUBLIC_ROBOFLOW_API_KEY in .env.local');
  }
}

export async function uploadImage(params: UploadParams): Promise<void> {
  const { imageBlob, name, split = 'train', annotation } = params;

  requireConfig();

  const formData = new FormData();
  formData.append('file', imageBlob, name);
  formData.append('name', name);
  formData.append('split', split);
  formData.append('annotation', annotation);
  formData.append('api_key', ROBOFLOW_API_KEY);
  formData.append('workspace', ROBOFLOW_WORKSPACE);
  formData.append('project', ROBOFLOW_PROJECT);

  await fetchWithRetry('/api/robo-proxy', { method: 'POST', body: formData }, 'Image upload');
}

export async function triggerTraining(params: TrainingParams): Promise<TrainingResponse> {
  const { version, modelType, epochs, speed } = params;

  requireConfig();

  return fetchWithRetry<TrainingResponse>('/api/robo-proxy/train', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: ROBOFLOW_API_KEY,
      workspace: ROBOFLOW_WORKSPACE,
      project: ROBOFLOW_PROJECT,
      version,
      model_type: modelType,
      ...(epochs !== undefined && { epochs }),
      ...(speed !== undefined && { speed }),
    }),
  }, 'Training trigger');
}

export async function pollTrainingStatus(params: PollParams): Promise<TrainingStatus> {
  const { jobId } = params;

  requireConfig();

  const url = `https://api.roboflow.com/${ROBOFLOW_WORKSPACE}/${ROBOFLOW_PROJECT}/jobs/${jobId}?api_key=${ROBOFLOW_API_KEY}`;

  const data = await fetchWithRetry<{
    id: string;
    status: TrainingJobStatus;
    progress?: number;
    model_type: string;
    createdAt?: string;
    created?: string;
  }>(url, { method: 'GET' }, 'Training status poll');

  return {
    id: data.id,
    status: data.status,
    progress: data.progress,
    model_type: data.model_type,
    createdAt: data.createdAt ?? data.created ?? new Date().toISOString(),
  };
}

export async function listVersions(_params: ListVersionsParams): Promise<VersionInfo[]> {
  requireConfig();

  const url = `https://api.roboflow.com/${ROBOFLOW_WORKSPACE}/${ROBOFLOW_PROJECT}?api_key=${ROBOFLOW_API_KEY}`;

  const data = await fetchWithRetry<{ versions?: VersionInfo[] }>(url, { method: 'GET' }, 'List versions');
  return data.versions ?? [];
}
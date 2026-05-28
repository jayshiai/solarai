'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useEffect } from 'react';
import { Prediction, Correction, Report } from '@/types';
import { getAllReports, saveReport } from '@/lib/storage';

interface AppState {
  confidenceThreshold: number;
  setConfidenceThreshold: (threshold: number) => void;

  isPaused: boolean;
  setIsPaused: (paused: boolean) => void;
  annotationMode: 'select' | 'draw' | 'delete';
  setAnnotationMode: (mode: 'select' | 'draw' | 'delete') => void;
  isDrawing: boolean;
  setIsDrawing: (drawing: boolean) => void;
  selectedPredictionIndex: number | null;
  setSelectedPredictionIndex: (index: number | null) => void;
  corrections: Correction[];
  setCorrections: (corrections: Correction[]) => void;
  addCorrection: (correction: Correction) => void;

  correctionCount: number;
  setCorrectionCount: (count: number) => void;

  isProcessing: boolean;
  setIsProcessing: (processing: boolean) => void;
  processingProgress: { completed: number; total: number; failed: number };
  setProcessingProgress: (progress: { completed: number; total: number; failed: number }) => void;
  currentReportId: string | null;
  setCurrentReportId: (id: string | null) => void;

  reports: Report[];
  setReports: (reports: Report[]) => void;
  addReport: (report: Report) => void;

  inspectingImageId: string | null;
  setInspectingImageId: (id: string | null) => void;
  inspectingPredictions: Prediction[];
  setInspectingPredictions: (predictions: Prediction[]) => void;

  trainingJob: { id: string; status: string; project: string; version: number } | null;
  setTrainingJob: (job: { id: string; status: string; project: string; version: number } | null) => void;
  clearTrainingJob: () => void;

  mockTrainingActive: boolean;
  setMockTrainingActive: (active: boolean) => void;

  forceTrain: boolean;
  setForceTrain: (enabled: boolean) => void;

  activeModelTab: string;
  setActiveModelTab: (tab: string) => void;

  activeModelVersion: number;
  setActiveModelVersion: (version: number) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      confidenceThreshold: 0.5,
      setConfidenceThreshold: (threshold) => set({ confidenceThreshold: threshold }),

      isPaused: false,
      setIsPaused: (paused) => set({ isPaused: paused }),
      annotationMode: 'select',
      setAnnotationMode: (mode) => set({ annotationMode: mode }),
      isDrawing: false,
      setIsDrawing: (drawing) => set({ isDrawing: drawing }),
      selectedPredictionIndex: null,
      setSelectedPredictionIndex: (index) => set({ selectedPredictionIndex: index }),
      corrections: [],
      setCorrections: (corrections) => set({ corrections }),
      addCorrection: (correction) =>
        set((state) => ({
          corrections: [...state.corrections, correction],
          correctionCount: state.correctionCount + 1,
        })),

      correctionCount: 0,
      setCorrectionCount: (count) => set({ correctionCount: count }),

      isProcessing: false,
      setIsProcessing: (processing) => set({ isProcessing: processing }),
      processingProgress: { completed: 0, total: 0, failed: 0 },
      setProcessingProgress: (progress) => set({ processingProgress: progress }),
      currentReportId: null,
      setCurrentReportId: (id) => set({ currentReportId: id }),

      reports: [],
      setReports: (reports) => set({ reports }),
      addReport: (report) => {
        set((state) => ({ reports: [...state.reports, report] }));
      },

      inspectingImageId: null,
      setInspectingImageId: (id) => set({ inspectingImageId: id }),
      inspectingPredictions: [],
      setInspectingPredictions: (predictions) => set({ inspectingPredictions: predictions }),

      trainingJob: null,
      setTrainingJob: (job) => set({ trainingJob: job }),
      clearTrainingJob: () => set({ trainingJob: null }),

      mockTrainingActive: false,
      setMockTrainingActive: (active) => set({ mockTrainingActive: active }),

      forceTrain: true,
      setForceTrain: (enabled) => set({ forceTrain: enabled }),

      activeModelTab: 'overview',
      setActiveModelTab: (tab) => set({ activeModelTab: tab }),

      activeModelVersion: 1,
      setActiveModelVersion: (version) => set({ activeModelVersion: version }),
    }),
    {
      name: 'solar-app-storage',
      partialize: (state) => ({
        activeModelVersion: state.activeModelVersion,
      }),
    }
  )
);

export function HydrationProvider({ children }: { children: React.ReactNode }) {
  const setReports = useAppStore((state) => state.setReports);

  useEffect(() => {
    getAllReports().then(setReports);
  }, [setReports]);

  return <>{children}</>;
}

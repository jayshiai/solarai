'use client';

import { useState, useEffect } from 'react';
import { listVersions, VersionInfo } from '@/lib/roboflow-client';
import { useAppStore } from '@/lib/state';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertCircle, RefreshCw } from 'lucide-react';

export function ModelVersionSelector() {
  const activeModelVersion = useAppStore((state) => state.activeModelVersion);
  const setActiveModelVersion = useAppStore((state) => state.setActiveModelVersion);

  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manualVersion, setManualVersion] = useState<string>('');

  useEffect(() => {
    let cancelled = false;

    async function fetchVersions() {
      setLoading(true);
      setError(null);

      try {
        const result = await listVersions({});
        if (!cancelled) {
          const sorted = [...result].sort((a, b) => b.version - a.version);
          setVersions(sorted);
          if (sorted.length > 0 && activeModelVersion === 0) {
            setActiveModelVersion(sorted[0].version);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load versions');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchVersions();

    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectChange = (value: string | null) => {
    if (value === null) return;
    const version = parseInt(value, 10);
    if (!isNaN(version) && version > 0) {
      setActiveModelVersion(version);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const version = parseInt(manualVersion, 10);
    if (!isNaN(version) && version > 0) {
      setActiveModelVersion(version);
      setManualVersion('');
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <RefreshCw className="h-4 w-4 animate-spin" />
        <span>Loading versions...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span>Failed to load versions</span>
        </div>
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <input
            type="number"
            min="1"
            placeholder="Version number"
            value={manualVersion}
            onChange={(e) => setManualVersion(e.target.value)}
            className="flex h-8 w-24 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
          >
            Set Version
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {activeModelVersion > 0 && (
        <div className="text-sm">
          <span className="text-muted-foreground">Active: </span>
          <span className="font-medium">v{activeModelVersion}</span>
        </div>
      )}

      <Select
        value={activeModelVersion > 0 ? String(activeModelVersion) : undefined}
        onValueChange={handleSelectChange}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Select version" />
        </SelectTrigger>
        <SelectContent>
          {versions.map((v) => (
            <SelectItem
              key={v.version}
              value={String(v.version)}
              className={v.version === activeModelVersion ? 'font-medium' : undefined}
            >
              <div className="flex items-center gap-2">
                <span>v{v.version}</span>
                <span className="text-muted-foreground text-xs">
                  ({formatDate(v.created)})
                </span>
                {v.version === activeModelVersion && (
                  <span className="ml-auto text-xs text-primary">Current</span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
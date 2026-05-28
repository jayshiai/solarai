'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { ArrowLeft, Search, CheckCircle2, XCircle, Image as ImageIcon } from 'lucide-react';
import { ImageResult } from '@/types';
import { getImageResultsByReport, getImage } from '@/lib/storage';
import { CLASS_COLORS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';

interface ImageGalleryProps {
  reportId: string;
  onInspectImage: (imageId: string) => void;
  onBack: () => void;
}

type FilterType = 'all' | 'defective' | 'clean' | 'failed';
type SortType = 'newest' | 'oldest' | 'name';

export function ImageGallery({ reportId, onInspectImage, onBack }: ImageGalleryProps) {
  const [imageResults, setImageResults] = useState<ImageResult[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [sort, setSort] = useState<SortType>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [lastReportId, setLastReportId] = useState<string | null>(null);

  const isLoading = lastReportId !== reportId;

  useEffect(() => {
    getImageResultsByReport(reportId)
      .then((results) => {
        setImageResults(results);
        setLastReportId(reportId);
      })
      .catch((err) => {
        console.error('Failed to load image results:', err);
        setImageResults([]);
        setLastReportId(reportId);
      });
  }, [reportId]);

  useEffect(() => {
    if (imageResults.length === 0) return;

    const currentUrls: Record<string, string> = {};
    let cancelled = false;

    Promise.all(
      imageResults.map(async (result) => {
        try {
          const storedImage = await getImage(result.imageId);
          if (storedImage?.blob && !cancelled) {
            const url = URL.createObjectURL(storedImage.blob);
            currentUrls[result.imageId] = url;
          }
        } catch (err) {
          console.error(`Failed to load thumbnail for ${result.imageId}:`, err);
        }
      })
    ).then(() => {
      if (!cancelled) {
        setThumbnails((prev) => {
          Object.values(prev).forEach(URL.revokeObjectURL);
          return currentUrls;
        });
      }
    });

    return () => {
      cancelled = true;
      Object.values(currentUrls).forEach(URL.revokeObjectURL);
    };
  }, [imageResults]);

  const filteredAndSortedImages = useMemo(() => {
    let filtered = imageResults;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((img) => img.name.toLowerCase().includes(query));
    }

    switch (filter) {
      case 'defective':
        filtered = filtered.filter((img) => img.predictions.length > 0);
        break;
      case 'clean':
        filtered = filtered.filter((img) => img.status === 'completed' && img.predictions.length === 0);
        break;
      case 'failed':
        filtered = filtered.filter((img) => img.status === 'failed');
        break;
    }

    const sorted = [...filtered];
    switch (sort) {
      case 'newest':
        sorted.sort((a, b) => b.timestamp - a.timestamp);
        break;
      case 'oldest':
        sorted.sort((a, b) => a.timestamp - b.timestamp);
        break;
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }

    return sorted;
  }, [imageResults, filter, sort, searchQuery]);

  const counts = useMemo(() => {
    const all = imageResults.length;
    const defective = imageResults.filter((img) => img.predictions.length > 0).length;
    const clean = imageResults.filter((img) => img.status === 'completed' && img.predictions.length === 0).length;
    const failed = imageResults.filter((img) => img.status === 'failed').length;
    return { all, defective, clean, failed };
  }, [imageResults]);

  const getDefectClasses = useCallback((predictions: ImageResult['predictions']) => {
    return [...new Set(predictions.map((p) => p.class))];
  }, []);

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-lg font-semibold">Image Gallery</h1>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search images..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 w-full rounded-lg border border-input bg-transparent py-2 pr-3 pl-9 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>

        <Select value={sort} onValueChange={(value) => setSort(value as SortType)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="name">Name</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs value={filter} onValueChange={(value) => setFilter(value as FilterType)}>
        <TabsList>
          <TabsTrigger value="all">
            All <Badge variant="secondary" className="ml-1">{counts.all}</Badge>
          </TabsTrigger>
          <TabsTrigger value="defective">
            Defective Only <Badge variant="secondary" className="ml-1">{counts.defective}</Badge>
          </TabsTrigger>
          <TabsTrigger value="clean">
            Clean Only <Badge variant="secondary" className="ml-1">{counts.clean}</Badge>
          </TabsTrigger>
          <TabsTrigger value="failed">
            Failed <Badge variant="secondary" className="ml-1">{counts.failed}</Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          Loading images...
        </div>
      ) : imageResults.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          No images in this report
        </div>
      ) : filteredAndSortedImages.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          No images match the selected filter
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {filteredAndSortedImages.map((image) => (
            <Card
              key={image.imageId}
              className="group cursor-pointer overflow-hidden transition-shadow hover:shadow-md"
              onClick={() => onInspectImage(image.imageId)}
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                {thumbnails[image.imageId] ? (
                  <img
                    src={thumbnails[image.imageId]}
                    alt={image.name}
                    className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <ImageIcon className="size-8 text-muted-foreground" />
                  </div>
                )}

                <div className="absolute top-2 right-2">
                  {image.status === 'completed' && image.predictions.length > 0 ? (
                    <div className="flex max-w-[120px] flex-wrap justify-end gap-1">
                      {getDefectClasses(image.predictions).map((cls) => (
                        <Badge
                          key={cls}
                          variant="outline"
                          className="border-0 px-1.5 py-0 text-[10px] text-white"
                          style={{ backgroundColor: CLASS_COLORS[cls] || '#ef4444' }}
                        >
                          {cls}
                        </Badge>
                      ))}
                    </div>
                  ) : image.status === 'completed' && image.predictions.length === 0 ? (
                    <Badge className="border-0 bg-green-500 text-white">
                      <CheckCircle2 className="mr-1 size-3" />
                      Clean
                    </Badge>
                  ) : image.status === 'failed' ? (
                    <Badge variant="destructive">
                      <XCircle className="mr-1 size-3" />
                      Failed
                    </Badge>
                  ) : null}
                </div>
              </div>

              <CardContent className="p-3">
                <p className="truncate text-sm font-medium" title={image.name}>
                  {image.name}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

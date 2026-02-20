import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useYoutubeQueue } from "@/hooks/useYoutubeQueue";
import {
  Youtube, Play, ListMusic, Search, Trash2, Clock, User,
  GripVertical, Heart, ChevronLeft, ChevronRight, ListPlus,
  CheckSquare, Square, X,
} from "lucide-react";

const PAGE_SIZE = 10;

interface YouTubeSectionProps {
  playerName: string;
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export function YouTubeSection({ playerName }: YouTubeSectionProps) {
  const {
    currentVideo, queue, recentVideos,
    playNow, addToQueue, removeFromQueue, reorderQueue, toggleFavorite,
  } = useYoutubeQueue();

  const [videoUrl, setVideoUrl] = useState("");
  const [localQueue, setLocalQueue] = useState<typeof queue | null>(null);
  const dragIndex = useRef<number | null>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  // History pagination & multi-select
  const [historyPage, setHistoryPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const displayQueue = localQueue ?? queue;
  const isPending = playNow.isPending || addToQueue.isPending;
  const videoId = extractVideoId(videoUrl.trim());

  const totalPages = Math.ceil(recentVideos.length / PAGE_SIZE);
  const pageVideos = recentVideos.slice(historyPage * PAGE_SIZE, (historyPage + 1) * PAGE_SIZE);

  /* ── URL submit ─────────────────────────────────── */
  const handlePlayNow = () => {
    if (!videoId) return;
    playNow.mutate({ video_id: videoId, queued_by: playerName }, { onSuccess: () => setVideoUrl("") });
  };
  const handleAddToQueue = () => {
    if (!videoId) return;
    addToQueue.mutate({ video_id: videoId, queued_by: playerName }, { onSuccess: () => setVideoUrl("") });
  };

  /* ── Drag-to-reorder ────────────────────────────── */
  const handleDragStart = (idx: number) => { dragIndex.current = idx; setDraggingIdx(idx); };
  const handleDragEnter = (idx: number) => {
    setOverIdx(idx);
    if (dragIndex.current === null || dragIndex.current === idx) return;
    const reordered = [...displayQueue];
    const [moved] = reordered.splice(dragIndex.current, 1);
    reordered.splice(idx, 0, moved);
    dragIndex.current = idx;
    setLocalQueue(reordered);
  };
  const handleDragEnd = () => {
    setDraggingIdx(null); setOverIdx(null);
    if (localQueue) {
      reorderQueue.mutate(localQueue.map((v) => v.id), {
        onSuccess: () => setLocalQueue(null),
        onError: () => setLocalQueue(null),
      });
    }
    dragIndex.current = null;
  };

  /* ── Multi-select helpers ───────────────────────── */
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const selectAll = () => setSelected(new Set(pageVideos.map((v) => v.id)));
  const clearSelection = () => setSelected(new Set());

  const handleAddSelected = () => {
    const vids = recentVideos.filter((v) => selected.has(v.id));
    vids.forEach((v) => addToQueue.mutate({ video_id: v.video_id, queued_by: playerName }));
    setSelected(new Set());
  };

  /* ── Favourite toggle ───────────────────────────── */
  const handleFavourite = (id: string, current: boolean) =>
    toggleFavorite.mutate({ id, is_favorite: !current });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <Youtube className="h-5 w-5 text-destructive" />
          YouTube
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Now Playing */}
        {currentVideo && (
          <div className="bg-secondary/30 rounded-lg p-3 border border-border">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Play className="h-3 w-3 fill-current text-primary" />
              <span className="text-primary font-medium">Now Playing</span>
              <button
                onClick={() => handleFavourite(currentVideo.id, currentVideo.is_favorite)}
                className="ml-auto"
                aria-label="Toggle favourite"
              >
                <Heart
                  className={`h-4 w-4 transition-colors ${
                    currentVideo.is_favorite ? "fill-destructive text-destructive" : "text-muted-foreground hover:text-destructive"
                  }`}
                />
              </button>
            </div>
            <p className="font-medium line-clamp-1 text-sm">{currentVideo.title}</p>
            <p className="text-xs text-muted-foreground">by {currentVideo.queued_by}</p>
          </div>
        )}

        {/* URL Input */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Paste YouTube URL or video ID..."
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={handlePlayNow} disabled={!videoId || isPending} variant="default" className="w-full">
              <Play className="h-4 w-4 mr-1" />
              {playNow.isPending ? "Loading..." : "Play Now"}
            </Button>
            <Button onClick={handleAddToQueue} disabled={!videoId || isPending} variant="outline" className="w-full">
              <ListMusic className="h-4 w-4 mr-1" />
              {addToQueue.isPending ? "Adding..." : "Add to Queue"}
            </Button>
          </div>
        </div>

        {/* Queue */}
        {displayQueue.length > 0 && (
          <div className="border-t pt-3">
            <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
              <ListMusic className="h-3 w-3" />
              Up Next ({displayQueue.length})
            </p>
            <div className="space-y-1">
              {displayQueue.map((video, idx) => (
                <div
                  key={video.id}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragEnter={() => handleDragEnter(idx)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => e.preventDefault()}
                  className={`flex items-center gap-2 p-2 rounded-md border transition-all select-none ${
                    draggingIdx === idx
                      ? "opacity-40 bg-secondary/20 border-border/50"
                      : overIdx === idx && draggingIdx !== null && draggingIdx !== idx
                      ? "bg-primary/10 border-primary/40"
                      : "bg-secondary/20 border-border/50"
                  }`}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground/50 cursor-grab shrink-0" />
                  <span className="text-xs text-muted-foreground w-4 shrink-0">{idx + 1}</span>
                  <img
                    src={video.thumbnail_url ?? `https://img.youtube.com/vi/${video.video_id}/hqdefault.jpg`}
                    alt={video.title}
                    className="h-8 w-12 rounded object-cover bg-secondary shrink-0"
                    loading="lazy"
                    draggable={false}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium line-clamp-1">{video.title}</p>
                    <p className="text-xs text-muted-foreground">by {video.queued_by}</p>
                  </div>
                  <button
                    onClick={() => handleFavourite(video.id, video.is_favorite)}
                    className="shrink-0 p-1"
                    aria-label="Toggle favourite"
                  >
                    <Heart
                      className={`h-3.5 w-3.5 transition-colors ${
                        video.is_favorite ? "fill-destructive text-destructive" : "text-muted-foreground hover:text-destructive"
                      }`}
                    />
                  </button>
                  {video.queued_by === playerName && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive shrink-0"
                      onClick={() => removeFromQueue.mutate(video.id)}
                      aria-label="Remove from queue"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* History */}
        {recentVideos.length > 0 && (
          <div className="border-t pt-3 space-y-2">
            {/* Header row */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                History ({recentVideos.length})
              </p>
              <div className="flex items-center gap-1">
                {selected.size > 0 ? (
                  <>
                    <span className="text-xs text-muted-foreground">{selected.size} selected</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs"
                      onClick={handleAddSelected}
                      disabled={addToQueue.isPending}
                    >
                      <ListPlus className="h-3.5 w-3.5 mr-1" />
                      Add to Queue
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={clearSelection}>
                      Clear
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={selectAll}>
                    <CheckSquare className="h-3.5 w-3.5 mr-1" />
                    Select all
                  </Button>
                )}
              </div>
            </div>

            {/* Video rows */}
            <div className="space-y-1">
              {pageVideos.map((video) => {
                const isSelected = selected.has(video.id);
                return (
                  <div
                    key={video.id}
                    className={`flex items-center gap-2 p-2 rounded-md transition-colors ${
                      isSelected ? "bg-primary/10 border border-primary/30" : "hover:bg-secondary/40 border border-transparent"
                    }`}
                  >
                    {/* Checkbox */}
                    <button onClick={() => toggleSelect(video.id)} className="shrink-0" aria-label="Select">
                      {isSelected
                        ? <CheckSquare className="h-4 w-4 text-primary" />
                        : <Square className="h-4 w-4 text-muted-foreground/50" />
                      }
                    </button>

                    {/* Thumbnail + info (click to play) */}
                    <button
                      onClick={() => playNow.mutate({ video_id: video.video_id, queued_by: playerName })}
                      disabled={playNow.isPending}
                      className="flex items-center gap-2 flex-1 text-left min-w-0"
                    >
                      <img
                        src={video.thumbnail_url ?? `https://img.youtube.com/vi/${video.video_id}/hqdefault.jpg`}
                        alt={video.title}
                        className="h-8 w-12 rounded object-cover bg-secondary shrink-0"
                        loading="lazy"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-medium line-clamp-1">{video.title}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <User className="h-2.5 w-2.5" />
                          {video.queued_by}
                        </p>
                      </div>
                    </button>

                    {/* Add single to queue */}
                    <button
                      onClick={() => addToQueue.mutate({ video_id: video.video_id, queued_by: playerName })}
                      disabled={addToQueue.isPending}
                      className="shrink-0 p-1 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Add to queue"
                    >
                      <ListPlus className="h-3.5 w-3.5" />
                    </button>

                    {/* Favourite */}
                    <button
                      onClick={() => handleFavourite(video.id, video.is_favorite)}
                      className="shrink-0 p-1"
                      aria-label="Toggle favourite"
                    >
                      <Heart
                        className={`h-3.5 w-3.5 transition-colors ${
                          video.is_favorite ? "fill-destructive text-destructive" : "text-muted-foreground hover:text-destructive"
                        }`}
                      />
                    </button>

                    {/* Remove from history */}
                    <button
                      onClick={() => removeFromQueue.mutate(video.id)}
                      className="shrink-0 p-1 text-muted-foreground hover:text-destructive transition-colors"
                      aria-label="Remove from history"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  disabled={historyPage === 0}
                  onClick={() => { setHistoryPage((p) => p - 1); setSelected(new Set()); }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground">
                  Page {historyPage + 1} / {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  disabled={historyPage >= totalPages - 1}
                  onClick={() => { setHistoryPage((p) => p + 1); setSelected(new Set()); }}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

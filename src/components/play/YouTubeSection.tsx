import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useYoutubeQueue } from "@/hooks/useYoutubeQueue";
import { usePrivateQueue } from "@/hooks/usePrivateQueue";
import { PlaylistsPanel } from "@/components/play/PlaylistsPanel";
import { PrivatePlayer } from "@/components/play/PrivatePlayer";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePlaylists, usePlaylistItemMutations } from "@/hooks/usePlaylists";
import { useYouTubeSearch, type YouTubeSearchResult } from "@/hooks/useYouTubeSearch";
import { useDeviceId } from "@/hooks/useDeviceId";
import { toast } from "@/hooks/use-toast";
import {
  Youtube, Play, ListMusic, Search, Trash2, Clock, User,
  GripVertical, Heart, ChevronLeft, ChevronRight, ListPlus,
  CheckSquare, Square, X, BookMarked, Headphones, Radio, Loader2, Plus,
} from "lucide-react";

const PAGE_SIZE = 10;

type YTTab = "queue" | "history" | "playlists";
type MusicMode = "private" | "live";

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

function getModeFromStorage(): MusicMode {
  return (localStorage.getItem("music-mode") as MusicMode) || "private";
}

export function YouTubeSection({ playerName }: YouTubeSectionProps) {
  const [mode, setMode] = useState<MusicMode>(getModeFromStorage);
  const deviceId = useDeviceId();

  const liveQueue = useYoutubeQueue();
  const privateQueue = usePrivateQueue();
  const { playlists } = usePlaylists();
  const { addItem: addPlaylistItem } = usePlaylistItemMutations();
  const youtubeSearch = useYouTubeSearch();

  const q = mode === "live" ? liveQueue : privateQueue;

  const {
    currentVideo, queue, recentVideos,
    playNow, addToQueue, removeFromQueue, reorderQueue, toggleFavorite,
  } = q;

  const [videoUrl, setVideoUrl] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [localQueue, setLocalQueue] = useState<typeof queue | null>(null);
  const [activeTab, setActiveTab] = useState<YTTab>("playlists");
  const [selectedSearchResult, setSelectedSearchResult] = useState<YouTubeSearchResult | null>(null);
  const [isPlaylistDialogOpen, setIsPlaylistDialogOpen] = useState(false);
  const dragIndex = useRef<number | null>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  // History pagination & multi-select
  const [historyPage, setHistoryPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const displayQueue = localQueue ?? queue;
  const isPending = playNow.isPending || addToQueue.isPending;
  const videoId = extractVideoId(videoUrl.trim());
  const searchResults = youtubeSearch.data?.results ?? [];

  const totalPages = Math.ceil(recentVideos.length / PAGE_SIZE);
  const pageVideos = recentVideos.slice(historyPage * PAGE_SIZE, (historyPage + 1) * PAGE_SIZE);

  const switchMode = (m: MusicMode) => {
    setMode(m);
    localStorage.setItem("music-mode", m);
    setLocalQueue(null);
    setActiveTab("playlists");
    setHistoryPage(0);
    setSelected(new Set());
  };

  /* ── URL submit ─────────────────────────────────── */
  const handlePlayNow = () => {
    if (!videoId) return;
    playNow.mutate({ video_id: videoId, queued_by: playerName }, { onSuccess: () => setVideoUrl("") });
  };
  const handleAddToQueue = () => {
    if (!videoId) return;
    addToQueue.mutate({ video_id: videoId, queued_by: playerName }, { onSuccess: () => setVideoUrl("") });
  };

  const handleSearch = () => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 3 || !deviceId) return;
    youtubeSearch.mutate({ query: trimmed, deviceId });
  };

  const handleSearchPlayNow = (result: YouTubeSearchResult) => {
    playNow.mutate({ video_id: result.videoId, queued_by: playerName });
  };

  const handleSearchAddToQueue = (result: YouTubeSearchResult) => {
    addToQueue.mutate({ video_id: result.videoId, queued_by: playerName });
  };

  const handleOpenPlaylistDialog = (result: YouTubeSearchResult) => {
    setSelectedSearchResult(result);
    setIsPlaylistDialogOpen(true);
  };

  const handleAddSearchResultToPlaylist = async (playlistId: string) => {
    if (!selectedSearchResult) return;
    try {
      await addPlaylistItem.mutateAsync({
        playlist_id: playlistId,
        video_id: selectedSearchResult.videoId,
        title: selectedSearchResult.title,
        thumbnail_url: selectedSearchResult.thumbnailUrl,
        channel_title: selectedSearchResult.channelTitle,
        added_by: playerName,
      });
      toast({
        title: "Added to playlist",
        description: `"${selectedSearchResult.title}" is now in your playlist.`,
      });
      setIsPlaylistDialogOpen(false);
      setSelectedSearchResult(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not add the video.";
      toast({ title: "Add failed", description: message });
    }
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
      reorderQueue.mutate(localQueue.map((v) => v.id));
      setLocalQueue(null);
    }
    dragIndex.current = null;
  };

  /* ── Multi-select helpers ───────────────────────── */
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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

  /* ── Playlist callbacks for routing to active queue ── */
  const handlePlaylistPlayNow = (vid: string) => {
    playNow.mutate({ video_id: vid, queued_by: playerName });
  };
  const handlePlaylistAddToQueue = (vid: string) => {
    addToQueue.mutate({ video_id: vid, queued_by: playerName });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <Youtube className="h-5 w-5 text-destructive" />
          YouTube
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Mode toggle */}
        <div className="flex gap-1 p-1 rounded-lg bg-muted">
          <button
            onClick={() => switchMode("private")}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-all ${
              mode === "private"
                ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Headphones className="h-4 w-4" />
            My Music
          </button>
          <button
            onClick={() => switchMode("live")}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-all ${
              mode === "live"
                ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Radio className="h-4 w-4" />
            Live Share
          </button>
        </div>

        {/* Mode description */}
        <p className="text-xs text-muted-foreground text-center">
          {mode === "private"
            ? "🎧 Playing on this device only — won't affect others"
            : "📡 Shared queue — syncs with the TV dashboard and other users"}
        </p>

        {/* Private player */}
        {mode === "private" && (
          <PrivatePlayer
            videoId={currentVideo?.video_id}
            onEnded={() => privateQueue.advanceQueue.mutate(currentVideo?.id)}
          />
        )}

        {/* Now Playing (live mode) */}
        {mode === "live" && currentVideo && (
          <div className="bg-secondary/30 rounded-lg p-3 border border-border">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Play className="h-3 w-3 fill-current text-primary" />
              <span className="text-primary font-medium">Now Playing on TV</span>
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

        {/* Now Playing info (private mode) */}
        {mode === "private" && currentVideo && (
          <div className="flex items-center gap-2">
            <Play className="h-3 w-3 fill-current text-primary shrink-0" />
            <p className="font-medium line-clamp-1 text-sm flex-1">{currentVideo.title}</p>
            <button
              onClick={() => handleFavourite(currentVideo.id, currentVideo.is_favorite)}
              aria-label="Toggle favourite"
            >
              <Heart
                className={`h-4 w-4 transition-colors ${
                  currentVideo.is_favorite ? "fill-destructive text-destructive" : "text-muted-foreground hover:text-destructive"
                }`}
              />
            </button>
          </div>
        )}

        {/* Sub-tabs: Queue / History / Playlists */}
        <div className="flex gap-1 border-b border-border pb-0">
          {([
            { id: "queue" as const, label: "Queue", icon: ListMusic, count: displayQueue.length },
            { id: "history" as const, label: "History", icon: Clock, count: recentVideos.length },
            { id: "playlists" as const, label: "Playlists", icon: BookMarked, count: null },
          ]).map(({ id, label, icon: Icon, count }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-t-md border-b-2 transition-colors ${
                activeTab === id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3 w-3" />
              {label}
              {count !== null && count > 0 && (
                <span className="ml-0.5 text-muted-foreground">({count})</span>
              )}
            </button>
          ))}
        </div>

        {/* Queue tab */}
        {activeTab === "queue" && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-secondary/20 p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">Search YouTube</p>
                  <p className="text-xs text-muted-foreground">
                    Search by artist and song. Up to 4 results.
                  </p>
                </div>
                {youtubeSearch.data && (
                  <span className="text-[11px] text-muted-foreground">
                    {youtubeSearch.data.remainingSearches} searches left today
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search artist and song..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="pl-9"
                  />
                </div>
                <Button
                  type="button"
                  onClick={handleSearch}
                  disabled={searchQuery.trim().length < 3 || youtubeSearch.isPending || !deviceId}
                  className="shrink-0"
                >
                  {youtubeSearch.isPending ? (
                    <>
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      Searching
                    </>
                  ) : (
                    <>
                      <Search className="mr-1 h-4 w-4" />
                      Search
                    </>
                  )}
                </Button>
              </div>
              {youtubeSearch.error && (
                <p className="text-xs text-destructive">{youtubeSearch.error.message}</p>
              )}
              {searchResults.length > 0 && (
                <div className="space-y-2">
                  {searchResults.map((result) => (
                    <div
                      key={result.videoId}
                      className="rounded-md border border-border/60 bg-background/85 p-2"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={result.thumbnailUrl ?? `https://img.youtube.com/vi/${result.videoId}/hqdefault.jpg`}
                          alt={result.title}
                          className="h-12 w-20 rounded object-cover bg-secondary shrink-0"
                          loading="lazy"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium line-clamp-1">{result.title}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {result.channelTitle ?? "Unknown channel"}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <Button type="button" size="sm" onClick={() => handleSearchPlayNow(result)}>
                          <Play className="mr-1 h-3.5 w-3.5" />
                          Play now
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => handleSearchAddToQueue(result)}>
                          <ListMusic className="mr-1 h-3.5 w-3.5" />
                          Add to queue
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => handleOpenPlaylistDialog(result)}>
                          <Plus className="mr-1 h-3.5 w-3.5" />
                          Add to playlist
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-lg border bg-secondary/20 p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">Add by link</p>
                  <p className="text-xs text-muted-foreground">
                    Paste a YouTube URL or video ID to play it now or queue it.
                  </p>
                </div>
              </div>
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
            {displayQueue.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Queue is empty</p>
            ) : (
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
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive shrink-0"
                      onClick={() => removeFromQueue.mutate(video.id)}
                      aria-label="Remove from queue"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* History tab */}
        {activeTab === "history" && (
          <div className="space-y-2">
            {/* Header row */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{recentVideos.length} songs</p>
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

            {recentVideos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No history yet</p>
            ) : (
              <>
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
              </>
            )}
          </div>
        )}

        {/* Playlists tab */}
        {activeTab === "playlists" && (
          <PlaylistsPanel
            playerName={playerName}
            recentVideos={recentVideos}
            onPlayNow={handlePlaylistPlayNow}
            onAddToQueue={handlePlaylistAddToQueue}
          />
        )}

        <Dialog open={isPlaylistDialogOpen} onOpenChange={setIsPlaylistDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add to playlist</DialogTitle>
              <DialogDescription>
                {selectedSearchResult ? selectedSearchResult.title : "Choose a playlist"}
              </DialogDescription>
            </DialogHeader>
            {playlists.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Create a playlist first in the Playlists tab.
              </p>
            ) : (
              <div className="space-y-2">
                {playlists.map((playlist) => (
                  <button
                    key={playlist.id}
                    type="button"
                    onClick={() => handleAddSearchResultToPlaylist(playlist.id)}
                    className="flex w-full items-center gap-2 rounded-md border border-border/60 bg-secondary/10 px-3 py-2 text-left transition-colors hover:bg-secondary/30"
                    disabled={addPlaylistItem.isPending}
                  >
                    <BookMarked className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium line-clamp-1">{playlist.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {playlist.item_count ?? 0} {(playlist.item_count ?? 0) === 1 ? "song" : "songs"}
                      </p>
                    </div>
                    {addPlaylistItem.isPending && (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePlaylists, usePlaylistItems, type Playlist, type PlaylistItem } from "@/hooks/usePlaylists";
import { useYoutubeQueue, type YouTubeVideo, fetchYouTubePlaylist, fetchYouTubeMeta } from "@/hooks/useYoutubeQueue";
import { toast } from "@/hooks/use-toast";
import {
  ListMusic, Plus, Trash2, Play, ChevronRight, ChevronLeft,
  X, Check, Music2, Pencil,
} from "lucide-react";

interface PlaylistsPanelProps {
  playerName: string;
  recentVideos: YouTubeVideo[];
  onPlayNow?: (videoId: string) => void;
  onAddToQueue?: (videoId: string) => void;
}

/* ── Inner: items view for a single playlist ─────────────────────────────── */
function PlaylistItemsView({
  playlist,
  playerName,
  recentVideos,
  onBack,
  onPlayNow,
  onAddToQueue,
}: {
  playlist: Playlist;
  playerName: string;
  recentVideos: YouTubeVideo[];
  onBack: () => void;
  onPlayNow?: (videoId: string) => void;
  onAddToQueue?: (videoId: string) => void;
}) {
  const { items, addItem, removeItem } = usePlaylistItems(playlist.id);
  const { addToQueue: liveAddToQueue } = useYoutubeQueue();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [search, setSearch] = useState("");
  const [mixUrl, setMixUrl] = useState("");
  const [mixLoading, setMixLoading] = useState(false);
  const [singleUrl, setSingleUrl] = useState("");
  const [singleLoading, setSingleLoading] = useState(false);

  const filtered = recentVideos.filter(
    (v) =>
      v.title.toLowerCase().includes(search.toLowerCase()) ||
      v.queued_by.toLowerCase().includes(search.toLowerCase()),
  );

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

  // video_ids already in this playlist for quick lookup
  const inPlaylist = new Set(items.map((i) => i.video_id));

  const handlePlayList = () => {
    items.forEach((item) =>
      addToQueue.mutate({ video_id: item.video_id, queued_by: playerName }),
    );
  };

  const handleAddFromHistory = (video: YouTubeVideo) => {
    addItem.mutate({
      playlist_id: playlist.id,
      video_id: video.video_id,
      title: video.title,
      thumbnail_url: video.thumbnail_url,
      channel_title: video.channel_title,
      added_by: playerName,
    });
  };

  const handleImportMix = async () => {
    if (!mixUrl) return;
    let list: string | null = null;
    try {
      const url = new URL(mixUrl);
      list = url.searchParams.get("list");
    } catch {
      // invalid url, just ignore
    }
    if (!list) return;

    try {
      setMixLoading(true);
      // supply seed video id if URL contained one so we can fall back to
      // scraping the watch page when the playlist page is empty (mixes).
      const video = (() => {
        try {
          return new URL(mixUrl).searchParams.get("v");
        } catch {
          return null;
        }
      })();
      const ids = await fetchYouTubePlaylist(list, video ?? undefined);
      if (ids === null) {
        toast({
          title: "Import failed",
          description: "Could not reach the playlist service. Is the Supabase function running?",
        });
        return;
      }
      if (ids.length === 0) {
        toast({
          title: "No videos found",
          description: "Could not import from that playlist/mix URL.",
        });
        return;
      }
      const toAdd = ids.filter((id) => !inPlaylist.has(id));
      if (toAdd.length === 0) {
        toast({
          title: "Nothing new",
          description: "All videos are already in this playlist.",
        });
        return;
      }
      for (const id of toAdd) {
        const meta = await fetchYouTubeMeta(id);
        addItem.mutate({
          playlist_id: playlist.id,
          video_id: id,
          title: meta.title,
          thumbnail_url: meta.thumbnail_url,
          channel_title: null,
          added_by: playerName,
        });
      }
      toast({
        title: "Imported videos",
        description: `Added ${toAdd.length} new song${toAdd.length === 1 ? "" : "s"}.`,
      });
      setMixUrl("");
      setShowAddDialog(false);
    } finally {
      setMixLoading(false);
    }
  };

  const handleAddUrl = async () => {
    if (!singleUrl) return;
    const vid = extractVideoId(singleUrl.trim());
    if (!vid) {
      toast({ title: "Invalid URL", description: "Please enter a valid YouTube link." });
      return;
    }
    if (inPlaylist.has(vid)) {
      toast({ title: "Already added", description: "This video is already in the playlist." });
      setSingleUrl("");
      return;
    }
    try {
      setSingleLoading(true);
      const meta = await fetchYouTubeMeta(vid);
      addItem.mutate({
        playlist_id: playlist.id,
        video_id: vid,
        title: meta.title,
        thumbnail_url: meta.thumbnail_url,
        channel_title: null,
        added_by: playerName,
      });
      toast({ title: "Added", description: `"${meta.title}" has been added.` });
      setSingleUrl("");
    } finally {
      setSingleLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="p-1 rounded hover:bg-secondary/60 transition-colors text-muted-foreground"
          aria-label="Back"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm line-clamp-1">{playlist.name}</p>
          <p className="text-xs text-muted-foreground">{items.length} songs</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs shrink-0"
          onClick={() => setShowAddDialog(true)}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add songs
        </Button>
        <Button
          size="sm"
          className="h-7 px-2 text-xs shrink-0"
          onClick={handlePlayList}
          disabled={items.length === 0 || addToQueue.isPending}
        >
          <Play className="h-3.5 w-3.5 mr-1" />
          Play list
        </Button>
      </div>

      {/* Items */}
      {items.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <Music2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No songs yet</p>
          <p className="text-xs">Add songs from your history</p>
        </div>
      ) : (
        <div className="space-y-1">
          {items.map((item: PlaylistItem, idx) => (
            <div
              key={item.id}
              className="flex items-center gap-2 p-2 rounded-md bg-secondary/20 border border-border/50"
            >
              <span className="text-xs text-muted-foreground w-4 shrink-0 text-right">{idx + 1}</span>
              <img
                src={item.thumbnail_url ?? `https://img.youtube.com/vi/${item.video_id}/hqdefault.jpg`}
                alt={item.title}
                className="h-8 w-12 rounded object-cover bg-secondary shrink-0"
                loading="lazy"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium line-clamp-1">{item.title}</p>
                <p className="text-xs text-muted-foreground">added by {item.added_by}</p>
              </div>
              <button
                onClick={() => removeItem.mutate(item.id)}
                className="shrink-0 p-1 text-muted-foreground hover:text-destructive transition-colors"
                aria-label="Remove"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add from history dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add to "{playlist.name}"</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Search history..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-2"
          />
          {/*
            Mix/playlist import UI temporarily hidden.  The state and handler
            (`mixUrl`, `handleImportMix`, etc.) remain in the code for future
            re‑enablement, but the controls are not rendered.
          */}
          {false && (
            <div className="flex gap-2 mb-2">
              <Input
                placeholder="Paste YouTube mix/playlist URL"
                value={mixUrl}
                onChange={(e) => setMixUrl(e.target.value)}
              />
              <Button
                size="sm"
                disabled={!mixUrl || mixLoading}
                onClick={handleImportMix}
              >
                {mixLoading ? "Importing…" : "Import"}
              </Button>
            </div>
          )}
          {/* Direct add: paste a single YouTube link to add immediately */}
          <div className="flex gap-2 mb-2">
            <Input
              placeholder="Paste a YouTube link to add directly"
              value={singleUrl}
              onChange={(e) => setSingleUrl(e.target.value)}
            />
            <Button
              size="sm"
              disabled={!singleUrl || singleLoading}
              onClick={handleAddUrl}
            >
              {singleLoading ? "Adding…" : "Add"}
            </Button>
          </div>
          <ScrollArea className="h-72">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No songs in history</p>
            ) : (
              <div className="space-y-1 pr-2">
                {filtered.map((video) => {
                  const already = inPlaylist.has(video.video_id);
                  return (
                    <button
                      key={video.id}
                      onClick={() => !already && handleAddFromHistory(video)}
                      disabled={already || addItem.isPending}
                      className={`w-full flex items-center gap-2 p-2 rounded-md text-left transition-colors ${
                        already
                          ? "opacity-50 cursor-default bg-secondary/10"
                          : "hover:bg-secondary/40"
                      }`}
                    >
                      <img
                        src={video.thumbnail_url ?? `https://img.youtube.com/vi/${video.video_id}/hqdefault.jpg`}
                        alt={video.title}
                        className="h-8 w-12 rounded object-cover bg-secondary shrink-0"
                        loading="lazy"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium line-clamp-1">{video.title}</p>
                        <p className="text-xs text-muted-foreground">{video.queued_by}</p>
                      </div>
                      {already && <Check className="h-4 w-4 text-primary shrink-0" />}
                      {!already && <Plus className="h-4 w-4 text-muted-foreground shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Main panel ──────────────────────────────────────────────────────────── */
export function PlaylistsPanel({ playerName, recentVideos }: PlaylistsPanelProps) {
  const { playlists, createPlaylist, deletePlaylist, renamePlaylist } = usePlaylists();
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState("");

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    if (deletePassword !== "1234") {
      toast({ title: "Wrong password", description: "The password is incorrect." });
      return;
    }
    deletePlaylist.mutate(deleteTarget, {
      onSuccess: () => {
        toast({ title: "Deleted", description: "Playlist removed." });
        setDeleteConfirmOpen(false);
        setDeleteTarget(null);
        setDeletePassword("");
      },
      onError: () => {
        toast({ title: "Delete failed", description: "Could not delete playlist." });
      },
    });
  };

  const handleCreate = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    createPlaylist.mutate({ name: trimmed, created_by: playerName });
    setNewName("");
  };

  const handleRename = (id: string) => {
    const trimmed = editName.trim();
    if (!trimmed) return;
    renamePlaylist.mutate({ id, name: trimmed });
    setEditingId(null);
  };

  if (selectedPlaylist) {
    return (
      <PlaylistItemsView
        playlist={selectedPlaylist}
        playerName={playerName}
        recentVideos={recentVideos}
        onBack={() => setSelectedPlaylist(null)}
      />
    );
  }

  return (
    <div className="space-y-3">
      {/* Create new */}
      <div className="flex gap-2">
        <Input
          placeholder="New playlist name..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          className="h-8 text-sm"
        />
        <Button
          size="sm"
          className="h-8 px-3 shrink-0"
          onClick={handleCreate}
          disabled={!newName.trim() || createPlaylist.isPending}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* List */}
      {playlists.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <ListMusic className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No playlists yet</p>
          <p className="text-xs">Create one above to get started</p>
        </div>
      ) : (
        <div className="space-y-1">
          {playlists.map((pl: Playlist) => (
            <div
              key={pl.id}
              className="flex items-center gap-2 p-2 rounded-md border border-border/50 bg-secondary/20 group"
            >
              {editingId === pl.id ? (
                <>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRename(pl.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="h-7 text-xs flex-1"
                    autoFocus
                  />
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={() => handleRename(pl.id)}>
                    <Check className="h-3.5 w-3.5 text-primary" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={() => setEditingId(null)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </>
              ) : (
                <>
                  <button
                    className="flex-1 text-left flex items-center gap-2 min-w-0"
                    onClick={() => setSelectedPlaylist(pl)}
                  >
                    <ListMusic className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium line-clamp-1">{pl.name}</span>
                    <span className="text-xs text-muted-foreground">by {pl.created_by}</span>
                    <span className="text-xs text-muted-foreground ml-auto shrink-0">
                      {pl.item_count ?? 0} {(pl.item_count ?? 0) === 1 ? "song" : "songs"}
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </button>
                  <button
                    onClick={() => { setEditingId(pl.id); setEditName(pl.name); }}
                    className="shrink-0 p-1 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Rename"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => { setDeleteTarget(pl.id); setDeleteConfirmOpen(true); setDeletePassword(""); }}
                    className="shrink-0 p-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Delete playlist"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>
          <p className="text-sm mb-2">Enter password to delete this playlist.</p>
          <Input
            placeholder="Password"
            type="password"
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
            className="mb-3"
          />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => { setDeleteConfirmOpen(false); setDeleteTarget(null); setDeletePassword(""); }}>
              Cancel
            </Button>
            <Button onClick={handleConfirmDelete} disabled={!deletePassword} variant="destructive">
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
  // Delete confirmation modal


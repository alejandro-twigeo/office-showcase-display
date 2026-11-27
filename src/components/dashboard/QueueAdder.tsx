import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, Search, Loader2, ListPlus } from "lucide-react";
import { useYouTubeSearch } from "@/hooks/useYouTubeSearch";
import { getDeviceId } from "@/hooks/useDeviceId";

/** A YouTube link or a bare 11-character video id → the id */
function videoIdFrom(text: string): string | null {
  const t = text.trim();
  const m = t.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/) ?? t.match(/^([\w-]{11})$/);
  return m ? m[1] : null;
}

/**
 * The ＋ on the TV's Now playing tile. On a laptop it opens a small box to search YouTube or paste
 * a link, the same as on the Play page; not logged in, it sends you to Music on the Play page.
 */
export function QueueAdder({ me, onAdd, onLogin }: { me: string | null; onAdd: (videoId: string) => void; onLogin: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [added, setAdded] = useState<string | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const search = useYouTubeSearch();
  const [pos, setPos] = useState({ top: 0, right: 0 });

  const toggle = () => {
    if (!me) return onLogin();
    const r = btn.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 8, right: window.innerWidth - r.right });
    setOpen((o) => !o);
    setAdded(null);
  };

  // Click outside or Esc closes it
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const linkId = videoIdFrom(text);
  const add = (id: string, title?: string) => {
    onAdd(id);
    setAdded(title ?? "Your song");
    setText("");
    search.reset();
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (linkId) return add(linkId);
    if (text.trim().length >= 3) search.mutate({ query: text, deviceId: getDeviceId() });
  };

  return (
    <>
      <button
        ref={btn}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        className="flex h-[clamp(24px,1.7vw,36px)] w-[clamp(24px,1.7vw,36px)] shrink-0 items-center justify-center rounded-full border border-primary/40 text-primary transition-colors [@media(hover:hover)]:hover:bg-primary/10"
        aria-label="Add a song"
        title={me ? "Add a song" : "Add a song on the Play page"}
      >
        <Plus className="h-[60%] w-[60%]" />
      </button>
      {open &&
        createPortal(
          <div
            ref={box}
            style={{ top: pos.top, right: pos.right }}
            className="tv-2027 fixed z-[80] w-[min(440px,90vw)] space-y-2 rounded-2xl border bg-[hsl(var(--card))] p-3 text-sm shadow-[0_20px_60px_-20px_hsl(var(--foreground)/0.35)] animate-in fade-in zoom-in-95 duration-150"
          >
            <form onSubmit={submit} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  autoFocus
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    setAdded(null);
                  }}
                  placeholder="Search artist and song, or paste a link"
                  className="h-9 w-full rounded-lg border bg-background pl-8 pr-2 outline-none focus:border-primary"
                />
              </div>
              <button
                type="submit"
                disabled={!linkId && text.trim().length < 3}
                className="flex h-9 shrink-0 items-center gap-1 rounded-lg bg-primary px-3 font-semibold text-primary-foreground disabled:opacity-40"
              >
                {search.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : linkId ? <ListPlus className="h-4 w-4" /> : <Search className="h-4 w-4" />}
                {linkId ? "Add" : "Search"}
              </button>
            </form>
            {added && <p className="text-xs text-green-700">✓ {added} is in the queue</p>}
            {search.error && <p className="text-xs text-destructive">{search.error.message}</p>}
            {(search.data?.results ?? []).map((r) => (
              <button
                key={r.videoId}
                type="button"
                onClick={() => add(r.videoId, `“${r.title}”`)}
                className="flex w-full items-center gap-2 rounded-lg p-1.5 text-left hover:bg-primary/10"
              >
                <img src={r.thumbnailUrl ?? `https://img.youtube.com/vi/${r.videoId}/hqdefault.jpg`} alt="" className="h-10 w-16 shrink-0 rounded object-cover" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{r.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{r.channelTitle}</span>
                </span>
                <ListPlus className="h-4 w-4 shrink-0 text-primary" />
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}

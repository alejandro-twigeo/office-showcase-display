import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useOfficeActivity, GAME_NAMES } from "@/hooks/useOfficeActivity";
import { DEDICATION_SEPARATOR } from "@/lib/dedication";

/** Where a tip's "Try it" button takes you on the phone */
export type TipTarget = { tab: "games" | "polls" | "youtube" | "vibes" | "news" | "leaderboards"; game?: string };

interface Tip {
  id: string;
  emoji: string;
  title: string;
  body: string;
  target: TipTarget;
}

const GAME_TIPS: Record<string, { emoji: string; body: string }> = {
  wordle: { emoji: "🟩", body: "Guess today's 5-letter word in 6 tries. Green is the right spot, yellow is in the word." },
  geoguessr: { emoji: "🌍", body: "Look at the photo and drop a pin where you think it is. The closer, the more points." },
  city_guess: { emoji: "🏙️", body: "A photo from a city. Tap the map where you think it was taken." },
  color_memory: { emoji: "🎨", body: "See a colour for a moment, then rebuild it from memory." },
  this_or_that: { emoji: "⚖️", body: "Five quick questions. Guess what most of the office picked." },
  sudoku: { emoji: "🔢", body: "A 6×6 sudoku. Rows, columns and boxes turn green when they're complete." },
  pairs: { emoji: "🃏", body: "Flip two cards at a time and find all the pairs in as few moves as you can." },
  labyrinth: { emoji: "🌀", body: "Draw one line through every cell, passing the numbers in order." },
};
// The activity feed calls GeoGuessr "geo"; the phone calls it "geoguessr"
const FEED_ID: Record<string, string> = { geoguessr: "geo" };

/** What this person has already done, so we only show tips for things they haven't tried. */
function useFeatureUse(playerName: string) {
  return useQuery({
    queryKey: ["feature-use", playerName],
    enabled: !!playerName,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const db = supabase as any;
      const count = async (q: any) => ((await q).count ?? 0) as number;
      const [kudos, dedications, votes, challenges, teamRiddle] = await Promise.all([
        count(db.from("positive_messages").select("id", { count: "exact", head: true }).ilike("created_by", playerName)),
        count(db.from("youtube_queue").select("id", { count: "exact", head: true }).ilike("queued_by", `${playerName}${DEDICATION_SEPARATOR}%`)),
        count(db.from("votes").select("id", { count: "exact", head: true }).eq("player_name", playerName)),
        count(db.from("minigame_scores").select("id", { count: "exact", head: true }).eq("game_id", "challenge").like("player_name", `${playerName}>%`)),
        count(db.from("minigame_scores").select("id", { count: "exact", head: true }).eq("game_id", "team_riddle").eq("player_name", playerName)),
      ]);
      /* eslint-enable @typescript-eslint/no-explicit-any */
      return { kudos, dedications, votes, challenges, teamRiddle };
    },
  });
}

const SHOWN_THIS_VISIT = "tip-shown-this-visit";
const LAST_TIP = "tip-last-shown";

/**
 * Once per visit, a small card about one thing this person hasn't tried yet:
 * giving kudos, challenging someone, dedicating a song, the team riddle, the poll,
 * or a game they've never played. "Try it" takes them there; "Got it" closes it.
 * It rotates, so the same tip doesn't come back twice in a row.
 * Preview: add ?tip to the address to show one every time.
 */
export function TipPopup({ playerName, onTry }: { playerName: string; onTry: (t: TipTarget) => void }) {
  const a = useOfficeActivity();
  const { data: used } = useFeatureUse(playerName);
  const [open, setOpen] = useState(false);
  const [tip, setTip] = useState<Tip | null>(null);

  const candidates = useMemo<Tip[]>(() => {
    if (!used || !a.loaded) return [];
    const played = new Set(a.events.filter((e) => e.player === playerName).map((e) => e.game));
    const list: Tip[] = [];
    if (!used.kudos)
      list.push({ id: "kudos", emoji: "💛", title: "Give someone kudos", body: "Thank a colleague and tag them with @. It pops up on the TV with confetti.", target: { tab: "vibes" } });
    if (!used.challenges && played.size > 0)
      list.push({ id: "challenge", emoji: "⚔️", title: "Challenge a colleague", body: "Pick one of your scores today and dare someone to beat it. It shows on the TV and on their phone.", target: { tab: "games" } });
    if (!used.dedications)
      list.push({ id: "dedicate", emoji: "🎵", title: "Dedicate a song", body: "In Music → Live Share, pick someone before you queue a song. The TV shows who it's for.", target: { tab: "youtube" } });
    if (!used.teamRiddle)
      list.push({ id: "team_riddle", emoji: "🧠", title: "Crack the team riddle", body: "One riddle a week. Every game anyone plays unlocks another clue. Can you guess it first?", target: { tab: "games", game: "team_riddle" } });
    if (!used.votes)
      list.push({ id: "poll", emoji: "📊", title: "Vote in the poll", body: "There's a new question every day. Your vote shows up on the TV right away.", target: { tab: "polls" } });
    for (const [game, t] of Object.entries(GAME_TIPS)) {
      if (!played.has(FEED_ID[game] ?? game)) {
        const name = GAME_NAMES[FEED_ID[game] ?? game] ?? game;
        list.push({ id: `game-${game}`, emoji: t.emoji, title: `You haven't tried ${name} yet`, body: t.body, target: { tab: "games", game } });
      }
    }
    return list;
  }, [used, a.loaded, a.events, playerName]);

  useEffect(() => {
    if (open || tip || !candidates.length) return;
    const force = new URLSearchParams(window.location.search).has("tip");
    try {
      if (!force && sessionStorage.getItem(SHOWN_THIS_VISIT)) return;
    } catch { /* storage blocked: just show it */ }
    let lastId: string | null = null;
    try {
      lastId = localStorage.getItem(LAST_TIP);
    } catch { /* ignore */ }
    const pool = candidates.filter((c) => c.id !== lastId);
    const pick = (pool.length ? pool : candidates)[0];
    const t = setTimeout(() => {
      setTip(pick);
      setOpen(true);
      try {
        sessionStorage.setItem(SHOWN_THIS_VISIT, "1");
        localStorage.setItem(LAST_TIP, pick.id);
      } catch { /* ignore */ }
    }, 900);
    return () => clearTimeout(t);
  }, [candidates, open, tip]);

  if (!open || !tip) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/25 p-3 pb-[calc(5.6rem+env(safe-area-inset-bottom,0px))] animate-in fade-in duration-200" onClick={() => setOpen(false)}>
      <div
        role="dialog"
        aria-label={tip.title}
        className="relative w-full max-w-sm rounded-2xl bg-card p-5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)] animate-in slide-in-from-bottom-6 zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="absolute right-3 top-3 rounded-full p-1.5 text-muted-foreground active:bg-secondary" onClick={() => setOpen(false)} aria-label="Close">
          <X className="h-4 w-4" />
        </button>
        <p className="text-xs font-medium text-muted-foreground">Did you know?</p>
        <div className="mt-2 flex items-start gap-3">
          <span className="text-4xl leading-none">{tip.emoji}</span>
          <div className="min-w-0">
            <p className="text-base font-semibold leading-tight">{tip.title}</p>
            <p className="mt-1 text-sm leading-snug text-muted-foreground">{tip.body}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Got it
          </Button>
          <Button
            onClick={() => {
              setOpen(false);
              onTry(tip.target);
            }}
          >
            Try it
          </Button>
        </div>
      </div>
    </div>
  );
}

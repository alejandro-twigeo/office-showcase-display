import { PlayerAvatar } from '@/components/PlayerAvatar';
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Swords, Check, X } from "lucide-react";
import {
  useOfficeActivity,
  OFFICES,
  GAME_NAMES,
} from "@/hooks/useOfficeActivity";
import { useSubmitMinigameScore } from "@/hooks/useMinigameScore";
import { useDeviceId } from "@/hooks/useDeviceId";
import { buzz } from "@/lib/haptics";

interface PlayHubProps {
  playerName: string;
  roundId?: string;
  /** Open a game by its id ("geo", "wordle", "sudoku", …) */
  onOpenGame: (gameId: string) => void;
}

/**
 * Top of the Games tab: your streak, your office's place,
 * challenges sent to you, and a way to challenge someone.
 */
export function PlayHub({ playerName, roundId, onOpenGame }: PlayHubProps) {
  const a = useOfficeActivity();
  const deviceId = useDeviceId();
  const submit = useSubmitMinigameScore();
  const [composing, setComposing] = useState(false);
  const [game, setGame] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const me = a.players.get(playerName);
  const streak = a.streaks.get(playerName) ?? 0;
  const playedToday = a.events.some((e) => e.player === playerName && e.day === a.today);
  const officeRank = me ? a.officePoints.findIndex((o) => o.office === me.office) + 1 : 0;
  const office = me ? OFFICES[me.office] : undefined;

  const myToday = useMemo(
    () => a.events.filter((e) => e.player === playerName && e.day === a.today && e.game !== "riddle"),
    [a.events, a.today, playerName]
  );
  const inbox = a.challenges.filter((c) => c.to === playerName);
  const others = [...a.players.values()].filter((p) => p.name !== playerName).sort((x, y) => x.name.localeCompare(y.name));

  const send = async () => {
    const mine = myToday.find((e) => e.game === game);
    if (!mine || !to || !game) return;
    await submit.mutateAsync({
      game_id: "challenge",
      player_name: `${playerName}>${to}>${game}`,
      device_id: deviceId,
      score: 0,
      round_id: roundId,
      meta: { from: playerName, to, game, target: mine.score },
    });
    buzz([10, 40, 14]);
    setSent(`Sent! ${to} has today to beat your ${mine.score} in ${GAME_NAMES[game] ?? game}.`);
    setComposing(false);
    setGame(null);
    setTo(null);
  };

  return (
    <div className="space-y-2">
      {/* At a glance: one frosted strip; on wider screens the challenge button sits at its end */}
      <div className="glass-chip flex items-stretch rounded-2xl">
        <div className="grid min-w-0 flex-1 grid-cols-2 divide-x divide-foreground/[0.07]">
          <div className="min-w-0 px-3 py-2">
            <p className="text-[0.68rem] text-muted-foreground">Your streak</p>
            <p className="truncate text-sm font-semibold">{streak > 0 ? `🔥 ${streak} ${streak === 1 ? "day" : "days"}` : "Start today"}</p>
            {streak > 0 && !playedToday && <p className="truncate text-[0.65rem] text-orange-600">Play today to keep it</p>}
          </div>
          <div className="min-w-0 px-3 py-2">
            <p className="text-[0.68rem] text-muted-foreground">Office race</p>
            <p className="truncate text-sm font-semibold">
              {office ? `${office.flag} ${officeRank === 1 ? "1st" : officeRank === 2 ? "2nd" : "3rd"}` : "—"}
              {office && <span className="ml-1 font-normal text-muted-foreground">{office.city}</span>}
            </p>
          </div>
        </div>
        {!composing && (
          <button
            type="button"
            onClick={() => { setComposing(true); setSent(null); }}
            className="m-1.5 hidden shrink-0 items-center gap-2 rounded-xl bg-white/80 px-4 text-sm font-medium shadow-sm transition-colors hover:bg-white sm:inline-flex"
          >
            <Swords className="h-4 w-4 text-primary" /> Challenge a colleague
          </button>
        )}
      </div>

      {/* Challenges for you */}
      {inbox.map((c) => (
        <div
          key={c.key}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 animate-in fade-in slide-in-from-top-1 duration-300 ${
            c.status === "beaten" ? "bg-green-600/10" : c.status === "held" ? "bg-secondary/40" : "bg-violet-500/10"
          }`}
        >
          <PlayerAvatar avatar={a.players.get(c.from)?.avatar} name={c.from} size={36} />
          <div className="min-w-0 flex-1 text-xs leading-snug">
            <p className="font-semibold">{c.from} challenged you</p>
            <p className="text-muted-foreground">
              {c.status === "open" && `Beat ${c.target} in ${GAME_NAMES[c.game] ?? c.game} today`}
              {c.status === "beaten" && `You won: ${c.answer} vs ${c.target} 🎯`}
              {c.status === "held" && `${c.from} held on: ${c.target} vs your ${c.answer}`}
            </p>
          </div>
          {c.status === "open" && (
            <Button size="sm" className="h-8 shrink-0" onClick={() => onOpenGame(c.game)}>
              Play
            </Button>
          )}
        </div>
      ))}

      {/* Challenge someone */}
      {!composing ? (
        <div className="space-y-1 sm:space-y-0">
          <button
            type="button"
            onClick={() => { setComposing(true); setSent(null); }}
            className="glass-chip flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-medium sm:hidden"
          >
            <Swords className="h-4 w-4 text-primary" /> Challenge a colleague
          </button>
          {sent && <p className="text-center text-xs text-green-700 animate-in fade-in">{sent}</p>}
        </div>
      ) : (
        <div className="glass-chip space-y-3 rounded-2xl p-3 animate-in fade-in slide-in-from-top-1 duration-300">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Challenge a colleague</p>
            <button className="text-muted-foreground" onClick={() => setComposing(false)} aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
          {myToday.length === 0 ? (
            <p className="text-xs text-muted-foreground">Play a game first, then challenge someone to beat your score today.</p>
          ) : (
            <>
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">1. Which of your scores today?</p>
                <div className="flex flex-wrap gap-1.5">
                  {myToday.map((e) => (
                    <button
                      key={e.game}
                      onClick={() => setGame(e.game)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${game === e.game ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
                    >
                      {GAME_NAMES[e.game] ?? e.game} · {e.score}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">2. Who should beat it?</p>
                <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
                  {others.map((p) => (
                    <button
                      key={p.name}
                      onClick={() => setTo(p.name)}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${to === p.name ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
                    >
                      <PlayerAvatar avatar={p.avatar} name={p.name} size="1.7em" still /> {p.name}
                    </button>
                  ))}
                </div>
              </div>
              <Button className="w-full gap-2" disabled={!game || !to || submit.isPending} onClick={send}>
                <Check className="h-4 w-4" /> Send challenge
              </Button>
              <p className="text-center text-[0.7rem] text-muted-foreground">It shows on the TV and on their phone. They have until the end of today.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

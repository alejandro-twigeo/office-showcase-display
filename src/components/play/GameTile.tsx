import { Play } from 'lucide-react';

/** A soft colour per game, for the tile's wash (the TV uses the same hues) */
const GAME_TINT: Record<string, number> = {
  geoguessr: 8, wordle: 130, city_guess: 210, color_memory: 320, this_or_that: 28,
  sudoku: 230, pairs: 350, labyrinth: 35, riddle: 270, team_riddle: 290,
};

/** One game on the Games home: frosted tile, the game's colour pooled in the corner. */
export function GameTile({ id, name, icon, emoji, onClick }: {
  id: string; name: string; icon?: string; emoji: string; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="game-tile group flex min-w-0 flex-col items-start gap-2 p-2.5 text-left sm:p-3"
      style={{ '--h': GAME_TINT[id] ?? 25 } as React.CSSProperties}
    >
      <span className="flex h-11 w-11 items-center justify-center sm:h-14 sm:w-14">
        {icon ? (
          <img src={icon} alt="" className="h-full w-full object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.12)]" draggable={false} />
        ) : (
          <span className="text-2xl sm:text-3xl">{emoji}</span>
        )}
      </span>
      <span className="flex w-full items-center justify-between gap-1">
        <span className="truncate text-xs font-semibold sm:text-sm">{name}</span>
        <span className="hidden h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/80 text-foreground/70 shadow-sm transition-colors group-hover:bg-primary group-hover:text-primary-foreground sm:flex">
          <Play className="h-3 w-3 translate-x-[1px] fill-current" />
        </span>
      </span>
    </button>
  );
}

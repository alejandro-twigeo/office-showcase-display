import { PlayerAvatar } from '@/components/PlayerAvatar';
import { parseKudos } from "@/lib/kudos";

/** Text with @-tags shown as name pills (orange with avatar if they play, outlined if not). */
export function MentionText({ text, playerNames, avatars }: { text: string; playerNames: string[]; avatars: Map<string, string | null> }) {
  return (
    <>
      {parseKudos(text, playerNames).segments.map((s, i) =>
        "text" in s ? (
          <span key={i}>{s.text}</span>
        ) : (
          <span
            key={i}
            className={`whitespace-nowrap rounded-full px-[0.35em] font-semibold [box-decoration-break:clone] ${
              s.known ? "bg-primary/15" : "outline outline-1 outline-dashed outline-foreground/35"
            }`}
          >
            {s.known ? <PlayerAvatar avatar={avatars.get(s.name)} name={s.name} size="1.3em" still className="mr-[0.2em]" /> : null}
            {s.name}
          </span>
        )
      )}
    </>
  );
}

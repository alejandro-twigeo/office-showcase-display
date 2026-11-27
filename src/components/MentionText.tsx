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
            {s.known && avatars.get(s.name) ? <span className="mr-[0.2em]">{avatars.get(s.name)}</span> : null}
            {s.name}
          </span>
        )
      )}
    </>
  );
}

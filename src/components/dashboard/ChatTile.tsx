import { PlayerAvatar } from '@/components/PlayerAvatar';
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMe, ACTIONABLE } from "@/hooks/useMe";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { chatAgo, CHAT_MAX_LEN, useChatTyping, type ChatMessage } from "@/hooks/useChat";
import { TypingDots } from "@/components/TypingDots";
import { useNewsTopic } from "@/hooks/useNewsTopic";
import { ArrowUpRight, Newspaper } from "lucide-react";
import { PeaceIcon } from "@/components/HandIcons";
import { MentionText } from "@/components/MentionText";
import { starterAt } from "@/lib/chatStarters";
import { ChatBubble, ChatSpeaker } from "@/components/ChatBubble";
import { botColour } from "@/lib/botColour";

/**
 * The office chat on the TV: like a chat app, newest at the bottom. When there are more
 * messages than fit, the oldest fade out at the top (phones can scroll up for them).
 * Nobody needs to log in to see it. On the office TV (not logged in) every message sits on the
 * left; on a laptop where someone is logged in, their own messages move to the right, like any
 * chat app.
 */
export function ChatTile({ messages, now, onSend }: { messages: ChatMessage[]; now: number; onSend?: (body: string, me: string) => void }) {
  // On a laptop: click the tile to write (or log in first)
  const navigate = useNavigate();
  const me = useMe();
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState("");
  const open = () => (me ? setComposing(true) : navigate("/play?tab=chat"));
  const { data: players = [] } = useQuery({
    queryKey: ["players-avatars"],
    queryFn: async () => {
      const { data } = await supabase.from("players").select("name, avatar");
      return data ?? [];
    },
  });
  const avatars = useMemo(() => new Map(players.map((p) => [p.name, p.avatar as string | null])), [players]);
  const playerNames = useMemo(() => [...avatars.keys()], [avatars]);
  const colourOf = (n: string) => botColour(avatars.get(n), n);
  const shown = messages.slice(-12);
  const isMe = (n: string) => !!me && n.trim().toLowerCase() === me.trim().toLowerCase();
  // Someone writing (on a phone or a laptop): small orange dots at the bottom right
  const { typing, notify, stop } = useChatTyping(me);
  // Something to talk about: today's news, one headline at a time, with its link
  const topic = useNewsTopic();

  return (
    <Card onClick={open} className={`h-full min-h-0 flex flex-col overflow-hidden p-[clamp(11px,0.95vw,22px)] gap-[clamp(8px,0.7vw,14px)] ${composing ? "" : ACTIONABLE}`}>
      <span className="tile-label flex items-center gap-[0.4em]">
        <PeaceIcon className="h-[1.6em] w-[1.6em] text-primary" />
        Chat
      </span>
      {topic && (
        <a
          key={topic.url}
          href={topic.url}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          title="Open the article"
          className="actionable -mt-[clamp(2px,0.2vw,4px)] flex shrink-0 items-center gap-[0.6em] rounded-[clamp(10px,0.8vw,16px)] border border-primary/20 bg-primary/[0.06] px-[0.8em] py-[0.5em] text-[clamp(12px,0.85vw,18px)] leading-snug animate-in fade-in slide-in-from-top-1 duration-500"
        >
          <Newspaper className="h-[1.1em] w-[1.1em] shrink-0 text-primary" />
          <span className="min-w-0 flex-1">
            <span className="block text-[0.8em] font-medium uppercase tracking-wide text-primary">Topic of the moment</span>
            <span className="line-clamp-2 font-medium text-foreground">{topic.headline}</span>
            {topic.source && <span className="block text-[0.8em] text-muted-foreground">{topic.source}</span>}
          </span>
          <ArrowUpRight className="h-[1em] w-[1em] shrink-0 text-muted-foreground" />
        </a>
      )}
      {/* Anchored to the bottom: the newest message is always in view */}
      <div className="flex min-h-0 flex-1 flex-col justify-end gap-[clamp(4px,0.35vw,7px)] overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_18%)]">
        {/* Nobody has written for a while: invite people in */}
        {shown.length === 0 && (
          <p className="mb-[clamp(2px,0.2vw,4px)] text-muted-foreground text-[clamp(12px,0.9vw,19px)]">
            Quiet right now. Say hi from the Play page 👋
          </p>
        )}
        {/* A quiet chat gets a nudge: a conversation starter that changes every half minute */}
        {shown.length < 4 && (
          <p key={starterAt(now)} className="mb-[clamp(4px,0.4vw,8px)] self-start rounded-2xl border border-dashed border-primary/40 px-[0.9em] py-[0.45em] text-muted-foreground text-[clamp(12px,0.9vw,19px)] animate-in fade-in duration-700">
            💡 {starterAt(now)}
          </p>
        )}
        {shown.map((m, i) => {
          // Messages in a row from the same person share one name line, under the last one
          const lastOfRun = i === shown.length - 1 || shown[i + 1].created_by !== m.created_by;
          const mine = isMe(m.created_by);
          return (
            <div key={m.id} className={`flex shrink-0 flex-col ${mine ? "items-end" : "items-start"} animate-in fade-in slide-in-from-bottom-1 duration-500 text-[clamp(13px,1vw,21px)] ${lastOfRun ? "mb-[0.35em]" : ""}`}>
              <div className={`flex max-w-[94%] items-end gap-[0.55em] ${mine ? "flex-row-reverse" : ""}`}>
                {/* The speaker sits under their last bubble of a run; earlier ones keep the space */}
                <span className="flex w-[2.1em] shrink-0 justify-center">
                  {lastOfRun && (
                    <ChatSpeaker speaking={i === shown.length - 1}>
                      <PlayerAvatar avatar={avatars.get(m.created_by)} name={m.created_by} size="2.1em" tv still={i !== shown.length - 1} />
                    </ChatSpeaker>
                  )}
                </span>
                <ChatBubble color={colourOf(m.created_by)} side={mine ? "right" : "left"} tail={lastOfRun} className="px-[0.85em] py-[0.4em] leading-snug">
                  <MentionText text={m.body} playerNames={playerNames} avatars={avatars} />
                </ChatBubble>
              </div>
              {lastOfRun && (
                <span className={`mt-[0.3em] text-muted-foreground text-[0.72em] ${mine ? "pr-[2.65em]" : "pl-[2.65em]"}`}>
                  <span className="font-medium text-foreground/75">{mine ? "You" : m.created_by}</span> · {chatAgo(m.created_at, now)}
                </span>
              )}
            </div>
          );
        })}
        {typing.length > 0 && (
          <div className="flex shrink-0 justify-end pr-[0.3em] pt-[0.2em] text-[clamp(13px,1vw,21px)] animate-in fade-in duration-300">
            <TypingDots label={`${typing.join(" & ")} ${typing.length > 1 ? "are" : "is"} writing`} />
          </div>
        )}
      </div>
      {composing && me && (
        <form
          className="flex shrink-0 gap-2 animate-in fade-in slide-in-from-bottom-1 duration-200"
          onClick={(e) => e.stopPropagation()}
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.trim()) return;
            onSend?.(draft, me);
            stop();
            setDraft("");
          }}
        >
          <input
            autoFocus
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value.slice(0, CHAT_MAX_LEN));
              notify();
            }}
            onKeyDown={(e) => e.key === "Escape" && setComposing(false)}
            placeholder={`Message as ${me}…`}
            className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 text-[clamp(13px,0.95vw,19px)] outline-none focus:border-primary"
          />
          <button type="submit" disabled={!draft.trim()} className="shrink-0 rounded-lg bg-primary px-3 text-[clamp(13px,0.95vw,19px)] font-semibold text-primary-foreground disabled:opacity-40">
            Send
          </button>
        </form>
      )}
    </Card>
  );
}

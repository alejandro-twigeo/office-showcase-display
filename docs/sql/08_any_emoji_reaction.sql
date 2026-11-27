-- Step 8: any emoji can be a reaction, not just the six.
-- Still short and still an emoji-like character: no letters, digits, spaces or tags.
alter table public.kudos_reactions drop constraint if exists kudos_reactions_emoji_check;
alter table public.kudos_reactions add constraint kudos_reactions_emoji_check
  check (char_length(emoji) between 1 and 16 and emoji !~ '[[:alnum:][:space:]<>]');

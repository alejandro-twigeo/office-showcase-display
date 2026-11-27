import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AvatarPicker } from './AvatarPicker';
import { botFor, isBotAvatar, serializeBot } from '@/lib/botAvatar';
import type { Player } from '@/hooks/usePlayer';

const laterKey = (id: string) => `twigeo-avatar-later:${id}`;

function saidLater(id: string) {
  try {
    return localStorage.getItem(laterKey(id)) === '1';
  } catch {
    return false;
  }
}

/**
 * Players from before the avatars still have an emoji saved. The first time they open
 * /play, they get to pick a bot. "Later" keeps the bot picked from their name and
 * doesn't ask again on this device; Edit profile can change it any time.
 */
export function AvatarPrompt({ player, onSave }: {
  player: Player;
  onSave: (updates: { avatar: string }) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [open, setOpen] = useState(() => !isBotAvatar(player.avatar) && !saidLater(player.id));
  const [bot, setBot] = useState(() => botFor(player.avatar, player.name));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const later = () => {
    try { localStorage.setItem(laterKey(player.id), '1'); } catch { /* ignore */ }
    setOpen(false);
  };

  const save = async () => {
    setSaving(true);
    setError('');
    const res = await onSave({ avatar: serializeBot(bot) });
    setSaving(false);
    if (res.ok) setOpen(false);
    else setError(res.error || 'Couldn’t save your avatar. Try again');
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) later(); }}>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pick your avatar</DialogTitle>
          <DialogDescription>
            It replaces your icon on the leaderboards and the TV. You can change it later in Edit profile.
          </DialogDescription>
        </DialogHeader>
        <AvatarPicker value={bot} onChange={setBot} name={player.name} caption={player.department ?? undefined} />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="sticky bottom-0 -mx-6 -mb-6 flex gap-2 border-t bg-background px-6 pb-6 pt-3">
          <Button variant="outline" className="flex-1" onClick={later}>Later</Button>
          <Button className="flex-1" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save avatar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

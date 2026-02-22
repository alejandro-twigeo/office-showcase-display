import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AVATAR_OPTIONS, OFFICE_OPTIONS, OFFICE_FLAGS, type Player } from '@/hooks/usePlayer';
import { Loader2 } from 'lucide-react';

interface ProfileEditorProps {
  player: Player;
  onUpdate: (updates: { name?: string; office?: string; avatar?: string }) => Promise<{ ok: boolean; error?: string }>;
  onClose: () => void;
}

export function ProfileEditor({ player, onUpdate, onClose }: ProfileEditorProps) {
  const [name, setName] = useState(player.name);
  const [office, setOffice] = useState(player.office);
  const [avatar, setAvatar] = useState(player.avatar);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const hasChanges = name !== player.name || office !== player.office || avatar !== player.avatar;

  const handleSave = async () => {
    if (!hasChanges) { onClose(); return; }
    setLoading(true);
    setError('');
    const updates: any = {};
    if (name !== player.name) updates.name = name.trim();
    if (office !== player.office) updates.office = office;
    if (avatar !== player.avatar) updates.avatar = avatar;

    const result = await onUpdate(updates);
    if (result.ok) {
      onClose();
    } else {
      setError(result.error || 'Failed to update');
    }
    setLoading(false);
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            maxLength={20}
          />

          <div className="space-y-1.5">
            <p className="text-sm font-medium">Office</p>
            <div className="flex gap-2">
              {OFFICE_OPTIONS.map((o) => (
                <Button
                  key={o}
                  type="button"
                  variant={office === o ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setOffice(o)}
                  className="gap-1"
                >
                  {OFFICE_FLAGS[o]} {o}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-sm font-medium">Avatar</p>
            <div className="grid grid-cols-8 gap-1">
              {AVATAR_OPTIONS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAvatar(a)}
                  className={`text-2xl p-1 rounded-md transition-all ${
                    avatar === a
                      ? 'bg-primary/20 ring-2 ring-primary scale-110'
                      : 'hover:bg-secondary'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" onClick={handleSave} disabled={!hasChanges || loading || !name.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

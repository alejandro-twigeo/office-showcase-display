import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { User, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { getDeviceId, setDeviceId } from '@/hooks/useDeviceId';

interface NameEntryProps {
  onSubmit: (name: string) => void;
}

export function NameEntry({ onSubmit }: NameEntryProps) {
  const [name, setName] = useState('');
  const [checking, setChecking] = useState(false);
  const [conflictDeviceId, setConflictDeviceId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setChecking(true);
    try {
      const currentDeviceId = getDeviceId();

      const { data } = await supabase
        .from('guesses')
        .select('device_id')
        .eq('player_name', trimmed)
        .neq('device_id', currentDeviceId)
        .limit(1);

      if (data && data.length > 0) {
        // Name is taken by another device – ask if it's them
        setConflictDeviceId(data[0].device_id);
      } else {
        onSubmit(trimmed);
      }
    } finally {
      setChecking(false);
    }
  };

  const handleConfirmYes = () => {
    if (!conflictDeviceId) return;
    setDeviceId(conflictDeviceId);
    setConflictDeviceId(null);
    onSubmit(name.trim());
  };

  const handleConfirmNo = () => {
    setConflictDeviceId(null);
    // Stay on the form so the user can pick a different name
  };

  return (
    <>
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <User className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Welcome!</CardTitle>
            <p className="text-muted-foreground mt-2">Enter your name to start playing</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={20}
                className="text-center text-lg"
                autoFocus
                disabled={checking}
              />
              <Button type="submit" className="w-full" disabled={!name.trim() || checking}>
                {checking ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Checking…
                  </>
                ) : (
                  'Join the Game'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* "Is that you?" confirmation dialog */}
      <Dialog open={!!conflictDeviceId} onOpenChange={(open) => { if (!open) handleConfirmNo(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Is that you?</DialogTitle>
            <DialogDescription>
              We found activity for <strong>{name.trim()}</strong> on another device. Did you already play with this name?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button className="w-full" onClick={handleConfirmYes}>
              Yes, that's me — link my account
            </Button>
            <Button variant="outline" className="w-full" onClick={handleConfirmNo}>
              No, I'll change my name
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

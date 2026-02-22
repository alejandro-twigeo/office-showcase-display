import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { User, Loader2, LogIn, UserPlus } from 'lucide-react';
import { AVATAR_OPTIONS, OFFICE_OPTIONS, OFFICE_FLAGS } from '@/hooks/usePlayer';

interface PlayerAuthProps {
  onLogin: (name: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  onSignup: (name: string, password: string, office: string, avatar: string) => Promise<{ ok: boolean; error?: string }>;
}

export function PlayerAuth({ onLogin, onSignup }: PlayerAuthProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [office, setOffice] = useState<string>('Bulgaria');
  const [avatar, setAvatar] = useState('🐶');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || !password) return;

    setLoading(true);
    setError('');

    const result = mode === 'login'
      ? await onLogin(trimmed, password)
      : await onSignup(trimmed, password, office, avatar);

    if (!result.ok) setError(result.error || 'Something went wrong');
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            {mode === 'signup' ? (
              <span className="text-3xl">{avatar}</span>
            ) : (
              <User className="h-8 w-8 text-primary" />
            )}
          </div>
          <CardTitle className="text-2xl">
            {mode === 'login' ? 'Welcome back!' : 'Create your profile'}
          </CardTitle>
          <p className="text-muted-foreground mt-2">
            {mode === 'login'
              ? 'Enter your name and password'
              : 'Pick a name, avatar, and office'}
          </p>
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
              disabled={loading}
            />
            <div>
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                maxLength={30}
                className="text-center"
                disabled={loading}
              />
              {mode === 'signup' && (
                <p className="text-xs text-muted-foreground mt-1 text-center">
                  ⚠️ Use a simple password — no security is implemented
                </p>
              )}
            </div>

            {mode === 'signup' && (
              <>
                {/* Office selection */}
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-center">Office</p>
                  <div className="flex gap-2 justify-center">
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

                {/* Avatar selection */}
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-center">Avatar</p>
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
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-muted-foreground">Or type your own:</span>
                    <Input
                      type="text"
                      value={AVATAR_OPTIONS.includes(avatar) ? '' : avatar}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) setAvatar(val);
                      }}
                      placeholder="🎸"
                      maxLength={2}
                      className="w-16 text-center text-xl p-1 h-9"
                    />
                  </div>
                </div>
              </>
            )}

            {error && <p className="text-sm text-destructive text-center">{error}</p>}

            <Button type="submit" className="w-full" disabled={!name.trim() || !password || loading}>
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Please wait…</>
              ) : mode === 'login' ? (
                <><LogIn className="h-4 w-4 mr-2" />Log In</>
              ) : (
                <><UserPlus className="h-4 w-4 mr-2" />Sign Up</>
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full text-sm"
              onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}
            >
              {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

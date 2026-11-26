import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Mail, ArrowLeft, UserPlus } from 'lucide-react';
import {
  AVATAR_OPTIONS,
  OFFICE_OPTIONS,
  OFFICE_FLAGS,
  EMAIL_DOMAIN,
  isWorkEmail,
  type ClaimablePlayer,
  type EmailLoginResult,
} from '@/hooks/usePlayer';

interface PlayerAuthProps {
  onEmail: (email: string) => Promise<EmailLoginResult>;
  onClaim: (playerId: string, email: string) => Promise<{ ok: boolean; error?: string }>;
  onSignup: (email: string, name: string, office: string, avatar: string) => Promise<{ ok: boolean; error?: string }>;
}

type Step = 'email' | 'claim' | 'signup';

/**
 * Log in with your work email, no password.
 * 1. Email. Known email → straight in.
 * 2. New email → "Is this you?": pick your existing profile (likely matches first), or
 * 3. "I'm new" → name (prefilled from the email), office and avatar.
 */
export function PlayerAuth({ onEmail, onClaim, onSignup }: PlayerAuthProps) {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [claimable, setClaimable] = useState<ClaimablePlayer[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [name, setName] = useState('');
  const [office, setOffice] = useState<string>('Sweden');
  const [avatar, setAvatar] = useState('🐶');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isWorkEmail(email)) {
      setError(`Use your @${EMAIL_DOMAIN} email`);
      return;
    }
    setLoading(true);
    setError('');
    const res = await onEmail(email);
    setLoading(false);
    if (res.status === 'error') return setError(res.error);
    if (res.status === 'new') {
      setName(res.suggestedName);
      setClaimable(res.claimable);
      setShowAll(false);
      setStep(res.claimable.length ? 'claim' : 'signup');
    }
  };

  const claim = async (p: ClaimablePlayer) => {
    setLoading(true);
    setError('');
    const res = await onClaim(p.id, email);
    setLoading(false);
    if (!res.ok) setError(res.error || 'Something went wrong');
  };

  const signup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    const res = await onSignup(email, name, office, avatar);
    setLoading(false);
    if (!res.ok) setError(res.error || 'Something went wrong');
  };

  const likely = claimable.filter((p) => p.likely);
  const shown = showAll || likely.length === 0 ? claimable : likely;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            {step === 'signup' ? <span className="text-3xl">{avatar}</span> : <Mail className="h-7 w-7 text-primary" />}
          </div>
          <CardTitle className="text-2xl">
            {step === 'email' && 'Welcome!'}
            {step === 'claim' && 'Is this you?'}
            {step === 'signup' && 'Create your profile'}
          </CardTitle>
          <p className="text-muted-foreground mt-2">
            {step === 'email' && 'Log in with your work email. No password needed.'}
            {step === 'claim' && 'Pick your profile to keep your scores and streaks. You only do this once.'}
            {step === 'signup' && 'Pick a name, avatar and office'}
          </p>
        </CardHeader>
        <CardContent>
          {step === 'email' && (
            <form onSubmit={submitEmail} className="space-y-4">
              <Input
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                placeholder={`name@${EMAIL_DOMAIN}`}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                className="text-center text-lg h-12"
                autoFocus
                disabled={loading}
              />
              {error && <p className="text-sm text-destructive text-center">{error}</p>}
              <Button type="submit" className="w-full h-11" disabled={!email.trim() || loading}>
                {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Checking…</> : 'Continue'}
              </Button>
            </form>
          )}

          {step === 'claim' && (
            <div className="space-y-3">
              <div className="max-h-[45vh] space-y-2 overflow-y-auto">
                {shown.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={loading}
                    onClick={() => claim(p)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors hover:bg-secondary active:scale-[0.99] ${
                      p.likely ? 'border-primary/50 bg-primary/5' : ''
                    }`}
                  >
                    <span className="text-2xl leading-none">{p.avatar}</span>
                    <span className="flex-1 font-medium">{p.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {OFFICE_FLAGS[p.office]} {p.office}
                    </span>
                  </button>
                ))}
              </div>
              {!showAll && likely.length > 0 && claimable.length > likely.length && (
                <button type="button" className="w-full text-sm text-muted-foreground underline-offset-2 hover:underline" onClick={() => setShowAll(true)}>
                  Not here? Show everyone ({claimable.length})
                </button>
              )}
              {error && <p className="text-sm text-destructive text-center">{error}</p>}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button type="button" variant="ghost" onClick={() => { setStep('email'); setError(''); }} className="gap-1">
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                <Button type="button" variant="outline" onClick={() => { setStep('signup'); setError(''); }} className="gap-1">
                  <UserPlus className="h-4 w-4" /> I'm new
                </Button>
              </div>
            </div>
          )}

          {step === 'signup' && (
            <form onSubmit={signup} className="space-y-4">
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

              <div className="space-y-1.5">
                <p className="text-sm font-medium text-center">Office</p>
                <div className="flex gap-2 justify-center">
                  {OFFICE_OPTIONS.map((o) => (
                    <Button key={o} type="button" variant={office === o ? 'default' : 'outline'} size="sm" onClick={() => setOffice(o)} className="gap-1">
                      {OFFICE_FLAGS[o]} {o}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-sm font-medium text-center">Avatar</p>
                <div className="grid grid-cols-8 gap-1">
                  {AVATAR_OPTIONS.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setAvatar(a)}
                      className={`text-2xl p-1 rounded-md transition-all ${avatar === a ? 'bg-primary/20 ring-2 ring-primary scale-110' : 'hover:bg-secondary'}`}
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

              {error && <p className="text-sm text-destructive text-center">{error}</p>}

              <div className="grid grid-cols-[auto_1fr] gap-2">
                <Button type="button" variant="ghost" onClick={() => { setStep(claimable.length ? 'claim' : 'email'); setError(''); }}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Button type="submit" className="w-full" disabled={!name.trim() || loading}>
                  {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Please wait…</> : 'Start playing'}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** For people logged in from before email login: link the work email once, then carry on. */
export function LinkEmailPrompt({ name, onLink, onSkip }: { name: string; onLink: (email: string) => Promise<{ ok: boolean; error?: string }>; onSkip: () => void }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isWorkEmail(email)) return setError(`Use your @${EMAIL_DOMAIN} email`);
    setLoading(true);
    setError('');
    const res = await onLink(email);
    setLoading(false);
    if (!res.ok) setError(res.error || 'Something went wrong');
  };
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Mail className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-2xl">Hi {name}! One quick thing</CardTitle>
          <p className="text-muted-foreground mt-2">We've dropped passwords. Add your work email so you can log in on any device, and nobody else can use your profile.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <Input
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              placeholder={`name@${EMAIL_DOMAIN}`}
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              className="text-center text-lg h-12"
              autoFocus
              disabled={loading}
            />
            {error && <p className="text-sm text-destructive text-center">{error}</p>}
            <Button type="submit" className="w-full h-11" disabled={!email.trim() || loading}>
              {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving…</> : 'Save and continue'}
            </Button>
            <button type="button" onClick={onSkip} className="w-full text-sm text-muted-foreground hover:underline underline-offset-2">
              Later
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

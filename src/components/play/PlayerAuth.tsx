import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Mail, ArrowLeft, UserPlus, KeyRound } from 'lucide-react';
import {
  AVATAR_OPTIONS,
  OFFICE_OPTIONS,
  OFFICE_FLAGS,
  EMAIL_DOMAIN,
  isWorkEmail,
  type ClaimablePlayer,
  type ProfileSetup,
} from '@/hooks/usePlayer';

type Result = Promise<{ ok: boolean; error?: string }>;

interface PlayerAuthProps {
  /** Set once the code is verified but there's no profile yet */
  setup: ProfileSetup | null;
  onSendCode: (email: string) => Result;
  onVerify: (email: string, code: string) => Result;
  onClaim: (playerId: string) => Result;
  onCreate: (name: string, office: string, avatar: string) => Result;
}

/** Only the part before the @: "@twigeo.com" is filled in. Pasting a full address also works. */
const localPart = (v: string) => v.split('@')[0].replace(/\s/g, '').toLowerCase();
const fullEmail = (local: string) => `${local}@${EMAIL_DOMAIN}`;
const RESEND_AFTER_S = 30;

function WorkEmailInput({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div className="flex h-12 items-center rounded-md border border-input bg-background text-lg focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ring-offset-background">
      <input
        type="text"
        inputMode="email"
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        placeholder="your.name"
        value={value}
        onChange={(e) => onChange(localPart(e.target.value))}
        className="min-w-0 flex-1 bg-transparent pl-4 pr-0 text-right outline-none placeholder:text-muted-foreground"
        autoFocus
        disabled={disabled}
        aria-label="Work email, the part before @twigeo.com"
      />
      <span className="shrink-0 pr-4 text-muted-foreground">@{EMAIL_DOMAIN}</span>
    </div>
  );
}

/**
 * Log in with a code sent to your work email.
 * 1. Email → we send a 6-digit code.  2. Code → you're in.
 * 3. First time only: "Is this you?" to keep your old profile, or "I'm new".
 */
export function PlayerAuth({ setup, onSendCode, onVerify, onClaim, onCreate }: PlayerAuthProps) {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const [creating, setCreating] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [name, setName] = useState('');
  const [office, setOffice] = useState<string>('Sweden');
  const [avatar, setAvatar] = useState('🐶');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const codeRef = useRef<HTMLInputElement>(null);

  // First login: prefill the new-profile form from what the roster says
  useEffect(() => {
    if (!setup) return;
    setName(setup.suggestedName);
    if (setup.office) setOffice(setup.office);
    setCreating(setup.claimable.length === 0);
    setError('');
  }, [setup]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!isWorkEmail(fullEmail(email))) return setError('Type the part before @twigeo.com');
    setLoading(true);
    setError('');
    const res = await onSendCode(fullEmail(email));
    setLoading(false);
    if (!res.ok) return setError(res.error || 'Something went wrong');
    setStep('code');
    setCode('');
    setResendIn(RESEND_AFTER_S);
    setTimeout(() => codeRef.current?.focus(), 50);
  };

  const verify = async (value = code) => {
    if (value.length < 6) return;
    setLoading(true);
    setError('');
    const res = await onVerify(fullEmail(email), value);
    setLoading(false);
    if (!res.ok) setError(res.error || 'Something went wrong');
  };

  const run = async (fn: () => Result) => {
    setLoading(true);
    setError('');
    const res = await fn();
    setLoading(false);
    if (!res.ok) setError(res.error || 'Something went wrong');
  };

  // Logged in, first time: claim or create
  if (setup) {
    const likely = setup.claimable.filter((p) => p.likely);
    const shown = showAll || likely.length === 0 ? setup.claimable : likely;
    return (
      <Shell
        icon={creating ? <span className="text-3xl">{avatar}</span> : <Mail className="h-7 w-7 text-primary" />}
        title={creating ? 'Create your profile' : 'Is this you?'}
        subtitle={
          creating
            ? `${setup.department ? `${setup.department} · ` : ''}Pick a name, avatar and office`
            : 'Pick your profile to keep your scores and streaks. You only do this once.'
        }
      >
        {!creating ? (
          <div className="space-y-3">
            <div className="max-h-[45vh] space-y-2 overflow-y-auto">
              {shown.map((p: ClaimablePlayer) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={loading}
                  onClick={() => run(() => onClaim(p.id))}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors hover:bg-secondary active:scale-[0.99] ${p.likely ? 'border-primary/50 bg-primary/5' : ''}`}
                >
                  <span className="text-2xl leading-none">{p.avatar}</span>
                  <span className="flex-1 font-medium">{p.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {OFFICE_FLAGS[p.office]} {p.office}
                  </span>
                </button>
              ))}
            </div>
            {!showAll && likely.length > 0 && setup.claimable.length > likely.length && (
              <button type="button" className="w-full text-sm text-muted-foreground underline-offset-2 hover:underline" onClick={() => setShowAll(true)}>
                Not here? Show everyone ({setup.claimable.length})
              </button>
            )}
            {error && <p className="text-sm text-destructive text-center">{error}</p>}
            <Button type="button" variant="outline" onClick={() => setCreating(true)} className="w-full gap-1">
              <UserPlus className="h-4 w-4" /> I'm new
            </Button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) run(() => onCreate(name, office, avatar));
            }}
            className="space-y-4"
          >
            <Input type="text" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} maxLength={20} className="text-center text-lg" autoFocus disabled={loading} />
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
                  onChange={(e) => e.target.value && setAvatar(e.target.value)}
                  placeholder="🎸"
                  maxLength={2}
                  className="w-16 text-center text-xl p-1 h-9"
                />
              </div>
            </div>
            {error && <p className="text-sm text-destructive text-center">{error}</p>}
            <div className={setup.claimable.length ? 'grid grid-cols-[auto_1fr] gap-2' : ''}>
              {setup.claimable.length > 0 && (
                <Button type="button" variant="ghost" onClick={() => setCreating(false)} aria-label="Back">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <Button type="submit" className="w-full" disabled={!name.trim() || loading}>
                {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Please wait…</> : 'Start playing'}
              </Button>
            </div>
          </form>
        )}
      </Shell>
    );
  }

  if (step === 'code') {
    return (
      <Shell icon={<KeyRound className="h-7 w-7 text-primary" />} title="Check your email" subtitle={`We sent a 6-digit code to ${fullEmail(email)}`}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            verify();
          }}
          className="space-y-4"
        >
          <Input
            ref={codeRef}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            value={code}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 6);
              setCode(v);
              setError('');
              if (v.length === 6) verify(v);
            }}
            className="h-14 text-center text-3xl tracking-[0.4em] tabular-nums"
            disabled={loading}
          />
          {error && <p className="text-sm text-destructive text-center">{error}</p>}
          <Button type="submit" className="w-full h-11" disabled={code.length < 6 || loading}>
            {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Checking…</> : 'Log in'}
          </Button>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <button type="button" className="flex items-center gap-1 hover:underline underline-offset-2" onClick={() => { setStep('email'); setError(''); }}>
              <ArrowLeft className="h-3.5 w-3.5" /> Other email
            </button>
            <button type="button" className="hover:underline underline-offset-2 disabled:no-underline disabled:opacity-60" disabled={resendIn > 0 || loading} onClick={() => send()}>
              {resendIn > 0 ? `Send again in ${resendIn}s` : 'Send a new code'}
            </button>
          </div>
        </form>
      </Shell>
    );
  }

  return (
    <Shell icon={<Mail className="h-7 w-7 text-primary" />} title="Welcome!" subtitle="Log in with your work email. We'll send you a code.">
      <form onSubmit={send} className="space-y-4">
        <WorkEmailInput value={email} onChange={(v) => { setEmail(v); setError(''); }} disabled={loading} />
        {error && <p className="text-sm text-destructive text-center">{error}</p>}
        <Button type="submit" className="w-full h-11" disabled={!email.trim() || loading}>
          {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Sending…</> : 'Send me a code'}
        </Button>
      </form>
    </Shell>
  );
}

function Shell({ icon, title, subtitle, children }: { icon: React.ReactNode; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">{icon}</div>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <p className="text-muted-foreground mt-2">{subtitle}</p>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, RefreshCw, Globe } from 'lucide-react';
import { useActiveLocation } from '@/hooks/useActiveLocation';
import { Leaderboard } from './Leaderboard';
import { useGuesses } from '@/hooks/useGuesses';

const TIMEZONE = 'Europe/Stockholm';
const START_HOUR = 9;
const END_HOUR = 17;
const STEP_MINUTES = 30;

const TOTAL_STEPS = ((END_HOUR - START_HOUR) * 60) / STEP_MINUTES; // 16

const LOCAL_META_KEY = 'wikiguess_meta';

interface StoredRoundMeta {
  roundId: string;
  sourceUrl: string;
  answerTitle: string;
  dayKey: string;
}

type WikiRound = {
  lat: number;
  lng: number;
  thumb: string;
  sourceUrl: string;
  answerTitle: string;
};

// A curated list of landmarks so the images are consistently guessable.
const CANDIDATE_TITLES = [
  'Eiffel Tower',
  'Colosseum',
  'Sydney Opera House',
  'Statue of Liberty',
  'Big Ben',
  'Golden Gate Bridge',
  'Christ the Redeemer (statue)',
  'Sagrada Família',
  'Burj Khalifa',
  'Mount Fuji',
  'Mount Everest',
  'Grand Canyon',
  'Petra',
  'Pyramids of Giza',
  'Taj Mahal',
  'Machu Picchu',
  'Acropolis of Athens',
  'Brandenburg Gate',
  'Stonehenge',
  'CN Tower',
  'Neuschwanstein Castle',
  'Angkor Wat',
  'Niagara Falls',
  'Kremlin',
  'Forbidden City',
  'Palace of Versailles',
  'Leaning Tower of Pisa',
  'Times Square',
  'Red Square',
  'Santorini',
  'Banff National Park',
  'Borobudur',
  'Meteora',
  'Maldives',
  'Venice',
] as const;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function dayKeyStockholm(date: Date) {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;

  if (!year || !month || !day) return '0000-00-00';
  return `${year}-${month}-${day}`;
}

function stockholmMinutesSinceMidnight(date: Date) {
  const formatted = new Intl.DateTimeFormat('sv-SE', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);

  const [hh, mm] = formatted.split(':').map((p) => Number(p));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return 0;
  return hh * 60 + mm;
}

function getStepIndex(date: Date) {
  const minutes = stockholmMinutesSinceMidnight(date);
  const startMinutes = START_HOUR * 60;
  const endMinutes = END_HOUR * 60;

  const t = clamp(minutes, startMinutes, endMinutes);
  const delta = t - startMinutes;
  return clamp(Math.floor(delta / STEP_MINUTES), 0, TOTAL_STEPS);
}

function scaleForStep(step: number) {
  // 09:00 extremely zoomed in, 17:00 fully revealed
  const startScale = 10;
  const endScale = 1;
  const p = step / TOTAL_STEPS;
  return startScale + (endScale - startScale) * p;
}

function getStoredMeta(): StoredRoundMeta | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LOCAL_META_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredRoundMeta;
  } catch {
    return null;
  }
}

function setStoredMeta(meta: StoredRoundMeta) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_META_KEY, JSON.stringify(meta));
  } catch {
    // ignore
  }
}

function pickRandom<T>(arr: readonly T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function fetchWikiRound(title: string): Promise<WikiRound> {
  const url =
    'https://en.wikipedia.org/w/api.php' +
    '?action=query' +
    '&format=json' +
    '&origin=*' +
    '&prop=coordinates|pageimages|info' +
    '&inprop=url' +
    '&piprop=thumbnail' +
    '&pithumbsize=1280' +
    '&titles=' +
    encodeURIComponent(title);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Wikipedia fetch failed: ${res.status}`);

  const data = await res.json();

  const pages = data?.query?.pages;
  const page = pages ? pages[Object.keys(pages)[0]] : null;

  const coord = page?.coordinates?.[0];
  const thumb = page?.thumbnail?.source as string | undefined;
  const pageUrl = page?.fullurl as string | undefined;
  const answerTitle = page?.title as string | undefined;

  if (!coord?.lat || !coord?.lon || !thumb || !pageUrl || !answerTitle) {
    throw new Error(`Missing coord/thumb for "${title}"`);
  }

  return {
    lat: coord.lat,
    lng: coord.lon,
    thumb,
    sourceUrl: pageUrl,
    answerTitle,
  };
}

async function fetchRandomWikiRoundWithRetry(maxTries = 6): Promise<WikiRound> {
  let lastErr: unknown = null;

  for (let i = 0; i < maxTries; i++) {
    const title = pickRandom(CANDIDATE_TITLES);
    try {
      return await fetchWikiRound(title);
    } catch (e) {
      lastErr = e;
    }
  }

  throw lastErr ?? new Error('Failed to fetch a round');
}

export function StreetViewDisplay() {
  const { activeLocation, createNewLocation } = useActiveLocation();
  const { guesses } = useGuesses(activeLocation?.id);

  //const [now, setNow] = useState(() => new Date());

  //useEffect(() => {
  //  const t = setInterval(() => setNow(new Date()), 10_000);
  //  return () => clearInterval(t);
  //}, []);

  const step = useMemo(() => getStepIndex(now), [now]);
  const scale = useMemo(() => scaleForStep(step), [step]);

  const todayKey = useMemo(() => dayKeyStockholm(now), [now]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (createNewLocation.isPending) return;

    const minutes = stockholmMinutesSinceMidnight(now);
    //const afterStart = minutes >= START_HOUR * 60;
    //if (!afterStart) return;

   // const createdDayKey = activeLocation?.created_at
   //   ? dayKeyStockholm(new Date(activeLocation.created_at))
   //   : null;

    // If the current active location is from today already, do not reset.
   // if (activeLocation && createdDayKey === todayKey) return;

    (async () => {
      const round = await fetchRandomWikiRoundWithRetry();

      createNewLocation.mutate(
        { lat: round.lat, lng: round.lng, pano_id: round.thumb },
        {
          onSuccess: (data: any) => {
            setStoredMeta({
              roundId: data.id,
              sourceUrl: round.sourceUrl,
              answerTitle: round.answerTitle,
              dayKey: todayKey,
            });
          },
        }
      );
    })();
  }, [activeLocation?.created_at, createNewLocation, createNewLocation.isPending, now, todayKey]);

  const storedMeta = useMemo(() => getStoredMeta(), [now, activeLocation?.id]);

  const handleNewLocation = async () => {
    if (createNewLocation.isPending) return;

    const round = await fetchRandomWikiRoundWithRetry();

    createNewLocation.mutate(
      { lat: round.lat, lng: round.lng, pano_id: round.thumb },
      {
        onSuccess: (data: any) => {
          setStoredMeta({
            roundId: data.id,
            sourceUrl: round.sourceUrl,
            answerTitle: round.answerTitle,
            dayKey: dayKeyStockholm(new Date()),
          });
        },
      }
    );
  };

  const showImage = activeLocation?.pano_id ?? null;
  const metaForActive = storedMeta && activeLocation?.id === storedMeta.roundId ? storedMeta : null;

  return (
    <div className="grid grid-cols-3 gap-4 h-full">
      <div className="col-span-2">
        <Card className="h-full flex flex-col">
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Globe className="h-5 w-5 text-primary" />
              Zoom-out challenge
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNewLocation}
              disabled={createNewLocation.isPending}
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${createNewLocation.isPending ? 'animate-spin' : ''}`}
              />
              New image
            </Button>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col gap-3">
            {activeLocation ? (
              <>
                {showImage ? (
                  <>
                    <div className="relative w-full flex-1 min-h-[380px] overflow-hidden rounded-lg border bg-black">
                      <img
                        src={showImage}
                        alt="Mystery location"
                        className="absolute inset-0 w-full h-full object-cover"
                        style={{
                          transform: `scale(${scale})`,
                          transformOrigin: 'center center',
                          transition: 'transform 700ms ease',
                        }}
                      />
                    </div>

                    <div className="text-xs text-muted-foreground flex justify-between items-center">
                      <span>
                        Step {step}/{TOTAL_STEPS}
                      </span>
                      {metaForActive ? (
                        <a
                          href={metaForActive.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="truncate max-w-[70%] underline"
                          title={metaForActive.answerTitle}
                        >
                          Wikimedia / Wikipedia
                        </a>
                      ) : (
                        <span className="truncate max-w-[70%]">Wikimedia / Wikipedia</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-mono">ID: {activeLocation.id.slice(0, 8)}...</span>
                    </div>

                    <p className="text-muted-foreground text-sm">
                      Open the play page on your phone to guess.
                    </p>
                  </>
                ) : (
                  <div className="w-full flex-1 min-h-[360px] bg-secondary/20 rounded-lg flex flex-col items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-accent/10 to-info/10" />
                    <div className="relative z-10 text-center p-6">
                      <MapPin className="h-16 w-16 text-primary mx-auto mb-4 animate-pulse-soft" />
                      <p className="text-xl font-semibold text-foreground mb-2">Mystery Location</p>
                      <p className="text-muted-foreground text-sm">
                        Open the play page on your phone to guess!
                      </p>
                      <div className="mt-4 px-4 py-2 bg-card rounded-full inline-block">
                        <span className="text-xs text-muted-foreground font-mono">
                          ID: {activeLocation.id.slice(0, 8)}...
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center p-8">
                <Globe className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">No active location</p>
                <Button onClick={handleNewLocation} disabled={createNewLocation.isPending}>
                  <RefreshCw
                    className={`h-4 w-4 mr-2 ${createNewLocation.isPending ? 'animate-spin' : ''}`}
                  />
                  Start
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <div className="col-span-1">
        <Leaderboard guesses={guesses} />
      </div>
    </div>
  );
}

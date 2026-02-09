import { useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, Globe } from 'lucide-react';
import { useActiveLocation } from '@/hooks/useActiveLocation';
import { Leaderboard } from './Leaderboard';
import { useGuesses } from '@/hooks/useGuesses';

const LOCAL_META_KEY = 'wikiguess_meta';

interface StoredRoundMeta {
  roundId: string;
  sourceUrl: string;
  answerTitle: string;
}

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
  'Taj Mahal',
  'Leaning Tower of Pisa',
  'Tower Bridge',
  'Louvre',
  'Machu Picchu',
];

function pickRandom<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getStoredMeta(roundId: string): StoredRoundMeta | null {
  try {
    const raw = localStorage.getItem(LOCAL_META_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as StoredRoundMeta | null;
    if (!parsed || parsed.roundId !== roundId) return null;

    return parsed;
  } catch {
    return null;
  }
}

async function fetchWikiRound(title: string) {
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
  if (!res.ok) {
    throw new Error(`Wikipedia fetch failed: ${res.status}`);
  }

  const data = await res.json();
  const pages = data?.query?.pages;
  const page = pages ? pages[Object.keys(pages)[0]] : null;

  const coord = page?.coordinates?.[0];
  const thumb = page?.thumbnail?.source;
  const pageUrl = page?.fullurl;

  if (!coord || !thumb || !pageUrl) {
    throw new Error(`Missing coord/thumb for "${title}"`);
  }

  return {
    lat: coord.lat as number,
    lng: coord.lon as number,
    imageUrl: thumb as string,
    sourceUrl: pageUrl as string,
    answerTitle: page.title as string,
  };
}

async function fetchRandomWikiRoundWithRetry(maxTries = 12) {
  let lastErr: unknown = null;

  for (let i = 0; i < maxTries; i++) {
    try {
      const title = pickRandom(CANDIDATE_TITLES);
      return await fetchWikiRound(title);
    } catch (e) {
      lastErr = e;
    }
  }

  try {
    return await fetchWikiRound('Eiffel Tower');
  } catch {
    throw lastErr ?? new Error('Failed to fetch a wiki round');
  }
}

export function StreetViewDisplay() {
  const { activeLocation, createNewLocation } = useActiveLocation();
  const { guesses } = useGuesses(activeLocation?.id);

  const creatingRef = useRef(false);

  const meta = useMemo(() => {
    const roundId = activeLocation?.id;
    if (!roundId) return null;
    return getStoredMeta(roundId);
  }, [activeLocation?.id]);

async function createRound() {
    if (creatingRef.current || createNewLocation.isPending) return;
    creatingRef.current = true;

    try {
      const round = await fetchRandomWikiRoundWithRetry();

      createNewLocation.mutate(
        {
          lat: round.lat,
          lng: round.lng,
          pano_id: round.imageUrl,
        },
        {
          onSuccess: (data: { id: string }) => {
            try {
              localStorage.setItem(
                LOCAL_META_KEY,
                JSON.stringify({
                  roundId: data.id,
                  sourceUrl: round.sourceUrl,
                  answerTitle: round.answerTitle,
                }),
              );
            } catch {
              // ignore
            }
            creatingRef.current = false;
          },
          onError: () => {
            creatingRef.current = false;
          },
        },
      );
    } catch {
      creatingRef.current = false;
      // If we cannot fetch, avoid creating an empty round.
    }
  }

useEffect(() => {
    const hasImage = Boolean(activeLocation?.pano_id);
    if (!activeLocation || !hasImage) {
      void createRound();
    }
  }, [activeLocation?.id, activeLocation?.pano_id]);

  return (
    <div className="grid grid-cols-3 gap-4 h-full">
      <div className="col-span-2">
        <Card className="h-full flex flex-col">
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Globe className="h-5 w-5 text-primary" />
              Mystery location
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void createRound();
              }}
              disabled={createNewLocation.isPending}
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${createNewLocation.isPending ? 'animate-spin' : ''}`}
              />
              New round
            </Button>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col gap-3">
            {activeLocation?.pano_id ? (
              <>
                <div className="relative w-full flex-1 min-h-[360px] overflow-hidden rounded-lg border bg-black">
                  <img
                    src={activeLocation.pano_id}
                    alt="mystery"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </div>

                <div className="text-xs text-muted-foreground flex justify-between items-center gap-3">
                  <span className="truncate">ID: {activeLocation.id.slice(0, 8)}...</span>

                  {meta?.sourceUrl ? (
                    <a
                      href={meta.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="underline truncate"
                    >
                      Wiki source
                    </a>
                  ) : (
                    <span className="truncate">Wiki source</span>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center p-8">
                <Globe className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">Creating a round...</p>
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

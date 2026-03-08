import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDeviceId } from '@/hooks/useDeviceId';
import { useMinigameTodayScore, useSubmitMinigameScore } from '@/hooks/useMinigameScore';
import { useMinigameSettings } from '@/hooks/useMinigameSettings';
import { fetchMapillaryRound, type MapillaryImage } from '@/lib/mapillary';
import { CheckCircle, MapPin, Loader2 } from 'lucide-react';
import L from 'leaflet';

const CITIES: { name: string; lat: number; lng: number }[] = [
  { name: 'New York', lat: 40.7128, lng: -74.006 },
  { name: 'Varna', lat: 43.2141, lng: 27.9147 },
  { name: 'Stockholm', lat: 59.3293, lng: 18.0686 },
];

const GAME_ID = 'city_guess';

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface CityGuessGameProps {
  playerName: string;
  roundId?: string;
}

export function CityGuessGame({ playerName, roundId }: CityGuessGameProps) {
  const deviceId = useDeviceId();
  const settings = useMinigameSettings();
  const { data: todayScore } = useMinigameTodayScore(GAME_ID, playerName, roundId);
  const submitScore = useSubmitMinigameScore();

  const [selectedCity, setSelectedCity] = useState<typeof CITIES[0] | null>(null);
  const [image, setImage] = useState<MapillaryImage | null>(null);
  const [loading, setLoading] = useState(false);
  const [guessPos, setGuessPos] = useState<{ lat: number; lng: number } | null>(null);
  const [guesses, setGuesses] = useState<{ distance: number; score: number }[]>([]);
  const [bestScore, setBestScore] = useState(0);

  const mapRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const handleSelectCity = async (city: typeof CITIES[0]) => {
    setSelectedCity(city);
    setLoading(true);
    try {
      const img = await fetchMapillaryRound(1); // Easy difficulty within city
      setImage(img);
    } catch (e) {
      console.error('Failed to load city image', e);
    } finally {
      setLoading(false);
    }
  };

  // Init leaflet map
  useEffect(() => {
    if (!mapRef.current || leafletRef.current || !selectedCity) return;
    const map = L.map(mapRef.current).setView([selectedCity.lat, selectedCity.lng], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);
    map.on('click', (e: L.LeafletMouseEvent) => {
      setGuessPos({ lat: e.latlng.lat, lng: e.latlng.lng });
    });
    leafletRef.current = map;
    return () => { map.remove(); leafletRef.current = null; };
  }, [selectedCity]);

  // Update marker
  useEffect(() => {
    if (!leafletRef.current) return;
    if (guessPos) {
      if (markerRef.current) markerRef.current.setLatLng([guessPos.lat, guessPos.lng]);
      else markerRef.current = L.marker([guessPos.lat, guessPos.lng]).addTo(leafletRef.current);
    }
  }, [guessPos]);

  const handleSubmitGuess = useCallback(async () => {
    if (!guessPos || !image || !deviceId) return;
    const dist = calculateDistance(guessPos.lat, guessPos.lng, image.lat, image.lng);
    const attemptIdx = Math.min(guesses.length, settings.city_guess_attempt_multipliers.length - 1);
    const mult = settings.city_guess_attempt_multipliers[attemptIdx] ?? 0.5;
    const points = Math.round((100 / (1 + dist / settings.city_guess_distance_param)) * mult);

    const newGuesses = [...guesses, { distance: dist, score: points }];
    setGuesses(newGuesses);
    setGuessPos(null);

    const newBest = Math.max(bestScore, points);
    setBestScore(newBest);

    // Submit best score
    await submitScore.mutateAsync({
      game_id: GAME_ID,
      player_name: playerName,
      device_id: deviceId,
      score: newBest,
      round_id: roundId,
      meta: { city: selectedCity?.name, attempts: newGuesses.length, best_distance: Math.min(dist, ...(guesses.map(g => g.distance))) },
    });
  }, [guessPos, image, deviceId, guesses, settings, bestScore, playerName, selectedCity, submitScore]);

  if (todayScore) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">🏙️ City Guess</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-6 space-y-2">
          <CheckCircle className="h-10 w-10 text-green-500 mx-auto" />
          <p className="font-medium">You scored {todayScore.score} pts today!</p>
          <p className="text-xs text-muted-foreground">City: {(todayScore.meta as any)?.city ?? 'Unknown'}</p>
        </CardContent>
      </Card>
    );
  }

  if (!selectedCity) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">🏙️ City Guess</CardTitle>
          <p className="text-xs text-muted-foreground">Pick a city to explore</p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            {CITIES.map(city => (
              <Button key={city.name} variant="outline" className="justify-start gap-2" onClick={() => handleSelectCity(city)}>
                <MapPin className="h-4 w-4" /> {city.name}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground mt-2">Loading street view for {selectedCity.name}...</p>
        </CardContent>
      </Card>
    );
  }

  const maxAttempts = settings.city_guess_max_attempts;
  const attemptsLeft = maxAttempts - guesses.length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">🏙️ City Guess — {selectedCity.name}</CardTitle>
        <p className="text-xs text-muted-foreground">{attemptsLeft} guess{attemptsLeft !== 1 ? 'es' : ''} left</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {image && (
          <div className="h-56 sm:h-64 rounded-lg overflow-hidden border bg-black">
            <img src={image.thumb_url} alt="mystery location" className="w-full h-full object-cover" />
          </div>
        )}

        {attemptsLeft > 0 && (
          <>
            <div ref={mapRef} className="h-48 rounded-lg border" />
            <Button onClick={handleSubmitGuess} disabled={!guessPos || submitScore.isPending} className="w-full" size="sm">
              Submit Guess ({attemptsLeft} left)
            </Button>
          </>
        )}

        {guesses.length > 0 && (
          <div className="space-y-1 border-t pt-2">
            <p className="text-xs text-muted-foreground font-medium">Your guesses:</p>
            {guesses.map((g, i) => (
              <div key={i} className="text-xs bg-secondary/50 px-2 py-1.5 rounded flex justify-between">
                <span>#{i + 1} — {g.distance < 1 ? `${Math.round(g.distance * 1000)} m` : `${Math.round(g.distance)} km`}</span>
                <span className="font-mono font-semibold text-accent">{g.score} pts</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

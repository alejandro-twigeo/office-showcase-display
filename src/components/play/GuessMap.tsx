import { useState, useCallback, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActiveLocation } from "@/hooks/useActiveLocation";
import { useUserGuesses } from "@/hooks/useGuesses";
import { useDeviceId } from "@/hooks/useDeviceId";
import { RefreshCw, MapPin, Target, Check, AlertCircle, ZoomOut, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DIFFICULTY_LOCATIONS, DIFFICULTY_LABELS, type Difficulty } from "@/lib/difficulty";
import { Badge } from "@/components/ui/badge";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface GuessMapProps {
  playerName: string;
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Pure Leaflet map (no react-leaflet) to avoid Context.Consumer crash in React 18. */
function LeafletMap({
  onMapClick,
  markerPosition,
}: {
  onMapClick: (lat: number, lng: number) => void;
  markerPosition: { lat: number; lng: number } | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Initialise map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView([20, 0], 2);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);

    map.on("click", (e: L.LeafletMouseEvent) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    });

    mapRef.current = map;

    // Fix tiles when container is initially 0×0 (inside tabs)
    setTimeout(() => map.invalidateSize(), 0);

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // onMapClick is stable (useCallback) so this is fine
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync marker
  useEffect(() => {
    if (!mapRef.current) return;

    if (markerPosition) {
      if (markerRef.current) {
        markerRef.current.setLatLng([markerPosition.lat, markerPosition.lng]);
      } else {
        markerRef.current = L.marker([markerPosition.lat, markerPosition.lng]).addTo(mapRef.current);
      }
    } else if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
  }, [markerPosition]);

  return <div ref={containerRef} className="h-full w-full" />;
}

// Same zoom config as dashboard
const ZOOM_LEVELS = [6, 4.5, 3, 2, 1.5, 1];
const ZOOM_INTERVAL_MS = 30 * 60 * 1000;
const GUESSES_PER_ZOOM = 3;

function getZoomIndex(createdAt: string | null | undefined): number {
  if (!createdAt) return 0;
  const elapsed = Date.now() - new Date(createdAt).getTime();
  return Math.min(Math.floor(elapsed / ZOOM_INTERVAL_MS), ZOOM_LEVELS.length - 1);
}

export function GuessMap({ playerName }: GuessMapProps) {
  const deviceId = useDeviceId();
  const { activeLocation, createNewLocation } = useActiveLocation();

  const creatingRef = useRef(false);
  const [isCreatingRound, setIsCreatingRound] = useState(false);
  const [showZoomPassword, setShowZoomPassword] = useState(false);
  const [zoomPassword, setZoomPassword] = useState('');
  const [zoomError, setZoomError] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>(1);

  // Compute current zoom index & max guesses allowed so far
  const zoomIndex = getZoomIndex(activeLocation?.created_at);
  const maxTotalGuesses = (zoomIndex + 1) * GUESSES_PER_ZOOM;

  const createRound = useCallback(async (difficulty: Difficulty) => {
    if (creatingRef.current || createNewLocation.isPending) return;
    creatingRef.current = true;
    setIsCreatingRound(true);
    try {
      const titles = DIFFICULTY_LOCATIONS[difficulty];
      const title = titles[Math.floor(Math.random() * titles.length)];
      const res = await fetch(
        "https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=coordinates|pageimages|info&inprop=url&piprop=thumbnail&pithumbsize=1280&titles=" +
          encodeURIComponent(title)
      );
      const data = await res.json();
      const pages = data?.query?.pages;
      const page = pages ? pages[Object.keys(pages)[0]] : null;
      const coord = page?.coordinates?.[0];
      const thumb = page?.thumbnail?.source;
      if (!coord || !thumb) throw new Error("No data");
      createNewLocation.mutate(
        { lat: coord.lat, lng: coord.lon, pano_id: thumb, difficulty },
        {
          onSuccess: () => { creatingRef.current = false; setIsCreatingRound(false); },
          onError: () => { creatingRef.current = false; setIsCreatingRound(false); },
        }
      );
    } catch {
      creatingRef.current = false;
      setIsCreatingRound(false);
    }
  }, [createNewLocation]);

  const handleManualZoom = async () => {
    if (zoomPassword !== '1234') {
      setZoomError('Wrong password');
      return;
    }
    if (!activeLocation?.created_at) return;

    // Shift created_at back by 30 min to simulate one zoom step
    const current = new Date(activeLocation.created_at);
    current.setMinutes(current.getMinutes() - 30);

    await supabase
      .from('locations')
      .update({ created_at: current.toISOString() })
      .eq('id', activeLocation.id);

    setShowZoomPassword(false);
    setZoomPassword('');
    setZoomError('');
  };

  const { userGuesses, submitGuess, remainingGuesses } = useUserGuesses(
    activeLocation?.id,
    deviceId,
    maxTotalGuesses
  );

  const [selectedPosition, setSelectedPosition] = useState<{ lat: number; lng: number } | null>(null);

  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      if (remainingGuesses > 0) setSelectedPosition({ lat, lng });
    },
    [remainingGuesses]
  );

  const handleSubmitGuess = () => {
    if (!selectedPosition || !activeLocation || !deviceId) return;
    const distance = calculateDistance(
      selectedPosition.lat, selectedPosition.lng,
      activeLocation.lat, activeLocation.lng
    );
    const guessNumber = userGuesses.length + 1;
    const playerNameWithSuffix = `${playerName}_${guessNumber}`;
    submitGuess.mutate(
      {
        location_id: activeLocation.id,
        device_id: deviceId,
        player_name: playerNameWithSuffix,
        lat: selectedPosition.lat,
        lng: selectedPosition.lng,
        distance_km: distance,
        guess_number: guessNumber,
      },
      { onSuccess: () => setSelectedPosition(null) }
    );
  };

  const formatDistance = (km: number) => {
    if (km < 1) return `${Math.round(km * 1000)} m`;
    if (km < 10) return `${km.toFixed(1)} km`;
    return `${Math.round(km)} km`;
  };

  if (!activeLocation) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No active location to guess</p>
          <p className="text-sm text-muted-foreground mt-1">Wait for a new round to start on the TV</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Make Your Guess
        </CardTitle>
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          <span className="text-xs text-muted-foreground">
            {remainingGuesses} guess{remainingGuesses !== 1 ? "es" : ""} left
            <span className="ml-1">(zoom {zoomIndex + 1}/{ZOOM_LEVELS.length})</span>
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => setShowZoomPassword((v) => !v)}
            title="Manual zoom out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          {([1, 2, 3] as Difficulty[]).map((d) => (
            <Button
              key={d}
              variant={selectedDifficulty === d ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedDifficulty(d)}
              className="h-7 px-2 text-xs"
            >
              {DIFFICULTY_LABELS[d]}
            </Button>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="h-7"
            onClick={() => void createRound(selectedDifficulty)}
            disabled={createNewLocation.isPending || isCreatingRound}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isCreatingRound ? "animate-spin" : ""}`} />
            New
          </Button>
        </div>
      </CardHeader>

        {showZoomPassword && (
          <div className="px-6 pb-2">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <Input
                type="password"
                placeholder="Enter password to zoom out"
                value={zoomPassword}
                onChange={(e) => { setZoomPassword(e.target.value); setZoomError(''); }}
                className="flex-1 h-8 text-sm"
              />
              <Button size="sm" onClick={handleManualZoom} className="h-8">
                Zoom Out
              </Button>
            </div>
            {zoomError && <p className="text-xs text-destructive mt-1">{zoomError}</p>}
          </div>
        )}

      <CardContent className="space-y-4">
        {remainingGuesses === 0 ? (
          <div className="text-center py-6">
            <Check className="h-12 w-12 text-success mx-auto mb-3" />
            <p className="font-medium">You've used all guesses for this zoom level!</p>
            <p className="text-sm text-muted-foreground">Wait for the next zoom out to get 3 more guesses.</p>
            <div className="mt-4 space-y-2">
              <p className="text-sm text-muted-foreground">Your guesses:</p>
              {userGuesses.map((guess, i) => (
                <div key={guess.id} className="text-sm bg-secondary px-3 py-2 rounded-md flex justify-between">
                  <span>Guess #{i + 1}</span>
                  <span className="font-mono text-accent">{formatDistance(guess.distance_km)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="w-full h-[320px] overflow-hidden rounded-lg border">
              <LeafletMap onMapClick={handleMapClick} markerPosition={selectedPosition} />
            </div>

            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              {selectedPosition ? (
                <span className="text-sm">
                  {selectedPosition.lat.toFixed(4)}, {selectedPosition.lng.toFixed(4)}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">Tap the map to place your marker</span>
              )}
            </div>

            <Button
              onClick={handleSubmitGuess}
              disabled={!selectedPosition || submitGuess.isPending}
              className="w-full"
            >
              {submitGuess.isPending ? "Submitting..." : "Submit Guess"}
            </Button>
          </>
        )}

        {userGuesses.length > 0 && remainingGuesses > 0 && (
          <div className="border-t pt-4">
            <p className="text-sm text-muted-foreground mb-2">Previous guesses:</p>
            <div className="space-y-1">
              {userGuesses.map((guess, i) => (
                <div key={guess.id} className="text-sm bg-secondary/50 px-3 py-1 rounded flex justify-between">
                  <span>#{i + 1}</span>
                  <span className="font-mono">{formatDistance(guess.distance_km)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

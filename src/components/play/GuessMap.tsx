import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useActiveLocation } from '@/hooks/useActiveLocation';
import { useUserGuesses } from '@/hooks/useGuesses';
import { useDeviceId } from '@/hooks/useDeviceId';
import { MapPin, Target, Check, AlertCircle } from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface GuessMapProps {
  playerName: string;
}

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
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

export function GuessMap({ playerName }: GuessMapProps) {
  const deviceId = useDeviceId();
  const { activeLocation } = useActiveLocation();
  const { userGuesses, submitGuess, remainingGuesses } = useUserGuesses(
    activeLocation?.id,
    deviceId
  );
  const [selectedPosition, setSelectedPosition] = useState<{ lat: number; lng: number } | null>(null);

  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (remainingGuesses > 0) {
      setSelectedPosition({ lat, lng });
    }
  }, [remainingGuesses]);

  const handleSubmitGuess = () => {
    if (!selectedPosition || !activeLocation || !deviceId) return;

    const distance = calculateDistance(
      selectedPosition.lat,
      selectedPosition.lng,
      activeLocation.lat,
      activeLocation.lng
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
      {
        onSuccess: () => {
          setSelectedPosition(null);
        },
      }
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
          <p className="text-sm text-muted-foreground mt-1">
            Wait for a new round to start on the TV
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Make Your Guess
          </span>
          <span className="text-sm font-normal text-muted-foreground">
            {remainingGuesses} guess{remainingGuesses !== 1 ? 'es' : ''} left
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {remainingGuesses === 0 ? (
          <div className="text-center py-6">
            <Check className="h-12 w-12 text-success mx-auto mb-3" />
            <p className="font-medium">You've used all your guesses!</p>
            <div className="mt-4 space-y-2">
              <p className="text-sm text-muted-foreground">Your guesses:</p>
              {userGuesses.map((guess, i) => (
                <div
                  key={guess.id}
                  className="text-sm bg-secondary px-3 py-2 rounded-md flex justify-between"
                >
                  <span>Guess #{i + 1}</span>
                  <span className="font-mono text-accent">{formatDistance(guess.distance_km)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="h-[300px] rounded-lg overflow-hidden border">
              <MapContainer
                center={[20, 0]}
                zoom={2}
                className="h-full w-full"
                scrollWheelZoom={true}
              >
<TileLayer
  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
  attribution="© OpenStreetMap contributors"

                />
                <MapClickHandler onMapClick={handleMapClick} />
                {selectedPosition && (
                  <Marker position={[selectedPosition.lat, selectedPosition.lng]} />
                )}
              </MapContainer>
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
              {submitGuess.isPending ? 'Submitting...' : 'Submit Guess'}
            </Button>
          </>
        )}

        {userGuesses.length > 0 && remainingGuesses > 0 && (
          <div className="border-t pt-4">
            <p className="text-sm text-muted-foreground mb-2">Previous guesses:</p>
            <div className="space-y-1">
              {userGuesses.map((guess, i) => (
                <div
                  key={guess.id}
                  className="text-sm bg-secondary/50 px-3 py-1 rounded flex justify-between"
                >
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

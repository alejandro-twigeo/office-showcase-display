import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, RefreshCw, Globe } from 'lucide-react';
import { useActiveLocation } from '@/hooks/useActiveLocation';
import { Leaderboard } from './Leaderboard';
import { useGuesses } from '@/hooks/useGuesses';

// Random locations around the world for demo (without Google API)
const DEMO_LOCATIONS = [
  { lat: 48.8584, lng: 2.2945, name: 'Paris, France' },
  { lat: 40.7580, lng: -73.9855, name: 'New York, USA' },
  { lat: 35.6762, lng: 139.6503, name: 'Tokyo, Japan' },
  { lat: -33.8688, lng: 151.2093, name: 'Sydney, Australia' },
  { lat: 51.5074, lng: -0.1278, name: 'London, UK' },
  { lat: 55.7558, lng: 37.6173, name: 'Moscow, Russia' },
  { lat: -22.9068, lng: -43.1729, name: 'Rio de Janeiro, Brazil' },
  { lat: 1.3521, lng: 103.8198, name: 'Singapore' },
  { lat: 41.0082, lng: 28.9784, name: 'Istanbul, Turkey' },
  { lat: 52.5200, lng: 13.4050, name: 'Berlin, Germany' },
];

export function StreetViewDisplay() {
  const { activeLocation, createNewLocation } = useActiveLocation();
  const { guesses } = useGuesses(activeLocation?.id);

  const handleNewLocation = () => {
    const randomIndex = Math.floor(Math.random() * DEMO_LOCATIONS.length);
    const location = DEMO_LOCATIONS[randomIndex];
    createNewLocation.mutate({ lat: location.lat, lng: location.lng });
  };

  return (
    <div className="grid grid-cols-3 gap-4 h-full">
      <div className="col-span-2">
        <Card className="h-full flex flex-col">
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Globe className="h-5 w-5 text-primary" />
              Where in the World?
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNewLocation}
              disabled={createNewLocation.isPending}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${createNewLocation.isPending ? 'animate-spin' : ''}`} />
              New Location
            </Button>
          </CardHeader>
          <CardContent className="flex-1 flex items-center justify-center">
            {activeLocation ? (
              <div className="w-full h-full min-h-[300px] bg-secondary/20 rounded-lg flex flex-col items-center justify-center relative overflow-hidden">
                {/* Placeholder for Street View - shows a stylized globe */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-accent/10 to-info/10" />
                <div className="relative z-10 text-center p-6">
                  <MapPin className="h-16 w-16 text-primary mx-auto mb-4 animate-pulse-soft" />
                  <p className="text-xl font-semibold text-foreground mb-2">Mystery Location</p>
                  <p className="text-muted-foreground text-sm">
                    Open the Play page on your phone to guess!
                  </p>
                  <div className="mt-4 px-4 py-2 bg-card rounded-full inline-block">
                    <span className="text-xs text-muted-foreground font-mono">
                      ID: {activeLocation.id.slice(0, 8)}...
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center p-8">
                <Globe className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">No active location</p>
                <Button onClick={handleNewLocation} disabled={createNewLocation.isPending}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${createNewLocation.isPending ? 'animate-spin' : ''}`} />
                  Start New Round
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

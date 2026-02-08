import { usePlayerName } from '@/hooks/usePlayerName';
import { NameEntry } from '@/components/play/NameEntry';
import { GuessMap } from '@/components/play/GuessMap';
import { PollSection } from '@/components/play/PollSection';
import { YouTubeSection } from '@/components/play/YouTubeSection';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { User, MapPin,BarChart3, Youtube, Monitor, Gamepad2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PlayPage() {
  const [playerName, setPlayerName] = usePlayerName();
  const navigate = useNavigate();

  const handleModeSwitch = (checked: boolean) => {
    if (!checked) {
      navigate('/');
    }
  };

  if (!playerName) {
    return <NameEntry onSubmit={setPlayerName} />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Monitor className="h-4 w-4" />
              <span>TV</span>
            </div>
            <Switch 
              id="mode-switch" 
              checked={true}
              onCheckedChange={handleModeSwitch}
            />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Play</span>
              <Gamepad2 className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span>{playerName}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                localStorage.removeItem('office-tv-player-name');
                window.location.reload();
              }}
            >
              Change
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-lg mx-auto p-4">
        <Tabs defaultValue="guess" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="guess" className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              <span className="hidden sm:inline">Guess</span>
            </TabsTrigger>
            <TabsTrigger value="polls" className="flex items-center gap-1">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Polls</span>
            </TabsTrigger>
            <TabsTrigger value="youtube" className="flex items-center gap-1">
              <Youtube className="h-4 w-4" />
              <span className="hidden sm:inline">YouTube</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="guess">
            <GuessMap playerName={playerName} />
          </TabsContent>

          <TabsContent value="polls">
            <PollSection playerName={playerName} />
          </TabsContent>

          <TabsContent value="youtube">
            <YouTubeSection playerName={playerName} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

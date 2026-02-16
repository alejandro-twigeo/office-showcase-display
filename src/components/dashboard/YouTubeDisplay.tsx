import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useYoutubeQueue } from '@/hooks/useYoutubeQueue';
import { Youtube, User, Music } from 'lucide-react';

export function YouTubeDisplay() {
  const { currentVideo } = useYoutubeQueue();

  return (
    <Card className="h-full min-h-0 flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-[clamp(20px,1.5vw,28px)]">
          <Youtube className="h-[clamp(18px,1.2vw,26px)] w-[clamp(18px,1.2vw,26px)] text-destructive" />
          Now Playing
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 flex flex-col">
        {!currentVideo ? (
          <div className="text-center flex-1 flex flex-col items-center justify-center">
            <Music className="h-[clamp(32px,3vw,64px)] w-[clamp(32px,3vw,64px)] text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-[clamp(14px,1vw,20px)]">No video playing</p>
            <p className="text-muted-foreground text-[clamp(12px,0.8vw,16px)] mt-1">
              Queue one from the Play page!
            </p>
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0 gap-[clamp(8px,0.6vw,16px)]">
            <div className="flex-1 min-h-0 bg-secondary rounded-lg overflow-hidden">
              <iframe
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${currentVideo.video_id}?autoplay=1`}
                title={currentVideo.title}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <div className="space-y-1">
              <h4 className="font-medium line-clamp-1 text-[clamp(16px,1.2vw,24px)]">{currentVideo.title}</h4>
              <div className="flex items-center gap-2 text-[clamp(13px,0.9vw,18px)] text-muted-foreground">
                <User className="h-[clamp(14px,0.9vw,18px)] w-[clamp(14px,0.9vw,18px)]" />
                <span>Queued by {currentVideo.queued_by}</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

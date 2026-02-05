import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useYoutubeQueue } from '@/hooks/useYoutubeQueue';
import { Youtube, User, Music } from 'lucide-react';

export function YouTubeDisplay() {
  const { currentVideo } = useYoutubeQueue();

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Youtube className="h-5 w-5 text-destructive" />
          Now Playing
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!currentVideo ? (
          <div className="text-center py-6">
            <Music className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No video playing</p>
            <p className="text-muted-foreground text-xs mt-1">
              Queue one from the Play page!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="aspect-video bg-secondary rounded-lg overflow-hidden">
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
              <h4 className="font-medium line-clamp-1">{currentVideo.title}</h4>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-3 w-3" />
                <span>Queued by {currentVideo.queued_by}</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

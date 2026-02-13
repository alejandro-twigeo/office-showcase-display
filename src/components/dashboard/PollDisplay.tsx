import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { usePolls, useVotes } from '@/hooks/usePolls';
import { BarChart3, Clock, Users } from 'lucide-react';

export function PollDisplay() {
  const { activePolls, closePoll } = usePolls();
  const [currentPollIndex, setCurrentPollIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);

  const currentPoll = activePolls[currentPollIndex];
  const { votes } = useVotes(currentPoll?.id);

  // Auto-rotate polls every 30 seconds
  useEffect(() => {
    if (activePolls.length === 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setCurrentPollIndex((i) => (i + 1) % activePolls.length);
  return 30;
          // Close current poll and move to next
         // if (currentPoll) {
           // closePoll.mutate(currentPoll.id);
         // }
         // setCurrentPollIndex((i) => (i + 1) % Math.max(1, activePolls.length - 1));
         // return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activePolls.length, currentPoll, closePoll]);

  // Reset index when polls change
  useEffect(() => {
    if (currentPollIndex >= activePolls.length) {
      setCurrentPollIndex(0);
    }
  }, [activePolls.length, currentPollIndex]);

  const getVoteCounts = () => {
    if (!currentPoll) return [];
    const options = currentPoll.options as string[];
    return options.map((_, index) => {
      return votes.filter((v) => v.option_index === index).length;
    });
  };

  const voteCounts = getVoteCounts();
  const totalVotes = voteCounts.reduce((a, b) => a + b, 0);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="h-5 w-5 text-primary" />
            Live Poll
          </CardTitle>
          {currentPoll && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span className="font-mono">{timeLeft}s</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!currentPoll ? (
          <div className="text-center py-8">
            <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No active polls</p>
            <p className="text-muted-foreground text-xs mt-1">
              Create one from the Play page!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="mb-4">
              <Progress value={(timeLeft / 30) * 100} className="h-1" />
            </div>
            <h3 className="font-semibold text-lg">{currentPoll.question}</h3>
            <div className="space-y-3">
              {(currentPoll.options as string[]).map((option, index) => {
                const count = voteCounts[index] || 0;
                const percentage = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
                return (
                  <div key={index} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>{option}</span>
                      <span className="text-muted-foreground">
                        {count} ({Math.round(percentage)}%)
                      </span>
                    </div>
                    <div className="h-8 bg-secondary rounded-md overflow-hidden relative">
                      <div
                        className="h-full bg-primary/80 transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                      <span className="absolute inset-0 flex items-center px-3 text-sm font-medium">
                        {option}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2">
              <Users className="h-4 w-4" />
              <span>{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

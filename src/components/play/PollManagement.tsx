import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePolls, type PollType } from '@/hooks/usePolls';
import { Plus, Trash2, Edit2, X, Check, MessageSquare, List, Clock, RefreshCw } from 'lucide-react';

interface PollManagementProps {
  playerName: string;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function PollManagement({ playerName }: PollManagementProps) {
  const DELETE_POLL_PASSWORD = '1234';
  const { activePolls, createPoll, closePoll, updatePoll, extendPoll } = usePolls();
  const [showCreate, setShowCreate] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [newOptions, setNewOptions] = useState(['', '']);
  const [newPollType, setNewPollType] = useState<PollType>('choice');
  const [editingPollId, setEditingPollId] = useState<string | null>(null);
  const [editQuestion, setEditQuestion] = useState('');
  const [editOptions, setEditOptions] = useState<string[]>([]);

  const handleCreatePoll = () => {
    if (!newQuestion.trim()) return;

    if (newPollType === 'choice') {
      const validOptions = newOptions.filter((o) => o.trim());
      if (validOptions.length < 2) return;
      createPoll.mutate(
        { question: newQuestion.trim(), options: validOptions, created_by: playerName, poll_type: 'choice' },
        { onSuccess: () => { setNewQuestion(''); setNewOptions(['', '']); setShowCreate(false); } }
      );
    } else {
      // freetext — no predefined options
      createPoll.mutate(
        { question: newQuestion.trim(), options: [], created_by: playerName, poll_type: 'freetext' },
        { onSuccess: () => { setNewQuestion(''); setShowCreate(false); } }
      );
    }
  };

  const addOption = () => {
    if (newOptions.length < 6) setNewOptions([...newOptions, '']);
  };

  const startEditing = (poll: { id: string; question: string; options: string[] }) => {
    setEditingPollId(poll.id);
    setEditQuestion(poll.question);
    setEditOptions([...poll.options]);
  };

  const cancelEditing = () => {
    setEditingPollId(null);
    setEditQuestion('');
    setEditOptions([]);
  };

  const saveEdit = () => {
    if (!editingPollId) return;
    const validOptions = editOptions.filter((o) => o.trim());
    if (editQuestion.trim() && validOptions.length >= 2) {
      updatePoll.mutate(
        { pollId: editingPollId, question: editQuestion.trim(), options: validOptions },
        { onSuccess: () => cancelEditing() }
      );
    }
  };

  const addEditOption = () => {
    if (editOptions.length < 6) setEditOptions([...editOptions, '']);
  };

  const handleDeletePoll = (pollId: string) => {
    const enteredPassword = window.prompt('Enter password to delete this poll');
    if (enteredPassword === null) return;
    if (enteredPassword !== DELETE_POLL_PASSWORD) {
      window.alert('Incorrect password. Poll was not deleted.');
      return;
    }
    closePoll.mutate({ pollId, closedBy: playerName });
  };

  const canCreate = newPollType === 'freetext'
    ? !!newQuestion.trim()
    : !!newQuestion.trim() && newOptions.filter((o) => o.trim()).length >= 2;

  // Polls older than 7 days
  const expiredPolls = useMemo(() => {
    return activePolls.filter(p => {
      const started = p.started_at ?? p.created_at;
      if (!started) return false;
      return Date.now() - new Date(started).getTime() > SEVEN_DAYS_MS;
    });
  }, [activePolls]);

  const handleExtendPoll = (pollId: string) => {
    extendPoll.mutate(pollId);
  };

  return (
    <div className="space-y-4">
      {/* 7-day expiry warnings */}
      {expiredPolls.length > 0 && (
        <div className="space-y-2">
          {expiredPolls.map(poll => {
            const days = Math.floor((Date.now() - new Date(poll.started_at ?? poll.created_at ?? '').getTime()) / (1000 * 60 * 60 * 24));
            return (
              <div key={poll.id} className="rounded-lg border border-warning/50 bg-warning/10 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <Clock className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">"{poll.question}" has been live for {days} days</p>
                    <p className="text-xs text-muted-foreground">Keep it going or close it to keep polls fresh?</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => handleExtendPoll(poll.id)}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Extend 7 days
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs text-destructive hover:text-destructive"
                    onClick={() => handleDeletePoll(poll.id)}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Close poll
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* Create Poll Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowCreate(!showCreate)}
        className="w-full"
      >
        <Plus className="h-4 w-4 mr-1" />
        {showCreate ? 'Cancel' : 'New Poll'}
      </Button>

      {/* Create Poll Form */}
      {showCreate && (
        <div className="border rounded-lg p-4 space-y-3 bg-secondary/20">
          {/* Poll type toggle */}
          <div className="grid grid-cols-2 gap-1 bg-muted p-1 rounded-md">
            <button
              onClick={() => setNewPollType('choice')}
              className={`flex items-center justify-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-all ${
                newPollType === 'choice' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              Fixed Options
            </button>
            <button
              onClick={() => setNewPollType('freetext')}
              className={`flex items-center justify-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-all ${
                newPollType === 'freetext' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Free Text
            </button>
          </div>

          <Input
            placeholder="Ask a question..."
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
          />

          {newPollType === 'choice' && (
            <>
              {newOptions.map((option, i) => (
                <Input
                  key={i}
                  placeholder={`Option ${i + 1}`}
                  value={option}
                  onChange={(e) => {
                    const updated = [...newOptions];
                    updated[i] = e.target.value;
                    setNewOptions(updated);
                  }}
                />
              ))}
            </>
          )}

          {newPollType === 'freetext' && (
            <p className="text-xs text-muted-foreground bg-muted/60 rounded p-2">
              Players will type their own answers and others can upvote them.
            </p>
          )}

          <div className="flex gap-2">
            {newPollType === 'choice' && newOptions.length < 6 && (
              <Button variant="outline" size="sm" onClick={addOption}>
                Add Option
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleCreatePoll}
              disabled={!canCreate || createPoll.isPending}
            >
              Create Poll
            </Button>
          </div>
        </div>
      )}

      {/* Active Polls List */}
      {activePolls.length === 0 ? (
        <p className="text-center text-muted-foreground py-4 text-sm">
          No active polls. Create one!
        </p>
      ) : (
        <div className="space-y-3">
          {activePolls.map((poll) => (
            <div key={poll.id} className="border rounded-lg p-3 space-y-2">
              {editingPollId === poll.id ? (
                <div className="space-y-2">
                  <Input
                    value={editQuestion}
                    onChange={(e) => setEditQuestion(e.target.value)}
                    placeholder="Question"
                  />
                  {editOptions.map((option, i) => (
                    <Input
                      key={i}
                      value={option}
                      onChange={(e) => {
                        const updated = [...editOptions];
                        updated[i] = e.target.value;
                        setEditOptions(updated);
                      }}
                      placeholder={`Option ${i + 1}`}
                    />
                  ))}
                  <div className="flex gap-2">
                    {editOptions.length < 6 && (
                      <Button variant="outline" size="sm" onClick={addEditOption}>
                        Add Option
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={saveEdit}
                      disabled={
                        !editQuestion.trim() ||
                        editOptions.filter((o) => o.trim()).length < 2 ||
                        updatePoll.isPending
                      }
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Save
                    </Button>
                    <Button variant="outline" size="sm" onClick={cancelEditing}>
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        {poll.poll_type === 'freetext'
                          ? <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          : <List className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        }
                        <p className="font-medium text-sm">{poll.question}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        by {poll.created_by} •{' '}
                        {poll.poll_type === 'freetext'
                          ? `${poll.options.length} answers so far`
                          : `${poll.options.length} options`}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {poll.poll_type === 'choice' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEditing(poll)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeletePoll(poll.id)}
                        disabled={closePoll.isPending}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {poll.poll_type === 'choice' && (
                    <div className="flex flex-wrap gap-1">
                      {poll.options.map((option, i) => (
                        <span key={i} className="text-xs bg-secondary px-2 py-1 rounded">
                          {option}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

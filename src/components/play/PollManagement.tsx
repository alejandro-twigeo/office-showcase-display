import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePolls } from '@/hooks/usePolls';
import { Plus, Trash2, Edit2, X, Check } from 'lucide-react';

interface PollManagementProps {
  playerName: string;
}

export function PollManagement({ playerName }: PollManagementProps) {
  const DELETE_POLL_PASSWORD = '1234';
  const { activePolls, createPoll, closePoll, updatePoll } = usePolls();
  const [showCreate, setShowCreate] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [newOptions, setNewOptions] = useState(['', '']);
  const [editingPollId, setEditingPollId] = useState<string | null>(null);
  const [editQuestion, setEditQuestion] = useState('');
  const [editOptions, setEditOptions] = useState<string[]>([]);

  const handleCreatePoll = () => {
    const validOptions = newOptions.filter((o) => o.trim());
    if (newQuestion.trim() && validOptions.length >= 2) {
      createPoll.mutate(
        {
          question: newQuestion.trim(),
          options: validOptions,
          created_by: playerName,
        },
        {
          onSuccess: () => {
            setNewQuestion('');
            setNewOptions(['', '']);
            setShowCreate(false);
          },
        }
      );
    }
  };

  const addOption = () => {
    if (newOptions.length < 4) {
      setNewOptions([...newOptions, '']);
    }
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
        {
          pollId: editingPollId,
          question: editQuestion.trim(),
          options: validOptions,
        },
        {
          onSuccess: () => {
            cancelEditing();
          },
        }
      );
    }
  };

  const addEditOption = () => {
    if (editOptions.length < 4) {
      setEditOptions([...editOptions, '']);
    }
  };

  const handleDeletePoll = (pollId: string) => {
    const enteredPassword = window.prompt('Enter password to delete this poll');

    if (enteredPassword === null) return;

    if (enteredPassword !== DELETE_POLL_PASSWORD) {
      window.alert('Incorrect password. Poll was not deleted.');
      return;
    }

    closePoll.mutate(pollId);
  };

  return (
    <div className="space-y-4">
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
          <Input
            placeholder="Ask a question..."
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
          />
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
          <div className="flex gap-2">
            {newOptions.length < 4 && (
              <Button variant="outline" size="sm" onClick={addOption}>
                Add Option
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleCreatePoll}
              disabled={
                !newQuestion.trim() ||
                newOptions.filter((o) => o.trim()).length < 2 ||
                createPoll.isPending
              }
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
                // Edit Mode
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
                    {editOptions.length < 4 && (
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
                // View Mode
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">{poll.question}</p>
                      <p className="text-xs text-muted-foreground">
                        by {poll.created_by} • {poll.options.length} options
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEditing(poll)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
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
                  <div className="flex flex-wrap gap-1">
                    {poll.options.map((option, i) => (
                      <span
                        key={i}
                        className="text-xs bg-secondary px-2 py-1 rounded"
                      >
                        {option}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

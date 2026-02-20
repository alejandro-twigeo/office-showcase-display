import { useState } from "react";
import { usePositiveMessages } from "@/hooks/usePositiveMessages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Heart, Plus, Pencil, Trash2, Check, X, Shield } from "lucide-react";

const MAX_LEN = 120;
const ADMIN_PASSWORD = "5678";

interface Props {
  playerName: string;
}

export function PositiveMessagesSection({ playerName }: Props) {
  const { messages, isLoading, addMessage, updateMessage, deactivateMessage } = usePositiveMessages();

  // Add form
  const [newMsg, setNewMsg] = useState("");
  const [newBy, setNewBy] = useState(playerName);
  const [addError, setAddError] = useState("");

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMsg, setEditMsg] = useState("");
  const [editBy, setEditBy] = useState("");
  const [editError, setEditError] = useState("");

  // Admin (delete)
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminInput, setAdminInput] = useState("");
  const [adminError, setAdminError] = useState("");

  function validateMessage(msg: string): string {
    if (!msg.trim()) return "Message can't be empty.";
    if (msg.trim().length > MAX_LEN) return `Keep it short! Max ${MAX_LEN} characters.`;
    return "";
  }

  function handleAdd() {
    const err = validateMessage(newMsg);
    if (err) { setAddError(err); return; }
    if (!newBy.trim()) { setAddError("Please add your name."); return; }
    setAddError("");
    addMessage.mutate({ message: newMsg, created_by: newBy });
    setNewMsg("");
  }

  function startEdit(msg: { id: string; message: string; created_by: string }) {
    setEditingId(msg.id);
    setEditMsg(msg.message);
    setEditBy(msg.created_by);
    setEditError("");
  }

  function handleUpdate() {
    const err = validateMessage(editMsg);
    if (err) { setEditError(err); return; }
    if (!editBy.trim()) { setEditError("Please add your name."); return; }
    setEditError("");
    updateMessage.mutate({ id: editingId!, message: editMsg, created_by: editBy });
    setEditingId(null);
  }

  function handleAdminUnlock() {
    if (adminInput === ADMIN_PASSWORD) {
      setAdminUnlocked(true);
      setAdminError("");
      setAdminInput("");
    } else {
      setAdminError("Wrong password.");
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Heart className="h-4 w-4 text-primary fill-primary" />
          Positive Messages
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Add form */}
        <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
          <Textarea
            placeholder="Share something positive… (max 120 chars)"
            value={newMsg}
            onChange={(e) => { setNewMsg(e.target.value.slice(0, MAX_LEN)); setAddError(""); }}
            className="resize-none text-sm min-h-[70px]"
          />
          <div className="flex items-center gap-2">
            <Input
              placeholder="Your name"
              value={newBy}
              onChange={(e) => setNewBy(e.target.value)}
              className="text-sm h-8 flex-1"
            />
            <span className="text-xs text-muted-foreground whitespace-nowrap">{newMsg.length}/{MAX_LEN}</span>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={addMessage.isPending}
              className="gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </Button>
          </div>
          {addError && <p className="text-xs text-destructive">{addError}</p>}
        </div>

        {/* Messages list */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No messages yet. Add the first one! ✨</p>
        ) : (
          <div className="space-y-2">
            {messages.map((msg) => (
              <div key={msg.id} className="border rounded-lg p-3 space-y-2">
                {editingId === msg.id ? (
                  <>
                    <Textarea
                      value={editMsg}
                      onChange={(e) => { setEditMsg(e.target.value.slice(0, MAX_LEN)); setEditError(""); }}
                      className="resize-none text-sm min-h-[60px]"
                    />
                    <div className="flex items-center gap-2">
                      <Input
                        value={editBy}
                        onChange={(e) => setEditBy(e.target.value)}
                        placeholder="Your name"
                        className="text-sm h-7 flex-1"
                      />
                      <span className="text-xs text-muted-foreground">{editMsg.length}/{MAX_LEN}</span>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleUpdate}>
                        <Check className="h-3.5 w-3.5 text-primary" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {editError && <p className="text-xs text-destructive">{editError}</p>}
                  </>
                ) : (
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-snug">{msg.message}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">— {msg.created_by}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(msg)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {adminUnlocked && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => deactivateMessage.mutate(msg.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Admin unlock for delete */}
        {!adminUnlocked ? (
          <div className="border-t pt-3">
            <div className="flex items-center gap-2">
              <Shield className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <Input
                type="password"
                placeholder="Admin password to delete"
                value={adminInput}
                onChange={(e) => { setAdminInput(e.target.value); setAdminError(""); }}
                className="text-sm h-8 flex-1"
                onKeyDown={(e) => e.key === "Enter" && handleAdminUnlock()}
              />
              <Button size="sm" variant="outline" onClick={handleAdminUnlock}>
                Unlock
              </Button>
            </div>
            {adminError && <p className="text-xs text-destructive mt-1">{adminError}</p>}
          </div>
        ) : (
          <div className="border-t pt-3 flex items-center gap-2 text-xs text-primary">
            <Shield className="h-3 w-3" />
            Admin mode — delete enabled
          </div>
        )}
      </CardContent>
    </Card>
  );
}

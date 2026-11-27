import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { KUDOS_DEFAULT_DAYS, kudosEndInDays } from "@/lib/kudos";

export interface PositiveMessage {
  id: string;
  message: string;
  created_by: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  /** When it leaves the TV (null for kudos from before end dates: 7 days after posting) */
  expires_at?: string | null;
}

// The end-date column is new. If the database doesn't have it yet, save without it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const missingColumn = (error: any) => /expires_at/.test(String(error?.message ?? ""));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pmTable = () => (supabase as any).from("positive_messages");

export function usePositiveMessages() {
  const queryClient = useQueryClient();

  const { data: messages = [], isLoading } = useQuery<PositiveMessage[]>({
    queryKey: ["positive-messages"],
    queryFn: async (): Promise<PositiveMessage[]> => {
      const { data, error } = await pmTable()
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PositiveMessage[];
    },
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("positive-messages-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "positive_messages" }, () => {
        queryClient.invalidateQueries({ queryKey: ["positive-messages"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const addMessage = useMutation({
    mutationFn: async (data: { message: string; created_by: string; days?: number }) => {
      const row = {
        message: data.message.trim(),
        created_by: data.created_by.trim(),
        is_active: true,
      };
      let { error } = await pmTable().insert({ ...row, expires_at: kudosEndInDays(data.days ?? KUDOS_DEFAULT_DAYS) });
      if (error && missingColumn(error)) ({ error } = await pmTable().insert(row));
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positive-messages"] });
    },
  });

  const updateMessage = useMutation({
    mutationFn: async (data: { id: string; message: string; created_by: string }) => {
      const { error } = await pmTable()
        .update({ message: data.message.trim(), created_by: data.created_by.trim(), updated_at: new Date().toISOString() })
        .eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positive-messages"] });
    },
  });

  /** Show on the TV for this many more days, counting from now */
  const setDaysLeft = useMutation({
    mutationFn: async (data: { id: string; days: number }) => {
      const { error } = await pmTable()
        .update({ expires_at: kudosEndInDays(data.days), updated_at: new Date().toISOString() })
        .eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positive-messages"] });
    },
  });

  const deactivateMessage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await pmTable()
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positive-messages"] });
    },
  });

  return { messages, isLoading, addMessage, updateMessage, setDaysLeft, deactivateMessage };
}

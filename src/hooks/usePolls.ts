import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

interface Poll {
  id: string;
  question: string;
  options: string[];
  is_active: boolean;
  created_by: string;
  started_at: string | null;
  created_at: string | null;
}

interface Vote {
  id: string;
  poll_id: string;
  device_id: string;
  player_name: string;
  option_index: number;
  created_at: string | null;
}

export function usePolls() {
  const queryClient = useQueryClient();

  const { data: activePolls = [], isLoading } = useQuery({
    queryKey: ['active-polls'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('polls')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return (data || []).map(poll => ({
        ...poll,
        options: Array.isArray(poll.options) ? poll.options : [],
      })) as Poll[];
    },
  });

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('polls-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'polls' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['active-polls'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const createPoll = useMutation({
    mutationFn: async (data: { question: string; options: string[]; created_by: string }) => {
      const { error } = await supabase.from('polls').insert({
        question: data.question,
        options: data.options,
        created_by: data.created_by,
        is_active: true,
        started_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-polls'] });
    },
  });

  const closePoll = useMutation({
    mutationFn: async ({ pollId, closedBy }: { pollId: string; closedBy: string }) => {
      const { error } = await supabase.rpc('close_poll', {
        p_poll_id: pollId,
        p_reason: 'user_deleted',
        p_source: 'play_page',
        p_closed_by: closedBy,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-polls'] });
    },
  });

  const updatePoll = useMutation({
    mutationFn: async (data: { pollId: string; question: string; options: string[] }) => {
      const { error } = await supabase
        .from('polls')
        .update({ question: data.question, options: data.options })
        .eq('id', data.pollId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-polls'] });
    },
  });

  return { activePolls, isLoading, createPoll, closePoll, updatePoll };
}

export function useVotes(pollId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: votes = [], isLoading } = useQuery({
    queryKey: ['votes', pollId],
    queryFn: async () => {
      if (!pollId) return [];
      
      const { data, error } = await supabase
        .from('votes')
        .select('*')
        .eq('poll_id', pollId);
      
      if (error) throw error;
      return data as Vote[];
    },
    enabled: !!pollId,
  });

  // Real-time subscription
  useEffect(() => {
    if (!pollId) return;

    const channel = supabase
      .channel(`votes-${pollId}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'votes',
          filter: `poll_id=eq.${pollId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['votes', pollId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pollId, queryClient]);

  const submitVote = useMutation({
    mutationFn: async (data: {
      poll_id: string;
      device_id: string;
      player_name: string;
      option_index: number;
    }) => {
      const { error } = await supabase.from('votes').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['votes', pollId] });
    },
  });

  return { votes, isLoading, submitVote };
}

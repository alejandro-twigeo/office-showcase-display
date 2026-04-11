import { useState, useCallback, useEffect } from 'react';
import { useRounds } from './useRounds';
import { useScoring } from './useScoring';
import { useDeviceId } from './useDeviceId';
import { supabase } from '@/integrations/supabase/client';
import { getWordForRound, isValidWord } from '@/lib/wordlist';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { calculateWordleScore } from './useScoring';

export type LetterStatus = 'correct' | 'present' | 'absent' | 'empty';

export interface WordleGuess {
  word: string;
  statuses: LetterStatus[];
}

export function useWordle(playerName: string, roundIdOverride?: string) {
  const { activeRound } = useRounds();
  const { settings } = useScoring();
  const deviceId = useDeviceId();
  const queryClient = useQueryClient();

  const roundId = roundIdOverride ?? activeRound?.id;
  const roundNumber = activeRound?.round_number ?? 0;
  const targetWord = getWordForRound(roundNumber);
  const wordlePoints = settings.wordle_points;

  // Check if already submitted for this round
  const { data: existingScore } = useQuery({
    queryKey: ['wordle_score', roundId, playerName],
    queryFn: async () => {
      if (!roundId) return null;
      const { data } = await supabase
        .from('wordle_scores' as any)
        .select('*')
        .eq('round_id', roundId)
        .eq('player_name', playerName)
        .maybeSingle();
      return data as any;
    },
    enabled: !!roundId,
  });

  const [guesses, setGuesses] = useState<WordleGuess[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [error, setError] = useState('');

  // Reset when round changes
  useEffect(() => {
    if (existingScore) {
      // Reconstruct state from saved score
      setGameOver(true);
      setWon(existingScore.solved);
      setGuesses([]); // We don't store individual guesses, just show completion state
    } else {
      setGuesses([]);
      setCurrentInput('');
      setGameOver(false);
      setWon(false);
    }
  }, [roundId, existingScore]);

  const evaluateGuess = useCallback((guess: string): LetterStatus[] => {
    const statuses: LetterStatus[] = Array(5).fill('absent');
    const targetChars = targetWord.split('');
    const guessChars = guess.split('');

    // First pass: correct positions
    for (let i = 0; i < 5; i++) {
      if (guessChars[i] === targetChars[i]) {
        statuses[i] = 'correct';
        targetChars[i] = '#'; // mark as used
      }
    }

    // Second pass: present but wrong position
    for (let i = 0; i < 5; i++) {
      if (statuses[i] === 'correct') continue;
      const idx = targetChars.indexOf(guessChars[i]);
      if (idx !== -1) {
        statuses[i] = 'present';
        targetChars[idx] = '#';
      }
    }

    return statuses;
  }, [targetWord]);

  const submitGuess = useCallback(async () => {
    setError('');
    const word = currentInput.toLowerCase();

    if (word.length !== 5) {
      setError('Word must be 5 letters');
      return;
    }
    if (!isValidWord(word)) {
      setError('Only letters allowed');
      return;
    }
    if (gameOver) return;

    const statuses = evaluateGuess(word);
    const newGuesses = [...guesses, { word, statuses }];
    setGuesses(newGuesses);
    setCurrentInput('');

    const solved = statuses.every(s => s === 'correct');
    const outOfAttempts = newGuesses.length >= 6;

    if (solved || outOfAttempts) {
      setGameOver(true);
      setWon(solved);

      // Save to database
      if (roundId && deviceId) {
        await supabase
          .from('wordle_scores' as any)
          .upsert({
            round_id: roundId,
            player_name: playerName,
            device_id: deviceId,
            attempts: newGuesses.length,
            solved,
          } as any, { onConflict: 'round_id,player_name' });
        queryClient.invalidateQueries({ queryKey: ['wordle_score', roundId, playerName] });
        queryClient.invalidateQueries({ queryKey: ['wordle_leaderboard'] });
      }
    }
  }, [currentInput, guesses, gameOver, evaluateGuess, roundId, deviceId, playerName, queryClient]);

  const earnedPoints = won ? calculateWordleScore(guesses.length, settings) : 0;
  const existingEarnedPoints = existingScore?.solved
    ? calculateWordleScore(existingScore.attempts, settings)
    : 0;

  return {
    guesses,
    currentInput,
    setCurrentInput,
    submitGuess,
    gameOver,
    won,
    error,
    targetWord,
    wordlePoints,
    earnedPoints,
    existingEarnedPoints,
    settings,
    alreadyPlayed: !!existingScore,
    existingScore,
    roundNumber,
  };
}

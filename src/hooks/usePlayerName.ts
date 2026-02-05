import { useState, useEffect } from 'react';

const PLAYER_NAME_KEY = 'office-tv-player-name';

export function usePlayerName(): [string, (name: string) => void] {
  const [playerName, setPlayerNameState] = useState<string>('');

  useEffect(() => {
    const stored = localStorage.getItem(PLAYER_NAME_KEY);
    if (stored) {
      setPlayerNameState(stored);
    }
  }, []);

  const setPlayerName = (name: string) => {
    localStorage.setItem(PLAYER_NAME_KEY, name);
    setPlayerNameState(name);
  };

  return [playerName, setPlayerName];
}

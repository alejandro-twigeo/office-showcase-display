export interface MiniGame {
  id: string;
  name: string;
  emoji: string;
  description: string;
}

export const MINI_GAMES: MiniGame[] = [
  { id: 'wordle', name: 'Wordle', emoji: '🟩', description: 'Guess the 5-letter word' },
  { id: 'city_guess', name: 'City Guess', emoji: '🏙️', description: 'Guess location in a specific city' },
  { id: 'color_memory', name: 'Color Memory', emoji: '🎨', description: 'Memorize a color and rebuild it from memory' },
  { id: 'this_or_that', name: 'This or That', emoji: '⚖️', description: '5 daily preference questions' },
  { id: 'sudoku', name: 'Sudoku', emoji: '🔢', description: '6×6 sudoku, hard mode' },
  { id: 'pairs', name: 'Pairs', emoji: '🃏', description: 'Memory card matching game' },
  { id: 'labyrinth', name: 'Zip', emoji: '🌀', description: 'Connect all cells in order' },
];

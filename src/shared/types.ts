export type PlayerColor = 'blue' | 'red';

export interface Point {
  x: number;
  y: number;
}

export interface ChatMessage {
  id: string;
  sender: PlayerColor;
  text: string;
  timestamp: number;
}

export interface GameState {
  roomId: string;
  board: (PlayerColor | null)[][];
  turn: PlayerColor;
  players: {
    blue: string; // socket id
    red: string; // socket id
  };
  status: 'waiting' | 'playing' | 'finished';
  winner: PlayerColor | 'draw' | null;
  scores: { blue: number; red: number };
}

export const COLS = 7;
export const ROWS = 10;

export function createInitialBoard(): (PlayerColor | null)[][] {
  const board: (PlayerColor | null)[][] = Array(ROWS).fill(null).map(() => Array(COLS).fill(null));
  
  // Initial positions
  board[0][0] = 'blue';
  board[ROWS - 1][COLS - 1] = 'blue';
  
  board[0][COLS - 1] = 'red';
  board[ROWS - 1][0] = 'red';
  
  return board;
}

export function calculateScores(board: (PlayerColor | null)[][]) {
  let blue = 0;
  let red = 0;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (board[y][x] === 'blue') blue++;
      if (board[y][x] === 'red') red++;
    }
  }
  return { blue, red };
}

export function getValidMoves(board: (PlayerColor | null)[][], color: PlayerColor): Point[] {
  const moves: Point[] = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (board[y][x] === color) {
        // Check 5x5 area around the piece
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const ny = y + dy;
            const nx = x + dx;
            if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS && board[ny][nx] === null) {
              moves.push({ x: nx, y: ny });
            }
          }
        }
      }
    }
  }
  return moves;
}

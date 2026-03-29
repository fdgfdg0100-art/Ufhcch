import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GameState, createInitialBoard, calculateScores, getValidMoves, COLS, ROWS, PlayerColor } from './src/shared/types.js';

async function startServer() {
  const app = express();
  const PORT = 3000;
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*' }
  });

  // API routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Game State Management
  let waitingPlayer: string | null = null;
  const games = new Map<string, GameState>();
  const playerRooms = new Map<string, string>();
  const privateRooms = new Map<string, string>(); // code -> host socket id

  io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    const startGame = (p1Id: string, p2Id: string) => {
      const roomId = `room_${Date.now()}`;
      const gameState: GameState = {
        roomId,
        board: createInitialBoard(),
        turn: 'blue',
        players: {
          blue: p1Id,
          red: p2Id
        },
        status: 'playing',
        winner: null,
        scores: { blue: 2, red: 2 }
      };

      games.set(roomId, gameState);
      playerRooms.set(p1Id, roomId);
      playerRooms.set(p2Id, roomId);

      const p1 = io.sockets.sockets.get(p1Id);
      const p2 = io.sockets.sockets.get(p2Id);

      p1?.join(roomId);
      p2?.join(roomId);

      io.to(roomId).emit('gameStart', gameState);
    };

    socket.on('findMatch', () => {
      if (waitingPlayer && waitingPlayer !== socket.id) {
        const p1 = waitingPlayer;
        waitingPlayer = null;
        startGame(p1, socket.id);
      } else {
        waitingPlayer = socket.id;
        socket.emit('waiting');
      }
    });

    socket.on('createPrivate', () => {
      const code = Math.floor(1000 + Math.random() * 9000).toString();
      privateRooms.set(code, socket.id);
      socket.emit('privateCreated', code);
    });

    socket.on('joinPrivate', (code: string) => {
      const hostId = privateRooms.get(code);
      if (hostId && hostId !== socket.id) {
        privateRooms.delete(code);
        startGame(hostId, socket.id);
      } else {
        socket.emit('errorMsg', 'رمز الغرفة غير صحيح أو الغرفة ممتلئة');
      }
    });

    socket.on('sendChat', (text: string) => {
      const roomId = playerRooms.get(socket.id);
      if (!roomId) return;
      const game = games.get(roomId);
      if (!game) return;
      
      const senderColor = game.players.blue === socket.id ? 'blue' : 'red';
      const message = {
        id: Math.random().toString(36).substring(7),
        sender: senderColor,
        text,
        timestamp: Date.now()
      };
      
      io.to(roomId).emit('receiveChat', message);
    });

    socket.on('makeMove', ({ from, to }: { from: {x: number, y: number}, to: {x: number, y: number} }) => {
      const roomId = playerRooms.get(socket.id);
      if (!roomId) return;

      const game = games.get(roomId);
      if (!game || game.status !== 'playing') return;

      const playerColor = game.players.blue === socket.id ? 'blue' : 'red';
      if (game.turn !== playerColor) return;

      // Validate move
      if (game.board[from.y][from.x] !== playerColor) return;
      if (game.board[to.y][to.x] !== null) return;

      const dx = Math.abs(from.x - to.x);
      const dy = Math.abs(from.y - to.y);
      const distance = Math.max(dx, dy);

      if (distance > 2 || distance === 0) return;

      // Apply move
      if (distance === 2) {
        // Jump: remove original
        game.board[from.y][from.x] = null;
      }
      // Clone or Jump: place new piece
      game.board[to.y][to.x] = playerColor;

      // Capture adjacent enemies
      for (let cy = -1; cy <= 1; cy++) {
        for (let cx = -1; cx <= 1; cx++) {
          const ny = to.y + cy;
          const nx = to.x + cx;
          if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS) {
            const targetColor = game.board[ny][nx];
            if (targetColor !== null && targetColor !== playerColor) {
              game.board[ny][nx] = playerColor;
            }
          }
        }
      }

      game.scores = calculateScores(game.board);
      
      // Check win condition
      const nextTurn = playerColor === 'blue' ? 'red' : 'blue';
      const nextValidMoves = getValidMoves(game.board, nextTurn);
      
      if (game.scores.blue === 0) {
        game.status = 'finished';
        game.winner = 'red';
      } else if (game.scores.red === 0) {
        game.status = 'finished';
        game.winner = 'blue';
      } else if (nextValidMoves.length === 0) {
        // Next player has no moves, check if current player has moves
        const currentValidMoves = getValidMoves(game.board, playerColor);
        if (currentValidMoves.length === 0) {
          // Board is full or neither can move
          game.status = 'finished';
          game.winner = game.scores.blue > game.scores.red ? 'blue' : (game.scores.red > game.scores.blue ? 'red' : 'draw');
        } else {
          // Skip turn
          game.turn = playerColor;
        }
      } else {
        game.turn = nextTurn;
      }

      io.to(roomId).emit('gameStateUpdate', game);
    });

    socket.on('disconnect', () => {
      console.log('Player disconnected:', socket.id);
      if (waitingPlayer === socket.id) {
        waitingPlayer = null;
      }
      
      // Remove from private rooms
      for (const [code, hostId] of privateRooms.entries()) {
        if (hostId === socket.id) {
          privateRooms.delete(code);
        }
      }

      const roomId = playerRooms.get(socket.id);
      if (roomId) {
        const game = games.get(roomId);
        if (game && game.status === 'playing') {
          game.status = 'finished';
          game.winner = game.players.blue === socket.id ? 'red' : 'blue';
          io.to(roomId).emit('gameStateUpdate', game);
          io.to(roomId).emit('playerDisconnected');
        }
        playerRooms.delete(socket.id);
      }
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { GameState, Point, ChatMessage } from './shared/types';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, Trophy, Users, Loader2, MessageCircle, X, Send, Lock, KeyRound } from 'lucide-react';
import { cn } from './lib/utils';

// Connect to the same host
const socket: Socket = io();

export default function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isWaiting, setIsWaiting] = useState(false);
  const [selectedPiece, setSelectedPiece] = useState<Point | null>(null);
  const [myColor, setMyColor] = useState<'blue' | 'red' | null>(null);
  
  // Menu state
  const [menuMode, setMenuMode] = useState<'main' | 'join'>('main');
  const [roomCode, setRoomCode] = useState('');
  const [myRoomCode, setMyRoomCode] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Chat state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    socket.on('waiting', () => {
      setIsWaiting(true);
    });

    socket.on('privateCreated', (code: string) => {
      setMyRoomCode(code);
      setIsWaiting(true);
    });

    socket.on('errorMsg', (msg: string) => {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(null), 3000);
    });

    socket.on('gameStart', (state: GameState) => {
      setIsWaiting(false);
      setMyRoomCode(null);
      setMenuMode('main');
      setGameState(state);
      setMyColor(state.players.blue === socket.id ? 'blue' : 'red');
      setSelectedPiece(null);
      setChatMessages([]);
      setUnreadCount(0);
    });

    socket.on('gameStateUpdate', (state: GameState) => {
      setGameState(state);
      if (state.turn !== myColor) {
        setSelectedPiece(null);
      }
    });

    socket.on('receiveChat', (msg: ChatMessage) => {
      setChatMessages(prev => [...prev, msg]);
      if (!isChatOpen) {
        setUnreadCount(prev => prev + 1);
      }
    });

    socket.on('playerDisconnected', () => {
      alert('اللاعب الآخر غادر المباراة!');
    });

    return () => {
      socket.off('waiting');
      socket.off('privateCreated');
      socket.off('errorMsg');
      socket.off('gameStart');
      socket.off('gameStateUpdate');
      socket.off('receiveChat');
      socket.off('playerDisconnected');
    };
  }, [myColor, isChatOpen]);

  useEffect(() => {
    if (isChatOpen) {
      setUnreadCount(0);
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isChatOpen, chatMessages]);

  const findMatch = () => {
    socket.emit('findMatch');
  };

  const createPrivate = () => {
    socket.emit('createPrivate');
  };

  const joinPrivate = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomCode.trim().length === 4) {
      socket.emit('joinPrivate', roomCode.trim());
    }
  };

  const sendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim()) {
      socket.emit('sendChat', chatInput.trim());
      setChatInput('');
    }
  };

  const handleCellClick = (x: number, y: number) => {
    if (!gameState || gameState.status !== 'playing' || gameState.turn !== myColor) return;

    const cell = gameState.board[y][x];

    if (cell === myColor) {
      setSelectedPiece({ x, y });
      return;
    }

    if (cell === null && selectedPiece) {
      const dx = Math.abs(selectedPiece.x - x);
      const dy = Math.abs(selectedPiece.y - y);
      const distance = Math.max(dx, dy);

      if (distance > 0 && distance <= 2) {
        socket.emit('makeMove', { from: selectedPiece, to: { x, y } });
        setSelectedPiece(null);
      }
    }
  };

  const getValidMoves = () => {
    if (!selectedPiece || !gameState) return [];
    const moves: Point[] = [];
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const ny = selectedPiece.y + dy;
        const nx = selectedPiece.x + dx;
        if (
          ny >= 0 && ny < gameState.board.length &&
          nx >= 0 && nx < gameState.board[0].length &&
          gameState.board[ny][nx] === null
        ) {
          moves.push({ x: nx, y: ny });
        }
      }
    }
    return moves;
  };

  const validMoves = getValidMoves();

  if (!gameState) {
    return (
      <div className="w-full h-[100dvh] max-w-md mx-auto bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 font-sans" dir="rtl">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex flex-col items-center gap-8 w-full"
        >
          <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-indigo-500/20">
            <Swords className="w-12 h-12 text-white" />
          </div>
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-black tracking-tight bg-gradient-to-br from-white to-slate-400 bg-clip-text text-transparent">
              حرب الخلايا
            </h1>
            <p className="text-slate-400 font-medium">لعبة استراتيجية متعددة اللاعبين</p>
          </div>

          {errorMsg && (
            <div className="bg-red-500/20 text-red-400 px-4 py-2 rounded-lg text-sm font-bold w-full max-w-xs text-center">
              {errorMsg}
            </div>
          )}

          {isWaiting ? (
            <div className="flex flex-col items-center gap-4 w-full max-w-xs">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full flex flex-col items-center gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                <span className="font-medium text-slate-300">
                  {myRoomCode ? 'في انتظار انضمام صديقك...' : 'جاري البحث عن خصم...'}
                </span>
                {myRoomCode && (
                  <div className="bg-slate-950 px-6 py-3 rounded-xl text-3xl font-mono font-black tracking-widest text-indigo-400">
                    {myRoomCode}
                  </div>
                )}
              </div>
              <button
                onClick={() => window.location.reload()}
                className="text-slate-500 hover:text-slate-300 text-sm font-medium"
              >
                إلغاء
              </button>
            </div>
          ) : menuMode === 'main' ? (
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <button
                onClick={findMatch}
                className="relative overflow-hidden group w-full bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all duration-200 rounded-2xl p-4 font-bold text-lg flex items-center justify-center gap-3"
              >
                <Users className="w-6 h-6" />
                <span>لعب عشوائي</span>
              </button>
              
              <button
                onClick={createPrivate}
                className="w-full bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all duration-200 rounded-2xl p-4 font-bold text-lg flex items-center justify-center gap-3"
              >
                <Lock className="w-6 h-6 text-slate-400" />
                <span>إنشاء غرفة خاصة</span>
              </button>

              <button
                onClick={() => setMenuMode('join')}
                className="w-full bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all duration-200 rounded-2xl p-4 font-bold text-lg flex items-center justify-center gap-3"
              >
                <KeyRound className="w-6 h-6 text-slate-400" />
                <span>الانضمام لغرفة</span>
              </button>
            </div>
          ) : (
            <form onSubmit={joinPrivate} className="flex flex-col gap-4 w-full max-w-xs">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full flex flex-col items-center gap-4">
                <label className="text-slate-400 font-medium">أدخل رمز الغرفة (4 أرقام)</label>
                <input
                  type="text"
                  maxLength={4}
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-center text-3xl font-mono font-black tracking-widest text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  placeholder="0000"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={roomCode.length !== 4}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:active:scale-100 active:scale-95 transition-all duration-200 rounded-2xl p-4 font-bold text-lg flex items-center justify-center gap-3"
              >
                انضمام
              </button>
              <button
                type="button"
                onClick={() => setMenuMode('main')}
                className="text-slate-500 hover:text-slate-300 text-sm font-medium mt-2"
              >
                رجوع
              </button>
            </form>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="w-full h-[100dvh] max-w-md mx-auto bg-slate-950 text-slate-100 flex flex-col font-sans relative overflow-hidden" dir="rtl">
      {/* Header */}
      <header className="flex-none p-4 pb-2 flex items-center justify-between bg-slate-900/50 border-b border-slate-800/50 backdrop-blur-md z-10">
        <div className={cn("flex flex-col items-center px-4 py-2 rounded-xl transition-colors", myColor === 'blue' ? "bg-blue-500/20 text-blue-400" : "opacity-50")}>
          <span className="text-xs font-bold uppercase tracking-wider mb-1">أنت</span>
          <span className="text-2xl font-black">{gameState.scores[myColor!]}</span>
        </div>
        
        <div className="flex flex-col items-center justify-center">
          <span className="text-xs text-slate-500 font-medium mb-1">الدور</span>
          <div className={cn(
            "px-4 py-1 rounded-full text-sm font-bold transition-colors",
            gameState.turn === myColor 
              ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" 
              : "bg-slate-800 text-slate-400"
          )}>
            {gameState.turn === myColor ? 'دورك' : 'دور الخصم'}
          </div>
        </div>

        <div className={cn("flex flex-col items-center px-4 py-2 rounded-xl transition-colors", myColor !== 'blue' ? "bg-red-500/20 text-red-400" : "opacity-50")}>
          <span className="text-xs font-bold uppercase tracking-wider mb-1">الخصم</span>
          <span className="text-2xl font-black">{gameState.scores[myColor === 'blue' ? 'red' : 'blue']}</span>
        </div>
      </header>

      {/* Game Board */}
      <main className="flex-1 flex items-center justify-center p-2 sm:p-4 overflow-hidden relative z-0">
        <div className="w-full aspect-[7/10] max-h-full grid grid-cols-7 grid-rows-10 gap-1 sm:gap-1.5 p-2 bg-slate-900/80 rounded-2xl border border-slate-800/80 shadow-2xl">
          {gameState.board.map((row, y) => (
            row.map((cell, x) => {
              const isSelected = selectedPiece?.x === x && selectedPiece?.y === y;
              const isValidMove = validMoves.some(m => m.x === x && m.y === y);
              const isCloneMove = isValidMove && selectedPiece && Math.max(Math.abs(selectedPiece.x - x), Math.abs(selectedPiece.y - y)) === 1;
              
              return (
                <button
                  key={`${x}-${y}`}
                  onClick={() => handleCellClick(x, y)}
                  disabled={gameState.turn !== myColor || gameState.status !== 'playing'}
                  className={cn(
                    "relative w-full h-full rounded-lg sm:rounded-xl transition-all duration-200",
                    "flex items-center justify-center",
                    cell === null ? "bg-slate-800/40 hover:bg-slate-700/50" : "",
                    cell === 'blue' ? "bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]" : "",
                    cell === 'red' ? "bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]" : "",
                    isSelected ? "ring-4 ring-white/50 scale-95" : "",
                    isValidMove ? "ring-2 ring-indigo-400/50 bg-indigo-500/20 cursor-pointer" : "",
                    (gameState.turn !== myColor && cell === null) ? "cursor-default" : ""
                  )}
                >
                  {cell !== null && (
                    <motion.div 
                      layoutId={`piece-${x}-${y}`}
                      className="w-1/2 h-1/2 rounded-full bg-white/20"
                    />
                  )}
                  {isValidMove && (
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      isCloneMove ? "bg-green-400" : "bg-yellow-400"
                    )} />
                  )}
                </button>
              );
            })
          ))}
        </div>
      </main>

      {/* Instructions / Status */}
      <footer className="flex-none p-6 text-center bg-slate-900/50 border-t border-slate-800/50 z-10">
        <p className="text-sm text-slate-400 font-medium">
          {gameState.status === 'playing' 
            ? (gameState.turn === myColor 
                ? "اختر قطعة، ثم اختر مربعاً للتحرك (مسافة 1 للنسخ، 2 للقفز)" 
                : "انتظر دور الخصم...")
            : "انتهت اللعبة!"}
        </p>
      </footer>

      {/* Floating Chat Button */}
      {gameState.status === 'playing' && !isChatOpen && (
        <button
          onClick={() => setIsChatOpen(true)}
          className="absolute bottom-20 left-4 z-20 bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all p-4 rounded-full shadow-xl shadow-indigo-900/50 flex items-center justify-center"
        >
          <MessageCircle className="w-6 h-6 text-white" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center border-2 border-slate-950">
              {unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Chat Drawer */}
      <AnimatePresence>
        {isChatOpen && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute inset-x-0 bottom-0 z-40 bg-slate-900 border-t border-slate-800 rounded-t-3xl h-[60vh] flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.5)]"
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-indigo-400" />
                المحادثة
              </h3>
              <button 
                onClick={() => setIsChatOpen(false)}
                className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
              {chatMessages.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
                  لا توجد رسائل بعد. قل مرحباً!
                </div>
              ) : (
                chatMessages.map((msg) => {
                  const isMe = msg.sender === myColor;
                  return (
                    <div key={msg.id} className={cn("flex flex-col max-w-[80%]", isMe ? "self-end items-end" : "self-start items-start")}>
                      <span className="text-[10px] text-slate-500 mb-1 px-1">
                        {isMe ? 'أنت' : 'الخصم'}
                      </span>
                      <div className={cn(
                        "px-4 py-2 rounded-2xl text-sm",
                        isMe 
                          ? "bg-indigo-600 text-white rounded-tr-sm" 
                          : "bg-slate-800 text-slate-200 rounded-tl-sm"
                      )}>
                        {msg.text}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={sendChat} className="p-4 border-t border-slate-800 bg-slate-900/50 flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="اكتب رسالة..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              />
              <button
                type="submit"
                disabled={!chatInput.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:active:scale-100 active:scale-95 transition-all w-12 rounded-xl flex items-center justify-center"
              >
                <Send className="w-5 h-5 text-white" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Over Overlay */}
      <AnimatePresence>
        {gameState.status === 'finished' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-slate-900 border border-slate-800 p-8 rounded-3xl w-full max-w-sm flex flex-col items-center text-center shadow-2xl"
            >
              <div className={cn(
                "w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-2xl",
                gameState.winner === myColor ? "bg-green-500/20 text-green-400 shadow-green-500/20" : 
                gameState.winner === 'draw' ? "bg-slate-500/20 text-slate-400" : 
                "bg-red-500/20 text-red-400 shadow-red-500/20"
              )}>
                <Trophy className="w-10 h-10" />
              </div>
              
              <h2 className="text-3xl font-black mb-2">
                {gameState.winner === myColor ? 'لقد فزت!' : 
                 gameState.winner === 'draw' ? 'تعادل!' : 'لقد خسرت!'}
              </h2>
              
              <div className="flex items-center justify-center gap-6 my-8 w-full">
                <div className="text-center">
                  <div className="text-3xl font-black text-blue-400">{gameState.scores.blue}</div>
                  <div className="text-xs text-slate-500 uppercase mt-1">أزرق</div>
                </div>
                <div className="w-px h-12 bg-slate-800"></div>
                <div className="text-center">
                  <div className="text-3xl font-black text-red-400">{gameState.scores.red}</div>
                  <div className="text-xs text-slate-500 uppercase mt-1">أحمر</div>
                </div>
              </div>

              <button
                onClick={() => {
                  setGameState(null);
                  setMenuMode('main');
                }}
                className="w-full bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all rounded-xl p-4 font-bold text-lg"
              >
                العودة للقائمة الرئيسية
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

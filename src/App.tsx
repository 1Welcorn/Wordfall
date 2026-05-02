import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Timer, Volume2, VolumeX, Play, RotateCcw } from 'lucide-react';
import { VOCABULARY_GROUPS, VocabularyWord, CATEGORY_TRANSLATIONS } from './vocabulary';

type GameStatus = 'MENU' | 'PLAYING' | 'GAMEOVER';

type ActiveWord = {
  id: string;
  en: string;
  normalizedEn: string;
  dari: string;
  pt: string;
  emoji: string;
  x: number; // percentage width
  duration: number; // fall duration in ms
  spawnTime: number; 
};

type Explosion = {
  id: string;
  x: number; // vw
  y: number; // px from top
  score: number;
  word: string;
  emoji: string;
};

const normalizeWord = (w: string) => w.split(/[:\/]/)[0].trim().toLowerCase();

export default function App() {
  const [selectedCategory, setSelectedCategory] = useState<string>(Object.keys(VOCABULARY_GROUPS)[0]);
  const [status, setStatus] = useState<GameStatus>('MENU');
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(90);
  const [activeWords, setActiveWords] = useState<ActiveWord[]>([]);
  const [explosions, setExplosions] = useState<Explosion[]>([]);
  
  const [inputValue, setInputValue] = useState('');
  const [shake, setShake] = useState(false);
  const [flashRed, setFlashRed] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const [playerName, setPlayerName] = useState('');
  const [scoreSaved, setScoreSaved] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const timeouts = useRef<Record<string, number>>({});
  const spawnTimerRef = useRef<number>(0);
  const gameTimerRef = useRef<number>(0);
  const scoreRef = useRef(0);
  const lastLaneRef = useRef<number>(-1);

  // High Scores (Mocked local storage as Supabase integration proxy)
  const [highScores, setHighScores] = useState<{username: string, score: number}[]>([]);

  useEffect(() => { scoreRef.current = score; }, [score]);

  // Keep input focused
  useEffect(() => {
    if (status !== 'PLAYING') return;
    const interval = setInterval(() => {
      if (document.activeElement !== inputRef.current) {
        inputRef.current?.focus();
      }
    }, 500);
    return () => clearInterval(interval);
  }, [status]);

  const speakWord = useCallback((word: string) => {
    if (!soundEnabled || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'en-US';
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
  }, [soundEnabled]);

  const handleMiss = useCallback((id: string) => {
    setActiveWords(prev => prev.filter(w => w.id !== id));
    setCombo(0);
    setFlashRed(true);
    setTimeout(() => setFlashRed(false), 200);
    // Shake input a bit for overall feedback
    setShake(true);
    setTimeout(() => setShake(false), 400);
  }, []);

  const spawnWord = useCallback(() => {
    const lanes = [10, 25, 50, 75, 90];
    let laneIdx;
    do {
      laneIdx = Math.floor(Math.random() * lanes.length);
    } while (laneIdx === lastLaneRef.current);
    lastLaneRef.current = laneIdx;
    
    // Pick random vocabulary from selected category
    const words = VOCABULARY_GROUPS[selectedCategory] || Object.values(VOCABULARY_GROUPS).flat();
    const wordTemplate = words[Math.floor(Math.random() * words.length)];
    const id = crypto.randomUUID();
    
    // Begin very slow for absolute beginners (e.g., 25 seconds to fall)
    const baseDuration = 25000;
    // Gradual difficulty curve based on score (e.g. at 500 score, subtract 500*8 = 4000ms -> 21s)
    const duration = Math.max(7000, baseDuration - (scoreRef.current * 8));

    const newWord: ActiveWord = {
      id,
      en: wordTemplate.en,
      normalizedEn: normalizeWord(wordTemplate.en),
      dari: wordTemplate.dari,
      pt: wordTemplate.pt,
      emoji: wordTemplate.emoji,
      x: lanes[laneIdx],
      duration,
      spawnTime: Date.now()
    };

    setActiveWords(prev => [...prev, newWord]);
    speakWord(newWord.normalizedEn);

    const tid = window.setTimeout(() => handleMiss(id), duration);
    timeouts.current[id] = tid;
  }, [handleMiss, speakWord, selectedCategory]);

  useEffect(() => {
    if (status !== 'PLAYING') return;

    const loop = () => {
      spawnWord();
      const currentScore = scoreRef.current;
      // Start with a longer interval (6 seconds) between words
      const currentInterval = Math.max(1200, 5000 - (currentScore * 5));
      spawnTimerRef.current = window.setTimeout(loop, currentInterval);
    };

    spawnTimerRef.current = window.setTimeout(loop, 1000);

    return () => clearTimeout(spawnTimerRef.current);
  }, [status, spawnWord]);

  const addExplosion = (x: number, y: number, pts: number, emoji: string, word: string) => {
    const id = crypto.randomUUID();
    setExplosions(prev => [...prev, { id, x, y, score: pts, emoji, word }]);
    setTimeout(() => {
      setExplosions(prev => prev.filter(e => e.id !== id));
    }, 1000);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (status !== 'PLAYING') return;

    const typed = e.target.value.toLowerCase();
    setInputValue(typed);

    if (typed === '') return;

    // Check exact match
    const matchIndex = activeWords.findIndex(w => w.normalizedEn === typed);
    if (matchIndex !== -1) {
      const matched = activeWords[matchIndex];
      clearTimeout(timeouts.current[matched.id]);

      // Calculate approximate position for explosion
      const elapsed = Date.now() - matched.spawnTime;
      const progress = Math.min(1, elapsed / matched.duration);
      const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
      const yOfWord = -150 + progress * (windowHeight + 150);

      const points = 10 * (combo + 1); // Combo logic: 10 * (current length + 1)
      setScore(s => s + points);
      setCombo(c => {
        setMaxCombo(prev => Math.max(prev, c + 1));
        return c + 1;
      });

      addExplosion(matched.x, yOfWord, points, matched.emoji, matched.normalizedEn);

      setActiveWords(prev => prev.filter(w => w.id !== matched.id));
      setInputValue('');
      return;
    }

    // Check prefix validity
    const isValidPrefix = activeWords.some(w => w.normalizedEn.startsWith(typed));
    if (!isValidPrefix && typed.length > 0) {
      setShake(true);
      setTimeout(() => setShake(false), 400);
      setCombo(0); // Optional: penalty on typing completely wrong, but let's just break combo
    }
  };

  const startGame = (category?: string) => {
    const cat = category && typeof category === 'string' ? category : selectedCategory;
    setSelectedCategory(cat);
    
    // Stop previous state
    Object.values(timeouts.current).forEach(clearTimeout);
    clearTimeout(spawnTimerRef.current);
    clearInterval(gameTimerRef.current);

    // Initial state
    setStatus('PLAYING');
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setTimeLeft(90);
    setActiveWords([]);
    setExplosions([]);
    setInputValue('');
    setScoreSaved(false);
    setPlayerName('');

    // Start Loops
    
    // Main timer
    gameTimerRef.current = window.setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          endGame();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const endGame = () => {
    setStatus('GAMEOVER');
    clearInterval(gameTimerRef.current);
    clearTimeout(spawnTimerRef.current);
    Object.values(timeouts.current).forEach(clearTimeout);
    timeouts.current = {};
  };

  const saveScore = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (scoreSaved) return;
    
    try {
      const nameToSave = playerName.trim() || 'Jogador';
      const saved = JSON.parse(localStorage.getItem('wordfall_scores') || '[]');
      const updated = [...saved, { username: nameToSave, score: scoreRef.current }];
      updated.sort((a,b) => b.score - a.score);
      const top3 = updated.slice(0, 3);
      localStorage.setItem('wordfall_scores', JSON.stringify(top3));
      setHighScores(top3);
      setScoreSaved(true);
    } catch {
      // ignore
    }
  };

  // Load Highscores on mount
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('wordfall_scores') || '[]');
      setHighScores(saved.slice(0, 3)); // show top 3 in menu
    } catch {
      // ignore
    }
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-[100dvh] w-full bg-slate-900 overflow-hidden relative font-sans select-none" style={{ backgroundImage: 'radial-gradient(circle at center, #1e1b4b 0%, #0f172a 100%)' }}>
      
      {/* HUD overlays */}
      <div className="absolute top-0 left-0 w-full p-4 md:p-6 z-50 flex justify-between items-center pointer-events-none">
        <div className="flex gap-4 md:gap-8 items-center pt-2 pl-2">
          <div className="bg-slate-800/80 backdrop-blur-md rounded-xl p-3 border border-slate-700 shadow-xl flex items-center gap-3">
            <Trophy className="text-yellow-400" size={24} />
            <span className="text-white text-2xl font-bold font-mono">{score.toLocaleString()}</span>
          </div>
          <div className="bg-slate-800/80 backdrop-blur-md rounded-xl p-3 border border-slate-700 shadow-xl flex items-center gap-3">
             <span className="text-orange-400 font-bold text-xl uppercase tracking-widest text-shadow">Combo x{combo}</span>
          </div>
        </div>

        <div className="flex gap-4 items-center">
          <button 
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="pointer-events-auto bg-slate-800/80 hover:bg-slate-700 p-3 rounded-xl border border-slate-700 text-white transition-colors"
          >
            {soundEnabled ? <Volume2 size={24} /> : <VolumeX size={24} />}
          </button>
          
          <div className={`bg-slate-800/80 backdrop-blur-md rounded-xl p-3 border border-slate-700 shadow-xl flex items-center gap-3 ${timeLeft <= 10 ? 'animate-pulse bg-red-900/50' : ''}`}>
            <Timer className={timeLeft <= 10 ? "text-red-400" : "text-blue-400"} size={24} />
            <span className={`text-2xl font-bold font-mono ${timeLeft <= 10 ? 'text-red-400' : 'text-white'}`}>
              {formatTime(timeLeft)}
            </span>
          </div>
        </div>
      </div>

      {/* Screen Flash */}
      <AnimatePresence>
        {flashRed && (
          <motion.div 
            className="pointer-events-none fixed inset-0 z-40 bg-red-600/30 mix-blend-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
        )}
      </AnimatePresence>

      {/* Main Game Area */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        <AnimatePresence>
          {activeWords.map(word => {
            const destY = typeof window !== 'undefined' ? window.innerHeight : 1000;
            return (
              <motion.div
                key={word.id}
                initial={{ y: -150, left: `${word.x}%`, x: "-50%" }}
                animate={{ y: destY }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ 
                  y: { duration: word.duration / 1000, ease: 'linear' },
                  exit: { duration: 0.2 }
                }}
                className="absolute flex flex-col items-center bg-slate-800/60 backdrop-blur-md border-[2px] border-slate-600/50 p-4 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] whitespace-nowrap"
              >
                <div className="flex gap-4 items-center justify-center mb-1 w-full border-b border-slate-600/50 pb-2">
                  <span className="text-xl font-bold text-amber-400" dir="rtl">{word.dari}</span>
                  <span className="text-slate-500">|</span>
                  <span className="text-sm font-semibold text-emerald-300 uppercase tracking-wide">{word.pt}</span>
                </div>
                <div className="text-5xl my-2 drop-shadow-lg">{word.emoji}</div>
                <div className="text-lg font-mono font-bold text-white tracking-widest">{word.en}</div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Explosions */}
      {explosions.map(exp => (
        <motion.div 
          key={exp.id} 
          className="absolute pointer-events-none select-none z-30 flex items-center justify-center flex-col"
          initial={{ left: `${exp.x}%`, x: "-50%", y: exp.y, scale: 0.5, opacity: 1 }}
          animate={{ scale: [1, 2.5, 3], opacity: [1, 1, 0] }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <div className="absolute w-32 h-32 bg-green-500 rounded-full blur-2xl opacity-40 mix-blend-screen" />
          <span className="relative z-10 text-5xl drop-shadow-xl">{exp.emoji}</span>
          <span className="text-green-400 font-bold text-2xl drop-shadow-md mt-2">+{exp.score}</span>
        </motion.div>
      ))}

      {/* Input Field */}
      <div className="absolute bottom-8 left-0 w-full z-50 flex justify-center px-4">
        <motion.div className="w-full max-w-xl" animate={shake ? { x: [-8, 8, -8, 8, 0] } : {}} transition={{ duration: 0.4 }}>
          <input 
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setInputValue('');
                setCombo(0); // Break combo on enter if it didn't auto-match
              }
            }}
            disabled={status !== 'PLAYING'}
            className={`w-full text-center text-3xl md:text-5xl p-4 md:p-6 bg-slate-800/90 backdrop-blur-xl rounded-3xl border-[3px] 
              ${shake ? 'border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.6)] text-red-100' : 'border-indigo-500/50 text-white focus:border-green-400 focus:shadow-[0_0_40px_rgba(74,222,128,0.4)]'}
              outline-none transition-all duration-200 placeholder-slate-500 font-mono tracking-widest`}
            placeholder={status === 'PLAYING' ? "D I G I T E . . ." : ""}
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
          />
          <div className={`absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500/50 text-xl font-bold transition-opacity ${inputValue ? 'opacity-0' : 'opacity-100'}`} dir="rtl">
            تایپ کنید...
          </div>
        </motion.div>
      </div>

      {/* Menu Overlays */}
      <AnimatePresence>
        {status === 'MENU' && (
          <motion.div 
            className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <div className="bg-slate-800 border border-slate-700 p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-lg w-full mx-4 max-h-[90vh]">
              <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-indigo-400 to-cyan-400 mb-2">WordFall</h1>
              <div className="text-slate-400 mb-6 text-center">
                <p>Jogo de Digitação: Inglês & Dari</p>
                <p dir="rtl" className="text-indigo-300 text-sm mb-1">بازی تایپ: انگلیسی و دری</p>
                <p>Digite as palavras antes que caiam!</p>
                <p dir="rtl" className="text-indigo-300 text-sm">کلمات را قبل از افتادن تایپ کنید!</p>
              </div>
              
              <div className="w-full mb-6 overflow-y-auto pr-2 flex-grow" style={{scrollbarWidth: 'thin'}}>
                <div className="sticky top-0 bg-slate-800 pb-2 z-10 mb-3 text-center">
                  <h3 className="text-slate-400 text-sm font-bold uppercase tracking-wider">Escolha a Categoria</h3>
                  <h3 dir="rtl" className="text-indigo-300/80 text-xs mt-1">یک دسته بندی انتخاب کنید</h3>
                </div>
                <div className="flex flex-col gap-2">
                  {Object.keys(VOCABULARY_GROUPS).map(cat => (
                    <button
                      key={cat}
                      onClick={() => startGame(cat)}
                      className="w-full py-3 px-5 bg-slate-700/50 hover:bg-indigo-600/80 text-white rounded-xl text-left font-medium transition-all border border-transparent hover:border-indigo-400 hover:shadow-lg hover:-translate-y-0.5 relative group flex items-center justify-between"
                    >
                      <div className="flex flex-col flex-1">
                        <span>{cat}</span>
                        <span className="text-xs text-indigo-300/80 mt-0.5 font-bold" dir="rtl">{CATEGORY_TRANSLATIONS[cat]}</span>
                      </div>
                      <Play size={18} className="opacity-0 group-hover:opacity-100 text-indigo-200 transition-opacity" />
                    </button>
                  ))}
                </div>
              </div>

              {highScores.length > 0 && (
                <div className="w-full bg-slate-800/80 pt-4 border-t border-slate-700">
                  <div className="text-center mb-3">
                    <h3 className="text-slate-500 text-sm font-bold uppercase tracking-wider">Recordes Locais</h3>
                    <h3 dir="rtl" className="text-indigo-400/60 text-xs mt-1">بهترین امتیازات</h3>
                  </div>
                  <div className="flex flex-col gap-2">
                    {highScores.map((hs, i) => (
                      <div key={i} className="flex justify-between bg-slate-700/50 rounded-lg p-2 px-4 shadow-inner">
                        <span className="text-slate-300">#{i+1} {hs.username}</span>
                        <span className="text-indigo-300 font-mono font-bold">{hs.score.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {status === 'GAMEOVER' && (
          <motion.div 
            className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-md"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <div className="bg-slate-800 border border-slate-700 p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-md w-full mx-4">
              <h2 className="text-4xl font-black text-white mb-1 uppercase tracking-widest text-shadow text-center">Fim de Jogo!</h2>
              <h3 dir="rtl" className="text-xl text-indigo-300 font-bold mb-2">پایان بازی!</h3>
              
              <div className="flex flex-col items-center my-6 p-6 bg-slate-900 rounded-2xl w-full border border-slate-700 relative overflow-hidden">
                {score > (highScores[0]?.score || 0) && score > 0 && (
                  <motion.div 
                    initial={{ y: -50, opacity: 0 }} 
                    animate={{ y: 0, opacity: 1 }} 
                    className="absolute top-0 left-0 w-full bg-emerald-500/20 text-emerald-300 py-2 text-center font-bold text-xs uppercase tracking-widest flex flex-col gap-1"
                  >
                    <span>🎉 NOVO RECORDE PESSOAL! 🎉</span>
                    <span dir="rtl" className="text-[10px]">رکورد جدید!</span>
                  </motion.div>
                )}
                
                <div className={`flex flex-col items-center ${score > (highScores[0]?.score || 0) && score > 0 ? 'mt-6' : ''}`}>
                  <span className="text-slate-400 uppercase tracking-widest font-bold text-sm mb-1">Pontuação Final</span>
                  <span dir="rtl" className="text-indigo-400/70 text-xs mb-3">امتیاز نهایی</span>
                </div>
                
                <span className="text-6xl font-mono font-bold text-yellow-400">{score.toLocaleString()}</span>
                
                <div className="mt-4 flex flex-col items-center text-orange-300 font-bold uppercase text-sm">
                  <span>Combo Máx: x{maxCombo}</span>
                  <span dir="rtl" className="text-[10px] opacity-80 mt-1">بیشترین کمبو</span>
                </div>
              </div>

              {!scoreSaved ? (
                <form onSubmit={saveScore} className="w-full mb-6">
                  <div className="text-center mb-4">
                    <p className="text-indigo-300 font-medium text-sm">Digite seu nome para o placar:</p>
                    <p className="text-indigo-300/80 font-medium text-xs mt-1" dir="rtl">نام خود را برای جدول امتیازات وارد کنید:</p>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-500 placeholder:text-sm"
                      placeholder="Seu nome / نام شما"
                      value={playerName}
                      onChange={e => setPlayerName(e.target.value)}
                      maxLength={15}
                      autoFocus
                    />
                    <button 
                      type="submit"
                      className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-bold transition-colors flex flex-col items-center justify-center gap-1"
                    >
                      <span>SALVAR</span>
                      <span dir="rtl" className="text-[10px] font-normal opacity-80">ثبت</span>
                    </button>
                  </div>
                </form>
              ) : (
                <div className="w-full mb-6">
                  <div className="text-center mb-3">
                    <h3 className="text-slate-500 text-sm font-bold uppercase tracking-wider">Recordes Locais</h3>
                    <h3 dir="rtl" className="text-indigo-400/60 text-xs mt-1">بهترین امتیازات</h3>
                  </div>
                  <div className="flex flex-col gap-2">
                    {highScores.map((hs, i) => (
                      <div key={i} className="flex justify-between bg-slate-700/50 rounded-lg p-2 px-4 shadow-inner">
                        <span className="text-slate-300">#{i+1} {hs.username}</span>
                        <span className="text-indigo-300 font-mono font-bold">{hs.score.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!scoreSaved && (!score || score <= (highScores[0]?.score || 0)) ? (
                 <div className="mb-6 text-center">
                   <p className="text-indigo-300 font-medium text-sm mb-2">
                     Você foi ótimo! Tente jogar novamente para bater o seu recorde de <span className="font-bold text-white">{highScores[0]?.score?.toLocaleString() || 0}</span> pontos!
                   </p>
                   <p dir="rtl" className="text-indigo-300/80 text-xs">
                     شما عالی بودید! برای شکستن رکورد خود دوباره بازی کنید!
                   </p>
                 </div>
              ) : null}
              
              <button 
                onClick={() => startGame()}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-emerald-500/30"
              >
                <RotateCcw /> 
                <div className="flex flex-col items-start leading-tight">
                  <span>JOGAR NOVAMENTE</span>
                  <span dir="rtl" className="text-[10px] text-emerald-100 font-normal">دوباره بازی کنید</span>
                </div>
              </button>

              <button 
                onClick={() => setStatus('MENU')}
                className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-transform hover:scale-[1.02] active:scale-[0.98] mt-3 border border-slate-600"
              >
                <div className="flex flex-col items-center leading-tight">
                  <span>VOLTAR AO MENU</span>
                  <span dir="rtl" className="text-[10px] text-slate-300 font-normal mt-0.5">بازگشت به منو</span>
                </div>
              </button>

              <div className="mt-6 w-full text-center">
                 <p className="text-xs text-slate-500 mb-2 border-t border-slate-700 pt-4">Placar Global (Futuro)</p>
                 <div className="flex justify-between bg-slate-700/50 rounded-lg p-2 px-4 shadow-inner mt-2">
                    <span className="text-slate-300 flex flex-col items-start leading-tight">
                      <span>Sua Pontuação</span>
                      <span dir="rtl" className="text-[10px] text-slate-400 mt-0.5">امتیاز شما</span>
                    </span>
                    <span className="text-indigo-300 font-mono font-bold flex items-center">{score.toLocaleString()}</span>
                 </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

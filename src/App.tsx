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
    utterance.pitch = 1.0;

    // Try to find a natural-sounding voice (Google US English usually sounds good on Chrome, Alex is okay on Mac)
    const voices = window.speechSynthesis.getVoices();
    const goodVoices = voices.filter(v => 
      v.lang.startsWith('en') && 
      !v.name.toLowerCase().includes('robot') && 
      !v.name.toLowerCase().includes('novelty')
    );
    // Find a specific good one if available
    const bestVoice = goodVoices.find(v => v.name.includes('Google US English')) || goodVoices[0];
    if (bestVoice) {
      utterance.voice = bestVoice;
    }

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
      const saved = JSON.parse(localStorage.getItem('wordfall_scores_kids') || '[]');
      const updated = [...saved, { username: nameToSave, score: scoreRef.current }];
      updated.sort((a,b) => b.score - a.score);
      const top3 = updated.slice(0, 3);
      localStorage.setItem('wordfall_scores_kids', JSON.stringify(top3));
      setHighScores(top3);
      setScoreSaved(true);
    } catch {
      // ignore
    }
  };

  // Load Highscores on mount
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('wordfall_scores_kids') || '[]');
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
    <div className="h-[100dvh] w-full bg-sky-200 overflow-hidden relative font-sans select-none" style={{ backgroundImage: 'radial-gradient(circle at top, #e0f2fe 0%, #7dd3fc 100%)' }}>
      
      {/* HUD overlays */}
      <div className="absolute top-0 left-0 w-full p-4 md:p-6 z-50 flex justify-between items-center pointer-events-none">
        <div className="flex gap-2 md:gap-4 items-center pt-2 pl-2">
          <div className="bg-white/90 backdrop-blur-md rounded-full px-5 py-2 md:px-6 md:py-3 border-4 border-white shadow-[0_4px_15px_rgba(3,105,161,0.2)] flex items-center gap-2 md:gap-3">
            <Trophy className="text-orange-400" size={28} />
            <span className="text-sky-900 text-3xl font-black font-sans">{score.toLocaleString()}</span>
          </div>
          {combo > 1 && (
            <div className="bg-orange-400 rounded-full px-4 py-2 border-b-4 border-orange-600 shadow-lg flex items-center animate-bounce-slight">
               <span className="text-white font-black text-xl md:text-2xl tracking-wide">Combo x{combo}!</span>
            </div>
          )}
        </div>

        <div className="flex gap-2 md:gap-4 items-center">
          <button 
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="pointer-events-auto bg-white/90 hover:bg-white p-3 md:p-4 rounded-full border-4 border-white shadow-[0_4px_15px_rgba(3,105,161,0.2)] text-sky-600 transition-transform hover:scale-105 active:scale-95"
          >
            {soundEnabled ? <Volume2 size={28} /> : <VolumeX size={28} />}
          </button>
          
          <div className={`bg-white/90 backdrop-blur-md rounded-full px-5 py-2 md:px-6 md:py-3 border-4 border-white shadow-[0_4px_15px_rgba(3,105,161,0.2)] flex items-center gap-2 md:gap-3 ${timeLeft <= 10 ? 'animate-pulse bg-red-100 border-red-300' : ''}`}>
            <Timer className={timeLeft <= 10 ? "text-red-500" : "text-sky-500"} size={28} />
            <span className={`text-3xl font-black font-sans ${timeLeft <= 10 ? 'text-red-500' : 'text-sky-900'}`}>
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
                className="absolute flex flex-col items-center bg-white border-b-[6px] border-sky-200/60 p-4 md:p-6 rounded-[2rem] shadow-xl whitespace-nowrap"
              >
                <div className="flex gap-3 items-center justify-center mb-2 w-full border-b-[3px] border-sky-100 pb-2">
                  <span className="text-xl md:text-2xl font-black text-amber-500 drop-shadow-sm" dir="rtl">{word.dari}</span>
                  <span className="text-sky-300 font-bold">|</span>
                  <span className="text-base md:text-lg font-black text-emerald-500 uppercase tracking-widest">{word.pt}</span>
                </div>
                <div className="text-6xl md:text-7xl my-2 drop-shadow-xl animate-bounce-slight" style={{ animationDelay: `${Math.random()}s` }}>{word.emoji}</div>
                <div className="text-2xl md:text-3xl font-black text-sky-900 tracking-wide">{word.en}</div>
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
            className={`w-full text-center text-3xl md:text-5xl p-4 md:p-6 bg-white rounded-[3rem] border-b-[8px] 
              ${shake ? 'border-red-400 shadow-[0_0_30px_rgba(248,113,113,0.6)] text-red-500' : 'border-sky-300 text-sky-900 focus:border-green-400 focus:shadow-[0_0_40px_rgba(74,222,128,0.6)]'}
              outline-none transition-all duration-200 placeholder-sky-200 font-bold tracking-wider`}
            placeholder={status === 'PLAYING' ? "D I G I T E . . ." : ""}
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
          />
          <div className={`absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-sky-200 text-2xl font-black transition-opacity ${inputValue ? 'opacity-0' : 'opacity-100'}`} dir="rtl">
            تایپ کنید...
          </div>
        </motion.div>
      </div>

      {/* Menu Overlays */}
      <AnimatePresence>
        {status === 'MENU' && (
          <motion.div 
            className="absolute inset-0 z-50 flex items-center justify-center bg-sky-900/40 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <div className="bg-white border-b-8 border-sky-200 p-6 md:p-10 rounded-[3rem] shadow-2xl flex flex-col items-center max-w-lg w-full mx-4 max-h-[90vh]">
              <h1 className="text-6xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-br from-pink-400 to-orange-400 mb-2 drop-shadow-sm">WordFall</h1>
              <div className="text-sky-600 mb-6 text-center font-bold">
                <p className="text-lg">Jogo de Digitação: Inglês & Dari</p>
                <p dir="rtl" className="text-sky-400 text-sm mb-1">بازی تایپ: انگلیسی و دری</p>
                <p className="text-lg">Digite as palavras antes que caiam!</p>
                <p dir="rtl" className="text-sky-400 text-sm">کلمات را قبل از افتادن تایپ کنید!</p>
              </div>
              
              <div className="w-full mb-6 overflow-y-auto pr-2 flex-grow" style={{scrollbarWidth: 'thin'}}>
                <div className="sticky top-0 bg-white pb-2 z-10 mb-3 text-center">
                  <h3 className="text-sky-400 text-sm font-black uppercase tracking-wider">Escolha a Categoria</h3>
                  <h3 dir="rtl" className="text-sky-300 text-xs mt-1 font-bold">یک دسته بندی انتخاب کنید</h3>
                </div>
                <div className="flex flex-col gap-3">
                  {Object.keys(VOCABULARY_GROUPS).map(cat => (
                    <button
                      key={cat}
                      onClick={() => startGame(cat)}
                      className="w-full py-4 px-6 bg-sky-100 hover:bg-sky-200 text-sky-800 rounded-[2rem] border-b-4 border-sky-300 hover:border-sky-400 text-left font-black text-lg transition-transform hover:-translate-y-1 active:translate-y-0 relative group flex items-center justify-between shadow-sm"
                    >
                      <div className="flex flex-col flex-1">
                        <span>{cat}</span>
                        <span className="text-sm text-sky-500 mt-0.5 font-bold" dir="rtl">{CATEGORY_TRANSLATIONS[cat]}</span>
                      </div>
                      <Play size={24} className="text-pink-400 scale-125 transition-transform group-hover:scale-150 group-hover:rotate-12" fill="currentColor" />
                    </button>
                  ))}
                </div>
              </div>

              {highScores.length > 0 && (
                <div className="w-full bg-slate-50 rounded-3xl p-4 border-2 border-slate-100">
                  <div className="text-center mb-3">
                    <h3 className="text-orange-400 text-sm font-black uppercase tracking-wider">Top Pontuações</h3>
                    <h3 dir="rtl" className="text-orange-300 text-xs mt-1 font-bold">بهترین امتیازات</h3>
                  </div>
                  <div className="flex flex-col gap-2">
                    {highScores.map((hs, i) => (
                      <div key={i} className="flex justify-between bg-white rounded-2xl p-3 px-5 shadow-sm border border-slate-100">
                        <span className="text-sky-800 font-bold">#{i+1} {hs.username}</span>
                        <span className="text-pink-500 font-black">{hs.score.toLocaleString()}</span>
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
            className="absolute inset-0 z-50 flex items-center justify-center bg-sky-900/60 backdrop-blur-md"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <div className="bg-white border-b-8 border-sky-300 p-8 rounded-[3rem] shadow-2xl flex flex-col items-center max-w-md w-full mx-4">
              <h2 className="text-5xl font-black text-pink-500 mb-1 uppercase tracking-widest text-center">Fim de Jogo!</h2>
              <h3 dir="rtl" className="text-xl text-sky-400 font-black mb-2">پایان بازی!</h3>
              
              <div className="flex flex-col items-center my-6 p-6 bg-amber-50 rounded-[2rem] w-full border-4 border-amber-200 relative overflow-hidden">
                {score > (highScores[0]?.score || 0) && score > 0 && (
                  <motion.div 
                    initial={{ y: -50, opacity: 0 }} 
                    animate={{ y: 0, opacity: 1 }} 
                    className="absolute top-0 left-0 w-full bg-green-400 text-white py-2 text-center font-black text-sm uppercase tracking-widest flex flex-col gap-1 shadow-sm"
                  >
                    <span>🎉 NOVO RECORDE! 🎉</span>
                    <span dir="rtl" className="text-[10px]">رکورد جدید!</span>
                  </motion.div>
                )}
                
                <div className={`flex flex-col items-center ${score > (highScores[0]?.score || 0) && score > 0 ? 'mt-6' : ''}`}>
                  <span className="text-amber-600 uppercase tracking-widest font-black text-sm mb-1">Sua Pontuação</span>
                  <span dir="rtl" className="text-amber-500/70 text-xs mb-3 font-bold">امتیاز نهایی</span>
                </div>
                
                <span className="text-7xl font-black text-orange-500 drop-shadow-sm">{score.toLocaleString()}</span>
                
                <div className="mt-4 flex flex-col items-center text-amber-500 font-bold uppercase text-sm">
                  <span>Combo Máximo: x{maxCombo}</span>
                  <span dir="rtl" className="text-xs opacity-80 mt-1">بیشترین کمبو</span>
                </div>
              </div>

              {!scoreSaved ? (
                <form onSubmit={saveScore} className="w-full mb-6">
                  <div className="text-center mb-4">
                    <p className="text-sky-600 font-bold text-base">Qual é o seu nome?</p>
                    <p className="text-sky-500 font-bold text-xs mt-1" dir="rtl">نام خود را برای جدول امتیازات وارد کنید:</p>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 bg-white border-4 border-sky-200 rounded-[2rem] px-5 py-3 text-sky-900 font-bold text-lg focus:outline-none focus:border-sky-400 transition-colors placeholder:text-sky-300"
                      placeholder="Seu nome"
                      value={playerName}
                      onChange={e => setPlayerName(e.target.value)}
                      maxLength={15}
                      autoFocus
                    />
                    <button 
                      type="submit"
                      className="bg-green-400 hover:bg-green-500 text-white px-6 py-3 rounded-[2rem] border-b-4 border-green-600 font-black transition-colors flex flex-col items-center justify-center gap-1 shadow-sm"
                    >
                      <span className="text-lg">SALVAR</span>
                      <span dir="rtl" className="text-xs font-bold opacity-90">ثبت</span>
                    </button>
                  </div>
                </form>
              ) : (
                <div className="w-full mb-6 bg-slate-50 rounded-[2rem] p-4 border-2 border-slate-100">
                  <div className="text-center mb-3">
                    <h3 className="text-orange-400 text-sm font-black uppercase tracking-wider">Top Pontuações</h3>
                    <h3 dir="rtl" className="text-orange-300 text-xs mt-1 font-bold">بهترین امتیازات</h3>
                  </div>
                  <div className="flex flex-col gap-2">
                    {highScores.map((hs, i) => (
                      <div key={i} className="flex justify-between bg-white rounded-xl p-3 px-5 shadow-sm border border-slate-100">
                        <span className="text-sky-800 font-bold">#{i+1} {hs.username}</span>
                        <span className="text-pink-500 font-black">{hs.score.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!scoreSaved && (!score || score <= (highScores[0]?.score || 0)) ? (
                 <div className="mb-6 text-center bg-sky-50 border-2 border-sky-100 rounded-2xl p-3 w-full">
                   <p className="text-sky-700 font-bold text-sm mb-2">
                     Você foi ótimo! Tente jogar novamente para bater o seu recorde de <span className="font-black text-pink-500">{highScores[0]?.score?.toLocaleString() || 0}</span> pontos!
                   </p>
                   <p dir="rtl" className="text-sky-500 text-xs font-bold">
                     شما عالی بودید! برای شکستن رکورد خود دوباره بازی کنید!
                   </p>
                 </div>
              ) : null}
              
              <button 
                onClick={() => startGame()}
                className="w-full py-4 bg-orange-400 hover:bg-orange-500 text-white rounded-[2rem] border-b-4 border-orange-600 font-black text-xl flex items-center justify-center gap-3 transition-transform hover:-translate-y-1 active:translate-y-0 shadow-lg"
              >
                <Play size={28} fill="currentColor" /> 
                <div className="flex flex-col items-start leading-tight">
                  <span>JOGAR NOVAMENTE</span>
                  <span dir="rtl" className="text-[12px] text-orange-100 font-bold">دوباره بازی کنید</span>
                </div>
              </button>

              <button 
                onClick={() => setStatus('MENU')}
                className="w-full py-3 bg-sky-100 hover:bg-sky-200 text-sky-700 rounded-[2rem] border-b-4 border-sky-300 font-black text-lg flex items-center justify-center gap-3 transition-transform hover:-translate-y-1 active:translate-y-0 mt-4"
              >
                <div className="flex flex-col items-center leading-tight">
                  <span>VOLTAR AO MENU</span>
                  <span dir="rtl" className="text-[12px] text-sky-500 font-bold mt-0.5">بازگشت به منو</span>
                </div>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

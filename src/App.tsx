import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Moon, Star, RefreshCw, LogIn, LogOut, Bookmark, Archive, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { getRandomCard, ORACLE_CARDS, CARD_MEANINGS } from './lib/cards';
import { generateReading, generateCardImage, generateDeepCardMeaning, generateSpeech, playPCM, initAudio, stopAudio, playTTSStream } from './services/ai';
import { MysticLoader } from './components/MysticLoader';
import { auth, signInWithGoogle, logOut, saveReadingToArchive, getSavedReadings } from './services/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

// --- Background Component ---
const StarsBackground = () => {
  const [stars, setStars] = useState<{ id: number; left: string; top: string; size: string; duration: string; opacity: number }[]>([]);

  useEffect(() => {
    const newStars = Array.from({ length: 50 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}vw`,
      top: `${Math.random() * 100}vh`,
      size: `${Math.random() * 2 + 1}px`,
      duration: `${Math.random() * 3 + 2}s`,
      opacity: Math.random() * 0.5 + 0.3,
    }));
    setStars(newStars);
  }, []);

  return (
    <div className="stars">
      {stars.map((star) => (
        <div
          key={star.id}
          className="star"
          style={{
            left: star.left,
            top: star.top,
            width: star.size,
            height: star.size,
            '--twinkle-duration': star.duration,
            '--max-opacity': star.opacity,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
};

// --- App Component ---
type Step = 'onboarding' | 'deck' | 'reading' | 'collection';

export default function App() {
  const [step, setStep] = useState<Step>('onboarding');
  const [onboardingPhase, setOnboardingPhase] = useState<0 | 1 | 2>(0);
  const [readingMode, setReadingMode] = useState<'single' | 'three'>('single');
  const [userName, setUserName] = useState('');
  const [drawnCards, setDrawnCards] = useState<string[]>([]);
  const [reading, setReading] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isFormHovered, setIsFormHovered] = useState(false);
  const [backgroundUrl, setBackgroundUrl] = useState('https://i.ibb.co/23fbnhw6/Cassandra.png');
  const [welcomeAudioData, setWelcomeAudioData] = useState<string | null>(null);
  const [hoverAudioData, setHoverAudioData] = useState<string | null>(null);
  const [hasPlayedHoverAudio, setHasPlayedHoverAudio] = useState(false);

  const WELCOME_MSG = "De kaarten hebben geen voorkeur voor je geluk of je verdriet, ze kennen alleen de waarheid. Welkom zoeker. Het universum heeft speciaal voor jou een boodschap. Vertel me je naam, zodat we de verbinding kunnen maken.";
  const HOVER_MSG = "Start de sessie.";

  useEffect(() => {
    generateSpeech(WELCOME_MSG).then(data => {
      if(data) setWelcomeAudioData(data);
    });
    generateSpeech(HOVER_MSG).then(data => {
      if(data) setHoverAudioData(data);
    });
  }, []);

  const [expandedCards, setExpandedCards] = useState<Record<string, string>>({});
  const [loadingCards, setLoadingCards] = useState<Record<string, boolean>>({});
  const [focusedCollectionCard, setFocusedCollectionCard] = useState<string | null>(null);
  const [flippedCardIndex, setFlippedCardIndex] = useState<number | null>(null);
  
  // Firebase Auth State
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [savedReadings, setSavedReadings] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
      if (currentUser && !userName) {
        setUserName(currentUser.displayName?.split(' ')[0] || 'Zoeker');
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user && step === 'collection') {
      loadSavedReadings();
    }
  }, [user, step]);

  const loadSavedReadings = async () => {
    if (user) {
      const readings = await getSavedReadings(user.uid);
      setSavedReadings(readings);
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        console.error("Login faalde", err);
      }
    }
  };

  const handleSaveReading = async () => {
    if (!user) {
      await handleLogin();
      // Returns right after login attempt. Will need them to click save again.
      return;
    }
    if (isSaving || saveSuccess) return;

    setIsSaving(true);
    try {
      await saveReadingToArchive(user.uid, drawnCards.join(" • "), reading);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Fout bij opslaan", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFormMouseEnter = () => {
    setIsFormHovered(true);
    if (!hasPlayedHoverAudio && hoverAudioData && !isPlayingAudio) {
      initAudio();
      playPCM(hoverAudioData);
      setHasPlayedHoverAudio(true);
    }
  };

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    initAudio();
    if (userName.trim().length > 0) {
      setOnboardingPhase(2);
      playTTSStream(`Welkom ${userName}. Voel je een specifieke vraag branden, of zoek je algemene sturing? Kies voor een enkele kaart, of een diepe trekking met drie kaarten.`);
    }
  };

  const startSession = async () => {
    initAudio();
    setOnboardingPhase(1);
    if (welcomeAudioData) {
      playPCM(welcomeAudioData);
    } else {
      playTTSStream(WELCOME_MSG);
    }
  };

  const drawCard = async () => {
    setFlippedCardIndex(null);
    let selectedCards: string[] = [];
    if (readingMode === 'single') {
      selectedCards = [getRandomCard()];
    } else {
      let availableCards = [...ORACLE_CARDS];
      for (let i = 0; i < 3; i++) {
        const randIdx = Math.floor(Math.random() * availableCards.length);
        selectedCards.push(availableCards[randIdx]);
        availableCards.splice(randIdx, 1);
      }
    }
    
    setDrawnCards(selectedCards);
    setStep('reading');
    setIsLoading(true);
    setReading('');
    setImageUrls([]);

    try {
      setLoadingText('De geesten raadplegen...');
      const promises: Promise<any>[] = [generateReading(userName, selectedCards, readingMode)];
      selectedCards.forEach(card => promises.push(generateCardImage(card)));
      
      const results = await Promise.all(promises);
      setReading(results[0]);
      setImageUrls(results.slice(1));
    } catch (error) {
      console.error(error);
      setReading("De verbinding met het spirituele rijk werd verbroken... Sluit je ogen en probeer het later opnieuw.");
      setImageUrls(selectedCards.map(c => `https://picsum.photos/seed/${encodeURIComponent(c)}/600/800/?blur=4`));
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    stopAudio();
    setIsPlayingAudio(false);
    setStep('deck');
    setDrawnCards([]);
    setReading('');
    setImageUrls([]);
  };

  const goHome = () => {
    stopAudio();
    setIsPlayingAudio(false);
    setStep('onboarding');
    setOnboardingPhase(0);
    setUserName('');
    setDrawnCards([]);
    setReading('');
    setImageUrls([]);
  };

  const goToCollection = () => {
    stopAudio();
    setIsPlayingAudio(false);
    setStep('collection');
    setFocusedCollectionCard(null);
  };

  const goToCardInCollection = async () => {
    stopAudio();
    setIsPlayingAudio(false);
    setStep('collection');
    if (drawnCards.length === 1) {
      setFocusedCollectionCard(drawnCards[0]);
      if (!expandedCards[drawnCards[0]]) {
        handleExpandCard(drawnCards[0]);
      }
      setTimeout(() => {
        const cardElement = document.getElementById(`card-${drawnCards[0]}`);
        if (cardElement) {
          cardElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    } else {
      setFocusedCollectionCard(null);
    }
  };

  const handleExpandCard = async (card: string) => {
    if (expandedCards[card] || loadingCards[card]) return;
    
    setLoadingCards(prev => ({ ...prev, [card]: true }));
    try {
      const deepMeaning = await generateDeepCardMeaning(card, CARD_MEANINGS[card]);
      setExpandedCards(prev => ({ ...prev, [card]: deepMeaning }));
    } catch (e) {
      setExpandedCards(prev => ({ ...prev, [card]: 'De kronieken zijn momenteel gesloten...' }));
    } finally {
      setLoadingCards(prev => ({ ...prev, [card]: false }));
    }
  };

  const formatDeepText = (text: string) => {
    return text.split('**').map((chunk, i) => 
      i % 2 !== 0 
        ? <strong key={i} className="text-yellow-500 block mt-4 mb-1 font-sans text-xs uppercase tracking-widest">{chunk}</strong> 
        : <span key={i} className="text-[#e0d7f2]/80">{chunk}</span>
    );
  };

  const handleToggleAudio = async () => {
    if (isPlayingAudio || isAudioLoading) {
      stopAudio();
      setIsPlayingAudio(false);
      setIsAudioLoading(false);
      return;
    }
    
    setIsAudioLoading(true);
    initAudio();
    
    playTTSStream(
      reading,
      () => {
        setIsAudioLoading(false);
        setIsPlayingAudio(true);
      },
      () => {
        setIsPlayingAudio(false);
        setIsAudioLoading(false);
      }
    );
  };

  // Changing loading text over time
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isLoading) {
      const texts = ['De geesten raadplegen...', 'Aura analyseren...', 'Afbeelding manifesteren...', 'Kosmische energie bundelen...'];
      let i = 0;
      interval = setInterval(() => {
        i = (i + 1) % texts.length;
        setLoadingText(texts[i]);
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  // Dynamically resolve ibb.co background image to support URL switching
  useEffect(() => {
    const fetchDynamicBackground = async () => {
      try {
        // Try multiple proxies in case one is blocked by browser extensions or fails
        const proxyUrls = [
          `https://corsproxy.io/?${encodeURIComponent('https://ibb.co/RTV5vb1S')}`,
          `https://api.allorigins.win/get?url=${encodeURIComponent('https://ibb.co/RTV5vb1S')}`
        ];

        for (const url of proxyUrls) {
          try {
            const response = await fetch(url);
            if (!response.ok) continue;

            const textData = await response.text();
            // AllOrigins returns JSON containing a "contents" string, CorsProxy returns raw HTML
            const htmlContent = url.includes('allorigins') ? JSON.parse(textData).contents : textData;

            if (htmlContent) {
              const match = htmlContent.match(/<meta property="og:image"\s+content="([^"]+)"/);
              if (match && match[1]) {
                setBackgroundUrl(match[1]);
                return; // Stop if successful
              }
            }
          } catch (e) {
            // Silently fail this specific proxy and try the next one
            continue;
          }
        }
        console.warn("Kon dynamische achtergrond via proxies niet ophalen, blijf bij fallback.");
      } catch (err) {
        console.error("Kon dynamische achtergrond niet ophalen, val terug op initieel:", err);
      }
    };
    
    fetchDynamicBackground();
  }, []);

  return (
    <div className="w-full min-h-screen bg-[#0d071a] text-[#e0d7f2] font-serif relative overflow-hidden flex flex-col">
      {/* Cassandra Background Image */}
      <div 
        className={`absolute inset-0 pointer-events-none transition-all duration-1000 ${
          step === 'onboarding' 
            ? (isFormHovered ? 'opacity-10 z-0 mix-blend-luminosity' : 'opacity-40 z-30 mix-blend-screen') 
            : 'opacity-20 z-0 mix-blend-luminosity'
        }`}
        style={{
          backgroundImage: `url("${backgroundUrl}")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          maskImage: 'linear-gradient(to bottom, transparent, black 10%, black 90%, transparent)'
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0d071a]/80 via-transparent to-[#0d071a] pointer-events-none z-0"></div>

      <StarsBackground />

      {/* Theme Decorative Background Overlays */}
      <div className="absolute inset-0 opacity-40 pointer-events-none z-0">
        <div className="absolute top-10 left-20 w-1 h-1 bg-white rounded-full animate-pulse"></div>
        <div className="absolute top-40 right-32 w-1 h-1 bg-white rounded-full"></div>
        <div className="absolute bottom-20 left-1/4 w-1.5 h-1.5 bg-yellow-200 rounded-full"></div>
        <div className="absolute top-1/2 right-1/4 w-0.5 h-0.5 bg-blue-200 rounded-full"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,_rgba(110,50,255,0.15),transparent_60%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,_rgba(255,180,50,0.05),transparent_50%)]"></div>
      </div>
      <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-purple-900/20 blur-[100px] rounded-full pointer-events-none"></div>
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-yellow-900/10 blur-[120px] rounded-full pointer-events-none"></div>

      {/* Navigation Bar */}
      <nav className="relative z-10 flex justify-between items-center px-6 md:px-12 py-6 md:py-8">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={goHome}>
          <div className="w-8 h-8 flex items-center justify-center transition-transform group-hover:scale-110">
            <svg viewBox="0 0 24 24" width="24" height="24" className="text-yellow-500 drop-shadow-[0_0_10px_rgba(234,179,8,0.8)] group-hover:text-yellow-400 group-hover:drop-shadow-[0_0_15px_rgba(250,204,21,1)] transition-all" fill="currentColor">
              <path d="M12 2L16 10L12 22L8 10L12 2Z" opacity="0.8"/>
              <path d="M12 2L16 10L22 10L16 14L12 22L8 14L2 10L8 10L12 2Z" fillOpacity="0.4" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>
              <path d="M12 2L14 10L12 22L10 10L12 2Z" fill="white" opacity="0.4"/>
            </svg>
          </div>
          <span className="text-lg md:text-xl font-serif text-yellow-500/80 group-hover:text-yellow-400 transition-colors">Madame Baba Yulya</span>
        </div>
        <div className="hidden md:flex gap-8 text-[11px] uppercase tracking-widest text-[#e0d7f2]/50 font-sans">
          <span 
            className={`pb-1 cursor-pointer transition-colors ${step !== 'collection' && step !== 'onboarding' ? 'border-b border-yellow-500 text-yellow-500' : 'hover:text-white'}`}
            onClick={() => userName ? setStep('deck') : setStep('onboarding')}
          >
            De Reading
          </span>
          <span 
            className={`pb-1 cursor-pointer transition-colors ${step === 'collection' ? 'border-b border-yellow-500 text-yellow-500' : 'hover:text-white'}`}
            onClick={goToCollection}
          >
            Mijn Kaarten
          </span>
          {user ? (
            <span className="cursor-pointer hover:text-white transition-colors flex items-center gap-2 text-yellow-500/80" onClick={logOut}>
              <LogOut size={14} /> Archief Sluiten
            </span>
          ) : (
            <span className="cursor-pointer hover:text-white transition-colors flex items-center gap-2" onClick={handleLogin}>
              <svg viewBox="0 0 24 24" width="16" height="16" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google Login
            </span>
          )}
        </div>
      </nav>

      <main className={`relative z-10 w-full flex-grow flex ${step === 'collection' ? 'items-start pt-12' : 'items-center'} justify-center px-6 md:px-16 pb-24 top-[-2%]`}>
        <div className="w-full max-w-5xl">
          <AnimatePresence mode="wait">
            
            {/* STEP 1: Onboarding */}
            {step === 'onboarding' && (
              <motion.div 
                key="onboarding"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.8 }}
                className="w-full max-w-lg mx-auto relative z-10"
              >
                <div 
                  className={`text-center w-full rounded-2xl p-10 border border-white/10 shadow-2xl transition-all duration-700 ease-out relative ${
                    isFormHovered 
                      ? 'opacity-100 blur-none scale-100 z-40 bg-[#0d071a]/80 backdrop-blur-xl shadow-[0_0_40px_rgba(0,0,0,0.8)]' 
                      : 'opacity-60 blur-[2px] scale-95 z-10 bg-white/5 backdrop-blur-md'
                  }`}
                  onMouseEnter={handleFormMouseEnter}
                  onMouseLeave={() => setIsFormHovered(false)}
                >
                  <div className={`absolute -top-10 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.3em] font-sans text-yellow-500/80 transition-opacity duration-500 pointer-events-none whitespace-nowrap ${isFormHovered ? 'opacity-0' : 'opacity-100'}`}>
                    Beweeg hier om in te vullen
                  </div>
                  <div className="flex justify-center mb-6 text-yellow-500/80">
                    <Moon size={40} strokeWidth={1} />
                  </div>
                  <h1 className="text-4xl md:text-5xl font-light text-white mb-2 tracking-wide">
                    Madame Baba <span className="italic font-serif text-yellow-500">Yulya</span>
                  </h1>
                  <p className="text-yellow-500/60 uppercase tracking-widest text-sm mb-6">De Stem van het Schaduwlicht</p>
                {onboardingPhase === 0 ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-6 mt-4">
                    <p className="text-[#cbbce6] text-lg mb-8 font-serif italic leading-relaxed">
                      Zet je geluid aan en treed binnen in het de Akasha kronieken voor een persoonlijke legging.
                    </p>
                    <button 
                      onClick={startSession}
                      className="mt-4 px-8 py-4 bg-gradient-to-r from-yellow-600 to-yellow-700 text-black font-sans font-bold uppercase tracking-widest text-xs rounded-full shadow-[0_10px_30px_rgba(180,120,0,0.3)] hover:scale-105 transition-transform mx-auto flex items-center justify-center gap-3"
                    >
                      <span>Start de Sessie</span>
                    </button>
                  </motion.div>
                ) : onboardingPhase === 1 ? (
                  <>
                    <p className="text-[#cbbce6] text-lg mb-8 font-serif italic leading-relaxed">
                      "De kaarten hebben geen voorkeur voor je geluk of je verdriet, ze kennen alleen de waarheid."<br/><br/>
                      Welkom zoeker. Het universum heeft speciaal voor jou een boodschap. Vertel me je (voor)naam, zodat we de verbinding kunnen maken.
                    </p>
                    
                    <form onSubmit={handleStart} className="flex flex-col gap-6">
                      <input 
                        type="text" 
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        placeholder="Jouw voornaam..." 
                        className="bg-[#1a1133]/50 border-b border-yellow-500/30 focus:border-yellow-500 text-center text-xl text-white py-4 px-6 rounded-none outline-none transition-all placeholder:text-white/20 font-serif italic"
                        required
                      />
                      <button 
                        type="submit"
                        disabled={!userName.trim()}
                        className="mt-4 px-8 py-4 bg-gradient-to-r from-yellow-600 to-yellow-700 text-black font-sans font-bold uppercase tracking-widest text-xs rounded-full shadow-[0_10px_30px_rgba(180,120,0,0.3)] hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed mx-auto flex items-center justify-center gap-3"
                      >
                        <span>Volgende</span>
                      </button>
                    </form>
                  </>
                ) : (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-6 mt-4">
                    <p className="text-[#cbbce6] text-lg mb-4 font-serif italic leading-relaxed">
                      Welkom {userName}. Voel je een specifieke vraag branden, of zoek je algemene sturing?
                    </p>
                    <button 
                      onClick={(e) => { e.preventDefault(); setReadingMode('single'); setStep('deck'); }} 
                      className="px-6 py-5 border border-yellow-500/30 hover:border-yellow-500 hover:bg-yellow-500/10 text-white font-serif rounded-xl flex items-center justify-between transition-all group"
                    >
                      <div className="text-left">
                        <h3 className="text-xl text-yellow-500 mb-1">Dagelijkse Reflectie</h3>
                        <p className="text-sm text-[#cbbce6]">Trek 1 Orakelkaart voor een helder inzicht.</p>
                      </div>
                      <Star size={24} className="text-yellow-500/50 group-hover:text-yellow-500 group-hover:scale-110 transition-all flex-shrink-0" />
                    </button>
                    <button 
                      onClick={(e) => { e.preventDefault(); setReadingMode('three'); setStep('deck'); }} 
                      className="px-6 py-5 border border-yellow-500/30 hover:border-yellow-500 hover:bg-yellow-500/10 text-white font-serif rounded-xl flex items-center justify-between transition-all group"
                    >
                      <div className="text-left">
                        <h3 className="text-xl text-yellow-500 mb-1">Verleden, Heden & Toekomst</h3>
                        <p className="text-sm text-[#cbbce6]">Trek 3 kaarten voor een diepe verhaallijn.</p>
                      </div>
                      <div className="flex gap-1 text-yellow-500/50 group-hover:text-yellow-500 group-hover:scale-110 transition-all flex-shrink-0">
                        <Star size={16} /><Star size={20} /><Star size={16} />
                      </div>
                    </button>
                  </motion.div>
                )}
                </div>
              </motion.div>
            )}

            {/* STEP 2: Draw a Card */}
            {step === 'deck' && (
              <motion.div 
                key="deck"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
                transition={{ duration: 0.8 }}
                className="text-center flex flex-col items-center"
              >
                <p className="text-yellow-500/70 italic text-xl mb-2">Welkom, {userName}...</p>
                <h1 className="text-4xl md:text-5xl font-light leading-tight text-white mb-12">
                  Het Universum wacht <br/>
                  <span className="italic font-serif text-yellow-500">op je keuze.</span>
                </h1>
                
                <button 
                  onClick={drawCard}
                  className="relative group animate-float cursor-pointer perspective-[1000px]"
                >
                  {/* Glowing aura */}
                  <div className="absolute inset-0 bg-yellow-500/20 blur-2xl rounded-2xl group-hover:bg-yellow-500/30 transition-all duration-500"></div>
                  
                  {/* The mystical deck stack */}
                  <div className="w-64 h-96 relative aspect-[2/3] rounded-2xl border-2 border-yellow-600/30 bg-[#1a1133] shadow-[0_0_50px_rgba(88,28,135,0.4)] overflow-hidden flex flex-col items-center justify-center transform transition-transform group-hover:scale-105 group-active:scale-95 duration-300">
                    <div className="absolute inset-0 bg-gradient-to-b from-[#2d1b4e] to-[#0d071a]"></div>
                    <div className="absolute inset-x-0 inset-y-0 opacity-30 flex items-center justify-center">
                      <Star size={120} className="text-yellow-500/50" />
                    </div>
                    <div className="absolute inset-2 border border-yellow-600/10 pointer-events-none rounded-xl"></div>
                    <Sparkles size={32} className="text-yellow-500 mb-4 relative z-10" />
                    <span className="relative z-10 text-xl font-sans text-yellow-500 font-bold uppercase tracking-[0.2em] text-center px-4">
                      Trek {readingMode === 'single' ? 'een Orakelkaart' : 'Je Kaarten'}
                    </span>
                  </div>
                </button>
              </motion.div>
            )}

            {/* STEP 3: Reading */}
            {step === 'reading' && (
              <motion.div 
                key="reading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1 }}
                className={`w-full flex flex-col ${readingMode === 'single' ? 'md:flex-row items-center md:items-start' : 'items-center'} gap-12 max-w-5xl mx-auto`}
              >
                {/* 3D Card Flipping Component (Left Side or Top) */}
                <div className={`card-container w-full ${readingMode === 'single' ? 'md:w-1/3 max-w-[320px]' : 'flex flex-col md:flex-row items-center justify-center gap-6 max-w-5xl md:px-0'} perspective-[1000px] flex-shrink-0 mx-auto`}>
                  
                  {drawnCards.length > 0 ? drawnCards.map((card, idx) => (
                    <div key={idx} className={`flex flex-col items-center ${readingMode === 'single' ? 'w-full' : 'w-56 md:w-64'}`}>
                      <motion.div 
                        initial={{ rotateY: 0 }}
                        animate={{ 
                           rotateY: isLoading ? [0, 180, 360] : 
                                    readingMode === 'single' ? 180 : 
                                    (flippedCardIndex === idx ? 180 : 0) 
                        }}
                        transition={
                          isLoading 
                          ? { duration: 2, repeat: Infinity, ease: "linear", delay: idx * 0.2 } 
                          : { duration: 0.8, ease: "easeInOut" }
                        }
                        className={`card-inner w-full relative aspect-[2/3] ${readingMode === 'three' && !isLoading ? 'cursor-pointer hover:scale-105 transition-transform group' : ''}`}
                        onClick={() => {
                          if (!isLoading && readingMode === 'three') {
                            setFlippedCardIndex(idx);
                          }
                        }}
                        style={{ transformStyle: "preserve-3d" }}
                      >
                        {/* Front of card */}
                        <div className="card-front absolute w-full h-full rounded-2xl border-2 border-yellow-600/30 bg-[#1a1133] shadow-[0_0_50px_rgba(88,28,135,0.4)] overflow-hidden flex flex-col items-center justify-center">
                          <div className="absolute inset-0 bg-gradient-to-b from-[#2d1b4e] to-[#0d071a]"></div>
                          <Star size={80} className="text-yellow-500/20 relative z-10" />
                          {readingMode === 'three' && !isLoading && (
                            <span className="text-[10px] uppercase tracking-widest text-yellow-500/60 mt-6 relative z-10 group-hover:text-yellow-500 transition-colors">
                              Klik om te openen
                            </span>
                          )}
                          <div className="absolute inset-2 border border-yellow-600/10 pointer-events-none rounded-xl"></div>
                        </div>
                        
                        {/* Back of card (Revealed) */}
                        <div className="card-back absolute w-full h-full rounded-2xl border-2 border-yellow-600/30 bg-[#1a1133] shadow-[0_0_50px_rgba(88,28,135,0.4)] overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-b from-[#2d1b4e] to-[#0d071a]"></div>
                          {!isLoading && imageUrls[idx] && (
                            <img 
                              src={imageUrls[idx]} 
                              alt={card} 
                              className="absolute inset-0 w-full h-full object-cover z-10 opacity-80" 
                              referrerPolicy="no-referrer"
                            />
                          )}
                          <div className="absolute inset-2 border border-yellow-600/20 pointer-events-none rounded-xl z-30"></div>
                        </div>
                      </motion.div>
                      {readingMode === 'three' && (
                        <h3 className="text-yellow-500 font-serif text-lg md:text-xl mt-4 relative z-20">
                          {idx === 0 ? 'Het Verleden' : idx === 1 ? 'Het Heden' : 'De Toekomst'}
                        </h3>
                      )}
                    </div>
                  )) : (
                    <div className="card-inner w-full relative aspect-[2/3] md:w-1/3 max-w-[320px] mx-auto rounded-2xl border-2 border-yellow-600/30 bg-[#1a1133] overflow-hidden flex items-center justify-center">
                       <Star size={80} className="text-yellow-500/20 animate-pulse" />
                    </div>
                  )}
                </div>

                {/* Message Panel (Right Side or Bottom) */}
                <div className={`w-full ${readingMode === 'single' ? 'md:w-2/3' : 'max-w-4xl mt-8'} flex flex-col justify-center`}>
                  {isLoading ? (
                    <motion.div 
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="loading-animation flex flex-col items-center justify-center pt-12"
                    >
                      <MysticLoader text={loadingText} />
                    </motion.div>
                  ) : (
                    <motion.div 
                      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5, duration: 0.8 }}
                    >
                      <div className="mb-8 text-center md:text-left">
                        <p className="text-yellow-500/70 italic text-lg mb-2">Welkom terug, {userName}...</p>
                        <h1 className="text-4xl md:text-5xl font-light leading-tight text-white mb-6">
                          Het Universum fluistert <br/>
                          <span className="italic font-serif text-yellow-500">een boodschap.</span>
                        </h1>
                        <div className="w-24 h-[1px] bg-gradient-to-r from-yellow-500 to-transparent mb-8 mx-auto md:mx-0"></div>
                      </div>

                      <div className="bg-white/5 backdrop-blur-md rounded-2xl p-8 pt-14 md:pt-12 border border-white/10 shadow-2xl relative text-center md:text-left mt-4">
                        <div className="absolute top-4 right-4 md:right-6">
                          <button 
                            onClick={handleToggleAudio}
                            disabled={isAudioLoading}
                            className={`px-4 py-2.5 border font-sans uppercase tracking-widest text-[11px] font-medium rounded-full transition-all flex items-center justify-center gap-2 shadow-lg backdrop-blur-md ${isPlayingAudio ? 'border-yellow-500 text-yellow-300 bg-yellow-500/20 shadow-[0_0_20px_rgba(234,179,8,0.4)]' : 'border-yellow-500/40 text-yellow-500 bg-yellow-500/10 hover:bg-yellow-500/20 hover:border-yellow-500/80 hover:text-yellow-400 hover:shadow-[0_0_15px_rgba(234,179,8,0.3)]'}`}
                          >
                            {isAudioLoading ? (
                               <><Loader2 size={14} className="animate-spin" /> Laden...</>
                            ) : isPlayingAudio ? (
                               <><VolumeX size={14} /> Stop Voorlezen</>
                            ) : (
                               <><Volume2 size={14} /> Lees Voor</>
                            )}
                          </button>
                        </div>
                        <div className="absolute -top-6 -left-4 text-6xl text-yellow-500 opacity-30 font-serif hidden md:block">"</div>
                        <div className="text-xl md:text-[1.1rem] leading-relaxed text-[#cbbce6] italic whitespace-pre-wrap">
                          {reading}
                        </div>
                        <div className="mt-8 flex items-center justify-center md:justify-end gap-2 cursor-pointer group" onClick={goToCardInCollection}>
                          <span className="text-[10px] uppercase tracking-[0.2em] text-yellow-500/60 font-sans group-hover:text-yellow-500 transition-colors">
                            {readingMode === 'single' ? 'Ontsluier de diepere waarheid van dit visioen' : 'Raadpleeg de oude kronieken voor deze verschijningen'}
                          </span>
                          <div className="w-1 h-1 bg-yellow-500 rounded-full group-hover:scale-150 transition-transform"></div>
                        </div>
                      </div>

                      <div className="mt-12 flex flex-col sm:flex-row shadow shadow-yellow-900/10 items-center justify-center md:justify-start gap-4 flex-wrap">
                        <button 
                          onClick={reset}
                          className="px-6 py-4 bg-gradient-to-r from-yellow-600 to-yellow-700 text-black font-sans font-bold uppercase tracking-widest text-xs rounded-full shadow-[0_10px_30px_rgba(180,120,0,0.3)] hover:scale-105 transition-transform"
                        >
                          Nieuwe Kaart
                        </button>
                        <button 
                          onClick={handleSaveReading}
                          disabled={isSaving || saveSuccess}
                          className={`px-6 py-4 border hover:bg-white/5 font-sans uppercase tracking-widest text-xs rounded-full transition-all flex items-center justify-center gap-3 ${saveSuccess ? 'border-green-500 text-green-400' : 'border-white/20 text-white/80'}`}
                        >
                          <Archive size={16} className={saveSuccess ? "text-green-400" : ""} />
                          {isSaving ? 'Bezig met opslaan...' : saveSuccess ? 'Archief!' : 'Bewaar Boodschap'}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}
            {/* STEP 4: Collection */}
            {step === 'collection' && (
              <motion.div 
                key="collection"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.6 }}
                className="w-full h-[70vh] overflow-y-auto pr-2 custom-scrollbar custom-scrollbar-track custom-scrollbar-thumb"
              >
                <div className="mb-12 text-center relative">
                  <button 
                    onClick={goHome}
                    className="md:absolute left-0 top-1/2 md:-translate-y-1/2 mb-8 md:mb-0 mx-auto flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-yellow-500/60 hover:text-yellow-400 font-sans transition-colors"
                  >
                    <span className="text-lg">←</span> Naar startscherm
                  </button>
                  <Moon size={40} className="text-yellow-500/80 mx-auto mb-4" />
                  <h1 className="text-4xl md:text-5xl font-light text-white mb-4">
                    De Grote <span className="italic font-serif text-yellow-500">Arcana & Spirits</span>
                  </h1>
                  <p className="text-[#cbbce6] text-lg font-serif italic max-w-2xl mx-auto">
                    Blader door de 64 mystieke orakelkaarten van Madame Baba Yulya en verdiep je in hun ware, diepere betekenis.
                  </p>
                </div>

                {user && (
                  <div className="mb-16">
                    <h2 className="text-2xl font-light text-white mb-6 flex items-center gap-3">
                      <Bookmark className="text-yellow-500" />
                      Jouw Persoonlijke Archief
                    </h2>
                    {savedReadings.length === 0 ? (
                      <p className="text-[#cbbce6] text-sm italic">Je hebt nog geen boodschappen bewaard in je archief. Trek een kaart en bewaar de uitleg!</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {savedReadings.map((saved) => (
                          <div key={saved.id} className="bg-gradient-to-br from-[#1a1133]/80 to-black/40 backdrop-blur-sm border border-yellow-500/30 rounded-2xl p-6 shadow-lg relative">
                            <span className="text-[10px] uppercase tracking-[0.2em] text-yellow-500 font-sans mb-3 flex items-center gap-2">
                              <Archive size={12} /> {saved.createdAt ? new Date(saved.createdAt.seconds * 1000).toLocaleDateString('nl-NL') : 'Zojuist'}
                            </span>
                            <h3 className="text-xl font-medium text-white mb-3">{saved.cardName}</h3>
                            <div className="text-[#cbbce6]/80 text-sm italic font-serif leading-relaxed line-clamp-5">"{saved.readingText}"</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                <h2 className="text-2xl font-light text-white mb-6 text-center md:text-left flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <span>{focusedCollectionCard ? 'Uitgebreide Verdieping' : 'Encyclopedie'}</span>
                  {focusedCollectionCard && (
                    <button 
                      onClick={() => setFocusedCollectionCard(null)}
                      className="px-6 py-2 border border-white/20 hover:bg-white/5 text-white/80 font-sans uppercase tracking-widest text-[10px] rounded-full transition-all"
                    >
                      Bekijk de volledige Encyclopedie (64 Kaarten)
                    </button>
                  )}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {(focusedCollectionCard ? [focusedCollectionCard] : ORACLE_CARDS).map((card) => {
                    const idx = ORACLE_CARDS.indexOf(card);
                    return (
                    <div 
                      key={card} 
                      id={`card-${card}`}
                      onClick={() => handleExpandCard(card)}
                      className={`bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all flex flex-col items-start text-left shadow-lg relative overflow-hidden group ${expandedCards[card] || loadingCards[card] ? 'md:col-span-2 lg:col-span-3 cursor-default' : 'cursor-pointer'}`}
                    >
                      <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                        <Star size={100} />
                      </div>
                      <span className="text-[10px] uppercase tracking-[0.2em] text-yellow-500/60 font-sans mb-3 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 block"></span> Card No. {idx + 1}
                      </span>
                      <h3 className="text-xl font-medium text-white mb-2">{card}</h3>
                      <p className="text-[#cbbce6] text-sm leading-relaxed italic z-10">{CARD_MEANINGS[card]}</p>
                      
                      <AnimatePresence>
                        {loadingCards[card] && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }} 
                            animate={{ opacity: 1, height: 'auto' }} 
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-6 w-full flex items-center gap-3 text-yellow-500/80 font-sans text-xs uppercase tracking-widest border-t border-white/10 pt-6"
                          >
                            <RefreshCw size={16} className="animate-spin" />
                            <span>Madame Baba Yulya doorzoekt de Akasha kronieken...</span>
                          </motion.div>
                        )}
                        {expandedCards[card] && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }} 
                            animate={{ opacity: 1, height: 'auto' }} 
                            className="mt-6 w-full text-sm leading-relaxed z-10 border-t border-white/10 pt-2"
                          >
                            {formatDeepText(expandedCards[card])}
                          </motion.div>
                        )}
                        {!expandedCards[card] && !loadingCards[card] && (
                          <div className="mt-4 text-[10px] uppercase tracking-widest text-yellow-500/40 group-hover:text-yellow-500/80 transition-colors font-sans flex items-center gap-2">
                            <span>Ontsluier de verborgen wijsheid</span>
                          </div>
                        )}
                      </AnimatePresence>
                    </div>
                  )})}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Bottom Status Bar */}
      <footer className="relative w-full px-6 md:px-12 py-4 md:py-6 flex justify-between items-center border-t border-white/5 bg-[#0d071a]/80 backdrop-blur-sm z-20 mt-auto">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full shadow-[0_0_8px_#4ade80]"></div>
            <span className="text-[10px] uppercase tracking-widest text-white/30 font-sans">Gemini API Verbonden</span>
          </div>
        </div>
        <div className="flex gap-6">
          <div className="text-[10px] uppercase tracking-widest text-white/30 font-sans">AI Studio Live</div>
        </div>
      </footer>
    </div>
  );
}


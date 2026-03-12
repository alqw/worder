'use client';
import * as React from 'react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Word, updateWordMastery } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Play, Volume2, XCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

type QuizMode = 'flashcard' | 'multiple_choice' | 'written' | 'audio';

interface SessionClientProps {
  initialWords: Word[];
  packId: string;
  mode: 'learn' | 'review';
  allWords: { word: string; translation: string }[];
  totalPackMastered: number;
  totalPackWords: number;
}
// True Fisher-Yates shuffle to guarantee randomness
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function SessionClient({ initialWords, packId, mode, allWords, totalPackMastered, totalPackWords }: SessionClientProps) {
  const [sessionBucket, setSessionBucket] = useState<Word[]>(initialWords);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [words, setWords] = useState<Word[]>(initialWords);
  const [sessionScores, setSessionScores] = useState<Record<string, number>>(
    initialWords.reduce((acc, w) => ({ ...acc, [w.id]: w.mastery_score }), {})
  );
  
  const [isFinished, setIsFinished] = useState(false);
  const [saving, setSaving] = useState(false);

  // Current Quiz State
  const [currentQuizMode, setCurrentQuizMode] = useState<QuizMode>('multiple_choice');
  const [answerInput, setAnswerInput] = useState('');
  const [showAnswerFeedback, setShowAnswerFeedback] = useState<'idle' | 'correct' | 'incorrect'>('idle');
  const [isFlashcardRevealed, setIsFlashcardRevealed] = useState(false);
  const [currentOptions, setCurrentOptions] = useState<string[]>([]);
  const [activeOptionIndex, setActiveOptionIndex] = useState<number | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Mastery-based quiz mode selection
  const setupNextWord = (index: number) => {
    const wordObj = words[index];
    if (!wordObj) return;

    // The sequence is tied directly to the mastery score of the specific word:
    // Score 0 -> Flashcard
    // Score 1 -> Multiple Choice
    // Score 2 -> Written Translation
    // Score 3 -> Audio Dictation
    // Score 4 -> Random 'Final Exam' mode to prove they really know it before reaching 5
    let sequenceMode: QuizMode = 'flashcard';
    const score = sessionScores[wordObj.id] ?? wordObj.mastery_score;

    if (score === 0) sequenceMode = 'flashcard';
    else if (score === 1) sequenceMode = 'multiple_choice';
    else if (score === 2) sequenceMode = 'written';
    else if (score === 3) sequenceMode = 'audio';
    else {
      const allModes: QuizMode[] = ['flashcard', 'multiple_choice', 'written', 'audio'];
      sequenceMode = allModes[Math.floor(Math.random() * allModes.length)];
    }
    
    setCurrentQuizMode(sequenceMode);
    setShowAnswerFeedback('idle');
    setAnswerInput('');
    setIsFlashcardRevealed(false);

    if (sequenceMode === 'multiple_choice') {
      const wrongAnswers = shuffleArray(
        allWords.map((w) => w.translation).filter((t) => t !== wordObj.translation)
      ).slice(0, 3);
      setCurrentOptions(shuffleArray([...wrongAnswers, wordObj.translation]));
    }
  };

  // Initialize first word mode and shuffle the starting array
  useEffect(() => {
    // Shuffle the initial words so the sequence of vocabulary being tested is randomized
    const shuffled = shuffleArray(initialWords);
    setWords(shuffled);
    setSessionBucket(shuffled);
    setCurrentIndex(0);
    // Use setTimeout so the state update above applies before setting up the word
    setTimeout(() => {
        setIsMounted(true);
    }, 0);
  }, []);

  // When 'words' updates in the above hook, this effect will trigger to set the quiz mode
  useEffect(() => {
      if (isMounted) {
          setupNextWord(currentIndex);
      }
  }, [currentIndex, isMounted, words]);

  const currentWord = words[currentIndex];
  const progressPercent = Math.round((currentIndex / initialWords.length) * 100);

  // Helper to check if a user input matches *any* part of a multi-word translation
  const checkPartialTranslation = (input: string, correctTranslation: string) => {
    const normalize = (s: string) => s.toLowerCase().trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
    const normalizedInput = normalize(input);
    if (!normalizedInput) return false;

    // Split the correct translation by commas, slashes, or spaces to get possible valid answers
    // Example: "bicycle, bike" -> ["bicycle", "bike"]
    const possibleAnswers = correctTranslation.split(/[\s,/]+/).map(normalize).filter(Boolean);
    
    // Check if the input exactly matches the full translation OR any of the individual words
    return normalize(correctTranslation) === normalizedInput || possibleAnswers.includes(normalizedInput);
  };

  const handleAnswer = (isCorrect: boolean) => {
    if (showAnswerFeedback !== 'idle') return; // Prevent double clicking

    const wId = currentWord.id;
    let newScore = sessionScores[wId];

    if (isCorrect) {
      newScore = Math.min(5, newScore + 1);
      setShowAnswerFeedback('correct');
    } else {
      newScore = Math.max(0, newScore - 1);
      setShowAnswerFeedback('incorrect');
    }

    setSessionScores((prev) => ({ ...prev, [wId]: newScore }));

    // Auto proceed after a short delay
    setTimeout(() => {
      if (currentIndex + 1 < words.length) {
        setCurrentIndex(currentIndex + 1);
        // setupNextWord is handled automatically by the useEffect watching currentIndex
      } else {
        finishSession();
      }
    }, 1500);
  };

  useEffect(() => {
    if (currentQuizMode === 'audio' && currentWord && showAnswerFeedback === 'idle') {
      speakAudio(currentWord.word);
    }
  }, [currentQuizMode, currentIndex, currentWord, showAnswerFeedback]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Flashcard hotkeys
      if (currentQuizMode === 'flashcard' && showAnswerFeedback === 'idle') {
        if (!isFlashcardRevealed && e.key === 'Enter') {
          e.preventDefault();
          setIsFlashcardRevealed(true);
        } else if (isFlashcardRevealed) {
          if (e.key === '1') {
            e.preventDefault();
            setActiveOptionIndex(0);
            handleAnswer(false);
            setTimeout(() => setActiveOptionIndex(null), 150);
          } else if (e.key === '2') {
            e.preventDefault();
            setActiveOptionIndex(1);
            handleAnswer(true);
            setTimeout(() => setActiveOptionIndex(null), 150);
          }
        }
      }

      // Multiple choice hotkeys
      if (currentQuizMode === 'multiple_choice' && showAnswerFeedback === 'idle') {
        const key = parseInt(e.key);
        if (key >= 1 && key <= currentOptions.length) {
          e.preventDefault();
          setActiveOptionIndex(key - 1);
          handleAnswer(currentOptions[key - 1] === currentWord.translation);
          setTimeout(() => setActiveOptionIndex(null), 150);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentQuizMode, showAnswerFeedback, currentOptions, currentWord, isFlashcardRevealed]);

  // Ensure input gets focused properly when mode changes
  useEffect(() => {
    if ((currentQuizMode === 'written' || currentQuizMode === 'audio') && showAnswerFeedback === 'idle') {
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 50); // slight delay to ensure DOM is ready and animations have started
    }
  }, [currentQuizMode, showAnswerFeedback, currentIndex]);

  const finishSession = async () => {
    setSaving(true);
    try {
      // Save all updated scores to DB
      const promises = sessionBucket.map(async (w) => {
        const score = sessionScores[w.id];
        if (score !== w.mastery_score) {
          await updateWordMastery(w.id, score);
          // Mutate the local object so bucket filter checks the new score
          w.mastery_score = score;
        }
      });
      await Promise.all(promises);

      // Check if all words in the current 10-word bucket are fully learned (score 5)
      const unlearnedInBucket = sessionBucket.filter(w => sessionScores[w.id] < 5);

      if (unlearnedInBucket.length > 0 && mode === 'learn') {
        // User hasn't finished this 10-word bucket. Repeat only the unlearned ones.
        toast.info(`Let's review the ${unlearnedInBucket.length} words you missed!`);
        // Shuffle the unlearned words so they don't appear in the exact same order
        const shuffledRemaining = shuffleArray(unlearnedInBucket);
        setWords(shuffledRemaining);
        setCurrentIndex(0);
        // setupNextWord is handled automatically by the useEffect watching `words` and `currentIndex`
      } else {
        // Bucket is completely learned, OR we're in review mode (where we just do 1 pass)
        toast.success('Awesome! Moving to the next set...');
        window.location.reload();
      }
    } catch (err) {
      toast.error('Failed to save progress.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const speakAudio = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      // Optional: attempt to guess lang or use a generic one, here we default to OS lang
      window.speechSynthesis.speak(utterance);
    } else {
      toast.error('Text-to-speech not supported in this browser.');
    }
  };

  // isFinished is intentionally removed as we auto-restart. Left just in case a blank state is needed.
  if (isFinished) return null;

  if (!currentWord || !isMounted) return null;

  // --- Quiz Renderers ---

  const renderMultipleChoice = () => {
    return (
      <div className="space-y-4">
        <h3 className="text-3xl font-bold text-center mb-8">{currentWord.word}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {currentOptions.map((opt, i) => {
            return (
              <Button
                key={i}
                variant="outline"
                className={`h-auto py-6 px-12 text-lg text-left transition-all hover:scale-105 active:scale-95 duration-200 relative break-words ${activeOptionIndex === i ? 'scale-95 bg-accent opacity-80' : ''}`}
                disabled={showAnswerFeedback !== 'idle'}
                onClick={() => handleAnswer(opt === currentWord.translation)}
              >
                <div className="absolute left-6 top-1/2 -translate-y-1/2 opacity-50 text-sm border rounded-sm w-6 h-6 flex items-center justify-center">
                  {i + 1}
                </div>
                <span>{opt}</span>
              </Button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderWritten = () => {
    const checkAnswer = (e: React.FormEvent) => {
      e.preventDefault();
      handleAnswer(checkPartialTranslation(answerInput, currentWord.translation));
    };

    return (
      <div className="space-y-6 text-center animate-in fade-in zoom-in-95 duration-300">
        <h3 className="text-3xl font-bold mb-8 animate-in slide-in-from-top-4">{currentWord.word}</h3>
        <form onSubmit={checkAnswer} className="space-y-4 max-w-sm mx-auto">
          <Input
            ref={inputRef}
            autoFocus
            placeholder="Type the translation..."
            className="text-center text-lg py-6 transition-all focus:scale-105 duration-200"
            value={answerInput}
            onChange={(e) => setAnswerInput(e.target.value)}
            disabled={showAnswerFeedback !== 'idle'}
          />
          <Button type="submit" className="w-full transition-transform hover:scale-105 active:scale-95 duration-200" disabled={!answerInput.trim() || showAnswerFeedback !== 'idle'}>
            Check Answer
          </Button>
        </form>
        {showAnswerFeedback !== 'idle' && (
          <div className="mt-4 text-lg">
            Correct translation: <span className="font-bold text-green-500">{currentWord.translation}</span>
          </div>
        )}
      </div>
    );
  };

  const renderFlashcard = () => {
    return (
      <div className="space-y-8 text-center animate-in fade-in zoom-in-95 duration-300">
        <h3 className="text-4xl font-extrabold animate-in slide-in-from-top-4">{currentWord.word}</h3>
        
        {!isFlashcardRevealed ? (
          <Button size="lg" onClick={() => setIsFlashcardRevealed(true)} variant="secondary" className="w-full max-w-sm transition-transform hover:scale-105 active:scale-95 duration-200">
            Show Translation
          </Button>
        ) : (
          <div className="space-y-6 animate-in slide-in-from-bottom-6 fade-in duration-500">
            <h4 className="text-2xl font-medium text-primary">{currentWord.translation}</h4>
            <div className="flex gap-4 justify-center">
              <div className="flex flex-col items-center gap-2">
                <Button size="lg" variant="destructive" onClick={() => handleAnswer(false)} className={`gap-2 transition-transform hover:scale-105 active:scale-95 duration-200 ${activeOptionIndex === 0 ? 'scale-95 opacity-80 shadow-inner' : ''}`}>
                  <XCircle size={18} /> Did not know
                </Button>
                <span className="text-xs text-muted-foreground font-medium">Press 1</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Button size="lg" onClick={() => handleAnswer(true)} className={`gap-2 bg-green-600 hover:bg-green-700 text-white transition-transform hover:scale-105 active:scale-95 duration-200 ${activeOptionIndex === 1 ? 'scale-95 opacity-80 shadow-inner' : ''}`}>
                  <CheckCircle2 size={18} /> Knew it!
                </Button>
                <span className="text-xs text-muted-foreground font-medium">Press 2</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderAudio = () => {
    const checkAnswer = (e: React.FormEvent) => {
      e.preventDefault();
      // Audio dictation requires typing the exact word or translation
      const isWordMatch = checkPartialTranslation(answerInput, currentWord.word);
      const isTransMatch = checkPartialTranslation(answerInput, currentWord.translation);
      handleAnswer(isWordMatch || isTransMatch);
    };

    return (
      <div className="space-y-6 text-center animate-in fade-in zoom-in-95 duration-300">
        <div className="flex justify-center mb-6">
          <Button 
            size="icon" 
            variant="outline" 
            className="h-24 w-24 rounded-full shadow-md hover:scale-105 transition-transform"
            onClick={() => speakAudio(currentWord.word)}
          >
            <Volume2 size={40} className="text-primary" />
          </Button>
        </div>
        <p className="text-muted-foreground mb-4">Listen and type the word</p>
        
        <form onSubmit={checkAnswer} className="space-y-4 max-w-sm mx-auto">
          <Input
            ref={inputRef}
            autoFocus
            placeholder="Type what you hear..."
            className="text-center text-lg py-6 transition-all focus:scale-105 duration-200"
            value={answerInput}
            onChange={(e) => setAnswerInput(e.target.value)}
            disabled={showAnswerFeedback !== 'idle'}
          />
          <Button type="submit" className="w-full transition-transform hover:scale-105 active:scale-95 duration-200" disabled={!answerInput.trim() || showAnswerFeedback !== 'idle'}>
            Check Answer
          </Button>
        </form>

        {showAnswerFeedback !== 'idle' && (
          <div className="mt-4 text-lg">
            The word was: <span className="font-bold text-green-500">{currentWord.word}</span> <br/>
            Translation: <span className="text-muted-foreground">{currentWord.translation}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full">
      <div className="mb-6 flex justify-between items-center text-sm text-muted-foreground">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push(`/packs/${packId}`)} className="text-muted-foreground hover:text-destructive px-2 -ml-2" title="Quit without saving">
            <XCircle size={18} className="mr-2" /> Quit
          </Button>
          <span className="hidden sm:inline">Word {currentIndex + 1} of {initialWords.length}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="sm:hidden">Word {currentIndex + 1} / {initialWords.length}</span>
          <span className="hidden sm:inline" title="Current session mastery">Score: {sessionScores[currentWord.id]}/5</span>
          <span className="text-primary font-medium" title="Global pack progress">
            {totalPackMastered} / {totalPackWords} Learned
          </span>
        </div>
      </div>
      <Progress value={progressPercent} className="h-2 mb-10" />

      <Card className="w-full min-h-[400px] flex flex-col justify-center items-center shadow-lg border-primary/10">
        <CardContent className="w-full p-6 sm:p-10">
          {currentQuizMode === 'multiple_choice' && renderMultipleChoice()}
          {currentQuizMode === 'written' && renderWritten()}
          {currentQuizMode === 'flashcard' && renderFlashcard()}
          {currentQuizMode === 'audio' && renderAudio()}
        </CardContent>
      </Card>
      
      {/* Visual Feedback Overlay */}
      {showAnswerFeedback === 'correct' && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-2 animate-bounce">
          <CheckCircle2 size={20} /> Correct! (+1 Mastery)
        </div>
      )}
      {showAnswerFeedback === 'incorrect' && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-2 animate-in slide-in-from-bottom-5">
          <XCircle size={20} /> Almost! Next time.
        </div>
      )}
    </div>
  );
}

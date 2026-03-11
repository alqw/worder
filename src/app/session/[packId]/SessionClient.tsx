'use client';

import { useState } from 'react';
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
}

export function SessionClient({ initialWords, packId, mode, allWords }: SessionClientProps) {
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

  // Randomize quiz mode on a new word setup
  const setupNextWord = (index: number) => {
    const modes: QuizMode[] = ['multiple_choice', 'written', 'flashcard', 'audio'];
    const randomMode = modes[Math.floor(Math.random() * modes.length)];
    setCurrentQuizMode(randomMode);
    setShowAnswerFeedback('idle');
    setAnswerInput('');
  };

  // Initialize first word mode
  useState(() => {
    setupNextWord(0);
  });

  const currentWord = words[currentIndex];
  const progressPercent = Math.round((currentIndex / initialWords.length) * 100);

  // Helper to check if a user input matches *any* part of a multi-word translation
  const checkPartialTranslation = (input: string, correctTranslation: string) => {
    const normalize = (s: string) => s.toLowerCase().trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
    const normalizedInput = normalize(input);
    if (!normalizedInput) return false;

    // Split the correct translation by commas, slashes, or spaces to get possible valid answers
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
        setupNextWord(currentIndex + 1);
      } else {
        finishSession();
      }
    }, 1500);
  };

  const finishSession = async () => {
    setIsFinished(true);
    setSaving(true);
    try {
      // Save all updated scores to DB
      const promises = words.map(async (w) => {
        const score = sessionScores[w.id];
        if (score !== w.mastery_score) {
          await updateWordMastery(w.id, score);
        }
      });
      await Promise.all(promises);
      toast.success('Session progress saved!');
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

  if (isFinished) {
    return (
      <div className="text-center space-y-6 animate-in fade-in duration-500">
        <h2 className="text-3xl font-extrabold text-foreground">Session Complete!</h2>
        <p className="text-muted-foreground text-lg">
          You have completed {initialWords.length} words in "{mode}".
        </p>
        <div className="flex justify-center mt-6">
          <Button size="lg" asChild disabled={saving}>
            <a href={`/packs/${packId}`}>Return to Pack</a>
          </Button>
        </div>
      </div>
    );
  }

  if (!currentWord) return null;

  // --- Quiz Renderers ---

  const renderMultipleChoice = () => {
    // Generate 3 random wrong answers
    const wrongAnswers = allWords
      .map((w) => w.translation)
      .filter((t) => t !== currentWord.translation)
      .sort(() => 0.5 - Math.random())
      .slice(0, 3);
    
    // Mix the correct answer in
    const options = [...wrongAnswers, currentWord.translation].sort(() => 0.5 - Math.random());

    return (
      <div className="space-y-4">
        <h3 className="text-3xl font-bold text-center mb-8">{currentWord.word}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {options.map((opt, i) => {
            let variant: "default" | "outline" | "destructive" | "secondary" = "outline";
            if (showAnswerFeedback !== 'idle') {
              if (opt === currentWord.translation) variant = "default"; // Highlight correct answer
              else if (opt !== currentWord.translation && showAnswerFeedback === 'incorrect') variant = "destructive"; // Mark wrong choice (if selected, roughly)
            }

            return (
              <Button
                key={i}
                variant={variant}
                className={`py-8 text-lg transition-all hover:scale-105 active:scale-95 duration-200 ${
                  showAnswerFeedback !== 'idle' && opt === currentWord.translation 
                    ? 'bg-green-600 hover:bg-green-700 text-white scale-105' 
                    : ''
                }`}
                disabled={showAnswerFeedback !== 'idle'}
                onClick={() => handleAnswer(opt === currentWord.translation)}
              >
                {opt}
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
        
        {showAnswerFeedback === 'idle' ? (
          <Button size="lg" onClick={() => setShowAnswerFeedback('correct')} variant="secondary" className="w-full max-w-sm transition-transform hover:scale-105 active:scale-95 duration-200">
            Show Translation
          </Button>
        ) : (
          <div className="space-y-6 animate-in slide-in-from-bottom-6 fade-in duration-500">
            <h4 className="text-2xl font-medium text-primary">{currentWord.translation}</h4>
            <div className="flex gap-4 justify-center">
              <Button size="lg" variant="destructive" onClick={() => handleAnswer(false)} className="gap-2 transition-transform hover:scale-105 active:scale-95 duration-200">
                <XCircle size={18} /> Did not know
              </Button>
              <Button size="lg" onClick={() => handleAnswer(true)} className="gap-2 bg-green-600 hover:bg-green-700 text-white transition-transform hover:scale-105 active:scale-95 duration-200">
                <CheckCircle2 size={18} /> Knew it!
              </Button>
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
        <span>Word {currentIndex + 1} of {initialWords.length}</span>
        <span>Current Score: {sessionScores[currentWord.id]}/5</span>
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

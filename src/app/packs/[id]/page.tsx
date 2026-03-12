import { getPack, getWords } from "@/lib/api";
import { createClient } from '@/utils/supabase/server';
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Play, RefreshCcw } from "lucide-react";
import { PackActions } from "@/components/PackActions";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export const revalidate = 0;

export default async function PackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }
  
  // Fetch the pack metadata and all its words concurrently to avoid a waterfall
  const [pack, words] = await Promise.all([
    getPack(supabase, id),
    getWords(supabase, id)
  ]);
  
  if (!pack) {
    notFound();
  }
  const learnedCount = words.filter((w) => w.mastery_score === 5).length;
  const totalCount = words.length;
  const progressPercent = totalCount === 0 ? 0 : Math.round((learnedCount / totalCount) * 100);

  // Simple SRS check for review availability (mastery=5 AND last_reviewed > 1 day ago)
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);
  const wordsToReview = words.filter(
    (w) => w.mastery_score === 5 && w.last_reviewed && new Date(w.last_reviewed) < oneDayAgo
  ).length;

  const wordsToLearn = words.filter((w) => w.mastery_score < 5).length;

  const sortedWords = [...words].sort((a, b) => {
    // Both are learned -> sort alphabetically
    if (a.mastery_score === 5 && b.mastery_score === 5) return a.word.localeCompare(b.word);
    
    // Put learned words at the bottom
    if (a.mastery_score === 5) return 1;
    if (b.mastery_score === 5) return -1;
    
    // Sort unlearned words by score descending (highest score first)
    if (b.mastery_score !== a.mastery_score) {
      return b.mastery_score - a.mastery_score;
    }
    // If scores are equal, sort alphabetically
    return a.word.localeCompare(b.word);
  });

  return (
    <div className="container mx-auto py-10 px-4 max-w-5xl">
      <div className="mb-8">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-2 mb-4 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </Link>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight mb-2">
              {pack.name}
            </h1>
            <p className="text-muted-foreground">
              {totalCount} words total • {learnedCount} mastered
            </p>
          </div>
          <PackActions packId={pack.id} packName={pack.name} words={words as any} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <Card className="col-span-1 md:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Progress Mastery</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="font-medium text-foreground">
                  {progressPercent}% Complete
                </span>
                <span className="text-muted-foreground">
                  {learnedCount} / {totalCount} Words
                </span>
              </div>
              <Progress value={progressPercent} className="h-3" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button
              className="w-full gap-2 text-lg py-6"
              size="lg"
              disabled={wordsToLearn === 0}
              asChild={wordsToLearn > 0}
            >
              {wordsToLearn > 0 ? (
                <Link href={`/session/${pack.id}?mode=learn`}>
                  <Play size={20} />
                  Learn Now
                </Link>
              ) : (
                <>
                  <Play size={20} />
                  All Caught Up!
                </>
              )}
            </Button>
            <Button
              className="w-full gap-2"
              variant="secondary"
              disabled={wordsToReview === 0}
              asChild={wordsToReview > 0}
            >
              {wordsToReview > 0 ? (
                <Link href={`/session/${pack.id}?mode=review`}>
                  <RefreshCcw size={18} />
                  Review ({wordsToReview})
                </Link>
              ) : (
                <>
                  <RefreshCcw size={18} />
                  No Reviews
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="text-2xl font-bold tracking-tight mb-6">Vocabulary List</h3>
        <div className="rounded-md border bg-card text-card-foreground shadow-sm overflow-hidden">
          {words.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No vocabulary yet. Import a JSON file to add words. <br/>
              <span className="text-sm mt-2 block opacity-70">Format: {`{"word": "translation"}`}</span>
            </div>
          ) : (
            <div className="divide-y max-h-[600px] overflow-y-auto">
              {sortedWords.map((word) => (
                <div
                  key={word.id}
                  className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-4">
                    <span className="font-semibold text-lg">{word.word}</span>
                    <span className="text-muted-foreground hidden md:inline">•</span>
                    <span className="text-muted-foreground">{word.translation}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1" title={`Mastery Score: ${word.mastery_score}/5`}>
                      {[1, 2, 3, 4, 5].map((level) => (
                        <div
                          key={level}
                          className={`w-2 h-4 rounded-sm transition-colors ${
                            level <= word.mastery_score
                              ? "bg-primary"
                              : "bg-primary/20"
                          }`}
                        />
                      ))}
                    </div>
                    {word.mastery_score === 5 && (
                      <Badge variant="default" className="bg-green-500 hover:bg-green-600">Learned</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

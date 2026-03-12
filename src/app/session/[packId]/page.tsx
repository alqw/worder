import { getWordsForLearning, getWordsForReview } from '@/lib/api';
import { notFound, redirect } from 'next/navigation';
import { SessionClient } from './SessionClient';
import { createClient } from '@/utils/supabase/server';

export const revalidate = 0;

export default async function SessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ packId: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode: searchMode } = await searchParams;
  const { packId } = await params;
  const mode = searchMode === 'review' ? 'review' : 'learn';

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch session target words and background distractor words concurrently
  const [words, { data: allWords }, totalRes, masteredRes] = await Promise.all([
    mode === 'review' ? getWordsForReview(supabase, packId, 10) : getWordsForLearning(supabase, packId, 10),
    supabase.from('words').select('word, translation').eq('pack_id', packId),
    supabase.from('words').select('*', { count: 'exact', head: true }).eq('pack_id', packId),
    supabase.from('words').select('*', { count: 'exact', head: true }).eq('pack_id', packId).eq('mastery_score', 5)
  ]);

  if (words.length === 0) {
    return (
      <div className="container mx-auto py-20 text-center max-w-2xl text-muted-foreground">
        <h2 className="text-2xl font-bold mb-4 text-foreground">All Caught Up!</h2>
        <p>You have no words to {mode} in this pack right now.</p>
        <a href={`/packs/${packId}`} className="text-primary hover:underline mt-6 inline-block">
          Return to Pack
        </a>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 px-4 max-w-2xl min-h-[80vh] flex flex-col justify-center">
      <SessionClient 
        initialWords={words as any} 
        packId={packId} 
        mode={mode} 
        allWords={allWords || []} 
        totalPackMastered={masteredRes.count || 0}
        totalPackWords={totalRes.count || 0}
      />
    </div>
  );
}

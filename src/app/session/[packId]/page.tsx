import { getWordsForLearning, getWordsForReview } from '@/lib/api';
import { notFound } from 'next/navigation';
import { SessionClient } from './SessionClient';

export const revalidate = 0;

export default async function SessionPage({
  params,
  searchParams,
}: {
  params: { packId: string };
  searchParams: { mode?: string };
}) {
  const mode = searchParams.mode === 'review' ? 'review' : 'learn';
  const packId = params.packId;

  // Retrieve 10 words based on mode
  const words =
    mode === 'review'
      ? await getWordsForReview(packId, 10)
      : await getWordsForLearning(packId, 10);

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

  // Pre-fetch distractor words for multiple choice mode
  // We need to fetch the whole pack just to have wrong options
  // In a massive app, we'd do a random order query, but for a small pack fetching all is fine.
  const { supabase } = await import('@/lib/supabase');
  const { data: allWords } = await supabase.from('words').select('word, translation').eq('pack_id', packId);

  return (
    <div className="container mx-auto py-10 px-4 max-w-2xl min-h-[80vh] flex flex-col justify-center">
      <SessionClient 
        initialWords={words as any} 
        packId={packId} 
        mode={mode} 
        allWords={allWords || []} 
      />
    </div>
  );
}

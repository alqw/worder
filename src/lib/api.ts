import { type SupabaseClient } from '@supabase/supabase-js';

// The API now requires the caller to pass down the SupabaseClient instance
// because in an SSR environment with Auth, the client must be created dynamically
// per-request to capture the user's secure cookies.
export interface Pack {
  id: string;
  name: string;
  created_at: string;
}

export interface Word {
  id: string;
  pack_id: string;
  word: string;
  translation: string;
  mastery_score: number;
  last_reviewed: string | null;
  created_at: string;
}

export async function getPacks(supabase: SupabaseClient): Promise<Pack[]> {
  const { data, error } = await supabase.from('packs').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getPack(supabase: SupabaseClient, id: string): Promise<Pack | null> {
  const { data, error } = await supabase.from('packs').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function createPack(supabase: SupabaseClient, name: string): Promise<Pack> {
  const { data, error } = await supabase.from('packs').insert({ name }).select().single();
  if (error) throw error;
  return data;
}

export async function deletePack(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('packs').delete().eq('id', id);
  if (error) throw error;
}

export async function getWords(supabase: SupabaseClient, packId: string): Promise<Word[]> {
  const { data, error } = await supabase.from('words').select('*').eq('pack_id', packId).order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function upsertWords(supabase: SupabaseClient, words: Omit<Word, 'id' | 'created_at' | 'mastery_score' | 'last_reviewed'>[]): Promise<Word[]> {
  const { data, error } = await supabase.from('words').insert(words).select();
  if (error) throw error;
  return data || [];
}

export async function updateWordMastery(supabase: SupabaseClient, id: string, score: number): Promise<void> {
  const { error } = await supabase.from('words').update({
    mastery_score: score,
    last_reviewed: new Date().toISOString()
  }).eq('id', id);
  if (error) throw error;
}

export async function getWordsForLearning(supabase: SupabaseClient, packId: string, limit: number = 10): Promise<Word[]> {
  // Words with mastery < 5
  const { data, error } = await supabase
    .from('words')
    .select('*')
    .eq('pack_id', packId)
    .lt('mastery_score', 5)
    .order('mastery_score', { ascending: true }) // prioritize lower scores
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function getWordsForReview(supabase: SupabaseClient, packId: string, limit: number = 10): Promise<Word[]> {
  // Words with mastery = 5, ordered by last_reviewed ascending (oldest first)
  // Simple SRS: if last_reviewed is older than 1 day
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  const { data, error } = await supabase
    .from('words')
    .select('*')
    .eq('pack_id', packId)
    .eq('mastery_score', 5)
    .lt('last_reviewed', oneDayAgo.toISOString())
    .order('last_reviewed', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

import { supabase } from './supabase';

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

export async function getPacks(): Promise<Pack[]> {
  const { data, error } = await supabase.from('packs').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getPack(id: string): Promise<Pack | null> {
  const { data, error } = await supabase.from('packs').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function createPack(name: string): Promise<Pack> {
  const { data, error } = await supabase.from('packs').insert({ name }).select().single();
  if (error) throw error;
  return data;
}

export async function deletePack(id: string): Promise<void> {
  const { error } = await supabase.from('packs').delete().eq('id', id);
  if (error) throw error;
}

export async function getWords(packId: string): Promise<Word[]> {
  const { data, error } = await supabase.from('words').select('*').eq('pack_id', packId).order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function upsertWords(words: Omit<Word, 'id' | 'created_at' | 'mastery_score' | 'last_reviewed'>[]): Promise<Word[]> {
  const { data, error } = await supabase.from('words').insert(words).select();
  if (error) throw error;
  return data || [];
}

export async function updateWordMastery(id: string, score: number): Promise<void> {
  const { error } = await supabase.from('words').update({
    mastery_score: score,
    last_reviewed: new Date().toISOString()
  }).eq('id', id);
  if (error) throw error;
}

export async function getWordsForLearning(packId: string, limit = 10): Promise<Word[]> {
  const { data, error } = await supabase
    .from('words')
    .select('*')
    .eq('pack_id', packId)
    .lt('mastery_score', 5)
    .order('mastery_score', { ascending: true }) // prioritize words with lower mastery
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function getWordsForReview(packId: string, limit = 10): Promise<Word[]> {
  // Simple SRS logic: words with mastery_score = 5, and last_reviewed > 1 day ago
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

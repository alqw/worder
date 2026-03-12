import { getPacks } from '@/lib/api';
import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CreatePackDialog } from '@/components/CreatePackDialog';
import { Button } from '@/components/ui/button';
import { redirect } from 'next/navigation';

export const revalidate = 0; // Disable static rendering for this page to always show latest packs

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const packs = await getPacks(supabase);

  // Calculate global progress
  let totalWords = 0;
  let masteredWords = 0;
  if (packs.length > 0) {
    const [totalRes, masteredRes] = await Promise.all([
      supabase.from('words').select('*', { count: 'exact', head: true }),
      supabase.from('words').select('*', { count: 'exact', head: true }).eq('mastery_score', 5)
    ]);
    totalWords = totalRes.count || 0;
    masteredWords = masteredRes.count || 0;
  }

  return (
    <div className="container mx-auto py-10 px-4 max-w-5xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl mb-2 text-foreground">
            Worder
          </h1>
          <p className="text-xl text-muted-foreground mb-4">
            Welcome back, {user.email?.split('@')[0]}!
          </p>
          <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-primary/10 text-primary">
            {masteredWords} / {totalWords} Words Mastered
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <CreatePackDialog />
          <form action={async () => {
            'use server';
            const supabase = await createClient();
            await supabase.auth.signOut();
            redirect('/login');
          }}>
            <Button variant="outline" type="submit">Sign Out</Button>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {packs.length === 0 ? (
          <div className="col-span-full py-12 text-center bg-muted/30 rounded-lg border border-dashed">
            <h3 className="text-lg font-medium mb-2">No packs found</h3>
            <p className="text-muted-foreground mb-4">Create your first vocabulary pack to get started.</p>
          </div>
        ) : (
          packs.map((pack) => (
            <Link href={`/packs/${pack.id}`} key={pack.id} className="group">
              <Card className="h-full transition-all duration-300 hover:shadow-lg hover:border-primary/50 group-hover:-translate-y-1">
                <CardHeader>
                  <CardTitle className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent group-hover:from-primary group-hover:to-primary transition-all">
                    {pack.name}
                  </CardTitle>
                  <CardDescription>
                    Created {new Date(pack.created_at).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Later we can show progress bars here */}
                  <div className="text-sm text-muted-foreground flex items-center justify-between">
                    <span>View words and stats</span>
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity translate-x-[-10px] group-hover:translate-x-0 duration-300">
                      &rarr;
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

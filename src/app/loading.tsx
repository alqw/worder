import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="container mx-auto py-20 px-4 max-w-5xl flex flex-col items-center justify-center min-h-[50vh] animate-in fade-in duration-500">
      <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
      <h2 className="text-2xl font-semibold text-foreground">Loading Worder...</h2>
      <p className="text-muted-foreground mt-2">Fetching your vocabulary data</p>
    </div>
  );
}

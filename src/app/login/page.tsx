'use client';

import * as React from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { toast } from 'sonner';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Successfully signed in!');
        router.push('/');
        router.refresh(); // Force reload to apply auth state
      }
    } catch (err) {
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    setLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Check your email for the confirmation link!');
      }
    } catch (err) {
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleAnonymousSignIn = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInAnonymously();
      
      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Signed in as a guest!');
        router.push('/');
        router.refresh();
      }
    } catch (err) {
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: 'google' | 'github' | 'apple') => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          // Typically redirect back to the home page or an auth callback route
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      
      if (error) {
        toast.error(error.message);
        setLoading(false); // only disable loading if error, otherwise it's redirecting
      }
    } catch (err) {
      toast.error('An unexpected error occurred');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md shadow-xl border-primary/20">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-3xl font-bold tracking-tight text-primary">Worder</CardTitle>
          <CardDescription>Sign in to your account or create a new one to sync your vocabulary progress.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-3 pt-4">
              <Button type="submit" disabled={loading} className="w-full">
                Sign In
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleSignUp}
                disabled={loading} 
                className="w-full"
              >
                Create Account
              </Button>
            </div>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-muted" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-3">
              <Button 
                variant="outline" 
                type="button" 
                disabled={loading}
                onClick={() => handleOAuthSignIn('google')}
              >
                Google
              </Button>
              <Button 
                variant="outline" 
                type="button" 
                disabled={loading}
                onClick={() => handleOAuthSignIn('github')}
              >
                GitHub
              </Button>
              <Button 
                variant="outline" 
                type="button" 
                disabled={loading}
                onClick={() => handleOAuthSignIn('apple')}
              >
                Apple
              </Button>
            </div>
            <Button 
              variant="secondary" 
              type="button" 
              disabled={loading}
              onClick={handleAnonymousSignIn}
              className="w-full"
            >
              Continue as Guest (Anonymous)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

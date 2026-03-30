import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useAuth } from '../lib/auth-context';

export function LoginPage() {
  const { login, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(email, password);
    } catch {
      // Error shown via context
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-[var(--energy-green-1)] to-[var(--energy-green-3)] flex items-center justify-center">
              <span className="text-white font-bold text-lg">M</span>
            </div>
            <CardTitle className="text-2xl">Margav Energy CRM</CardTitle>
          </div>
          <p className="text-muted-foreground text-sm">
            Sign in to access your dashboard
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@margav.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1"
              />
            </div>
            {error && (
              <div className="rounded-md bg-destructive/10 text-destructive text-sm p-3">
                {error}
              </div>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={submitting}
              style={{ backgroundColor: 'var(--energy-green-1)', color: 'white' }}
            >
              {submitting ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground mt-4 text-center">
            Use your Margav CRM credentials. Admin: admin@margav.com
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Droplet, Lock, Mail, User, ArrowRight, AlertCircle, ShieldCheck, UserCheck } from 'lucide-react';
import { authService } from '@/services/api';

export default function AdminSignUpPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if already authenticated
  useEffect(() => {
    if (authService.isAuthenticated()) {
      authService
        .me()
        .then(() => {
          router.push('/admin/dashboard');
        })
        .catch(() => {
          authService.logout();
        });
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username.trim() || !email.trim() || !password) {
      setError('Please fill in all required fields.');
      return;
    }

    if (username.trim().length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await authService.signup(
        username.trim(),
        email.trim(),
        password,
        fullName.trim() || undefined
      );
      router.push('/admin/dashboard');
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        'Registration failed. Please check your details and try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-gradient-to-tr from-brand-600 to-cyan-400 text-white shadow-lg shadow-brand-500/25 mb-2">
            <Droplet className="h-8 w-8 fill-current" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            SAM Admin Sign Up
          </h1>
          <p className="text-sm text-muted-foreground">
            Create an administrator account to manage groundwater wells and sensors
          </p>
        </div>

        {/* SignUp Card */}
        <div className="border bg-card rounded-2xl shadow-xl p-6 sm:p-8 space-y-5">
          {error && (
            <div className="flex items-center gap-2 p-3 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl animate-in fade-in">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1">
                Full Name (Optional)
              </label>
              <div className="relative">
                <UserCheck className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g., Dr. Rajesh Kumar"
                  className="w-full pl-10 pr-4 py-2 rounded-xl border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1">
                Admin Username *
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g., admin_rajesh"
                  className="w-full pl-10 pr-4 py-2 rounded-xl border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1">
                Email Address *
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g., admin@aquasense.local"
                  className="w-full pl-10 pr-4 py-2 rounded-xl border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1">
                Password * (min 8 characters)
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-4 py-2 rounded-xl border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1">
                Confirm Password *
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-4 py-2 rounded-xl border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-3 py-3 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <span>Creating Admin Account...</span>
              ) : (
                <>
                  <span>Create Account & Open Dashboard</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="pt-3 border-t text-center space-y-1.5">
            <p className="text-xs text-muted-foreground">
              Already have an admin account?{' '}
              <a href="/admin/login" className="text-brand-600 font-semibold hover:underline">
                Sign in here
              </a>
            </p>
            <div>
              <a href="/" className="text-[11px] text-muted-foreground hover:underline">
                ← Return to Environmental Dashboard
              </a>
            </div>
          </div>
        </div>

        {/* Security Notice */}
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <span>PBKDF2-HMAC Cryptographic Security Enabled</span>
        </div>
      </div>
    </div>
  );
}

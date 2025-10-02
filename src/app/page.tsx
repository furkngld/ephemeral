'use client';

import { ChatInterface } from '@/components/ChatInterface';
import { LoginScreen } from '@/components/LoginScreen';
import { useEphemeral } from '@/hooks/useEphemeral';

export default function Home() {
  const { isLoggedIn } = useEphemeral();

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-3 py-8 text-slate-100 sm:px-6 sm:py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_60%)]" />
      <div className="pointer-events-none absolute inset-y-6 inset-x-4 rounded-[42px] border border-slate-800/60 blur-sm sm:inset-y-8 sm:inset-x-6 sm:rounded-[48px]" />
      <main className="relative z-10 flex w-full max-w-6xl items-center justify-center">
        {isLoggedIn ? <ChatInterface /> : <LoginScreen />}
      </main>
    </div>
  );
}

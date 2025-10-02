'use client';

import { FormEvent, useState } from 'react';
import { Sparkles, ShieldCheck, Wand2, ArrowRight } from 'lucide-react';
import { useEphemeral } from '@/hooks/useEphemeral';
import { generateMnemonic } from '@/lib/bitcoin';

export function LoginScreen() {
  const { login, isLoading, error } = useEphemeral();
  const [mnemonic, setMnemonic] = useState('');
  const [hasGenerated, setHasGenerated] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await login(mnemonic);
  };

  const handleGenerate = () => {
    try {
      const freshMnemonic = generateMnemonic();
      setMnemonic(freshMnemonic);
      setHasGenerated(true);
    } catch (err) {
      console.error('Mnemonic generation failed', err);
    }
  };

  return (
    <section className="relative w-full max-w-4xl overflow-hidden rounded-[32px] border border-emerald-500/25 bg-gradient-to-br from-slate-950/95 via-slate-900/75 to-emerald-900/25 p-[1px] shadow-[0_40px_120px_-40px_rgba(16,185,129,0.45)] backdrop-blur-lg sm:rounded-[36px]">
      <div className="relative grid gap-8 rounded-[30px] bg-slate-950/90 p-6 sm:gap-10 sm:p-10 lg:grid-cols-[1.1fr_0.9fr] lg:p-12">
        <div className="space-y-8 sm:space-y-10">
          <header className="space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-200">
              <Sparkles className="h-3.5 w-3.5" /> Ephemeral Protocol
            </span>
            <h1 className="text-2xl font-semibold leading-tight text-slate-50 sm:text-3xl">
              One-Shot Messaging Locked by a <span className="text-emerald-300">12-Word Secret</span>
            </h1>
            <p className="text-sm leading-6 text-slate-300 sm:text-base">
              Enter any valid 12-word BIP39 mnemonic or generate a fresh wallet right in your browser.
              Two people who know the same phrase can derive identical Bitcoin Testnet Taproot addresses
              and exchange deniable, end-to-end encrypted messages.
            </p>
          </header>

          <div className="space-y-4 rounded-3xl border border-slate-800/70 bg-slate-900/70 p-5 sm:p-6">
            <div className="flex items-center gap-3 text-emerald-200">
              <ShieldCheck className="h-5 w-5" />
              <p className="text-sm font-medium">All secrets stay inside this browser tab.</p>
            </div>
            <p className="text-xs leading-5 text-slate-400">
              Never share the mnemonic. When you generate a new wallet, copy the words somewhere safe;
              Ephemeral never transmits them to any central server.
            </p>
            <ul className="grid gap-2 text-xs text-slate-300 sm:grid-cols-2">
              <li className="rounded-2xl border border-slate-800/60 bg-slate-950/70 px-4 py-3">
                <span className="font-semibold text-emerald-200">1.</span> Enter or generate your secret phrase.
              </li>
              <li className="rounded-2xl border border-slate-800/60 bg-slate-950/70 px-4 py-3">
                <span className="font-semibold text-emerald-200">2.</span> Derive the keys with “Join the channel”.
              </li>
              <li className="rounded-2xl border border-slate-800/60 bg-slate-950/70 px-4 py-3">
                <span className="font-semibold text-emerald-200">3.</span> Send a message and inscribe the payload on-chain.
              </li>
              <li className="rounded-2xl border border-slate-800/60 bg-slate-950/70 px-4 py-3">
                <span className="font-semibold text-emerald-200">4.</span> Decode shared inscriptions with the same phrase.
              </li>
            </ul>
          </div>
        </div>

        <div className="space-y-6 rounded-3xl border border-slate-800/60 bg-slate-950/80 p-6 shadow-inner sm:p-8">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-emerald-100" htmlFor="mnemonic">
                Secret Phrase / Mnemonic
              </label>
              <textarea
                id="mnemonic"
                className="min-h-[150px] w-full rounded-2xl border border-slate-800 bg-slate-950/80 p-4 text-sm text-slate-200 shadow-inner outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/70"
                placeholder="e.g. orphan ladder maple ..."
                value={mnemonic}
                onChange={(event) => {
                  setMnemonic(event.target.value);
                  setHasGenerated(false);
                }}
                spellCheck={false}
              />
              <p className="flex items-center gap-2 text-xs text-slate-400">
                <ArrowRight className="h-3 w-3" /> Make sure you have exactly 12 words. Invalid inputs are rejected automatically.
              </p>
            </div>

            {error ? (
              <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">
                {error}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                className="flex-1 rounded-2xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-700/50 disabled:text-emerald-200"
                disabled={isLoading}
              >
                {isLoading ? 'Deriving keys…' : 'Join the channel'}
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/40 bg-transparent px-5 py-3 text-sm font-semibold text-emerald-200 transition hover:border-emerald-300 hover:text-emerald-100"
              >
                <Wand2 className="h-4 w-4" /> Generate new wallet
              </button>
            </div>
          </form>

          {hasGenerated ? (
            <div className="space-y-3 rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-100">
              <p className="font-semibold text-sm text-emerald-100">
                Your new secret phrase is ready! 🔐
              </p>
              <p>
                Copy these words somewhere safe—lose them and you lose access to every message.
                When you’re ready, hit <span className="font-semibold">Join the channel</span> to continue.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

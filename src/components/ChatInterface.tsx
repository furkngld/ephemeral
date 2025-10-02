'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Info,
  Link2,
  RotateCcw,
  SendHorizontal,
  Wallet as WalletIcon,
} from 'lucide-react';
import { useEphemeral } from '@/hooks/useEphemeral';
import { MessageBubble } from './MessageBubble';

export function ChatInterface() {
  const {
    messages,
    sendMessage,
    checkForMessages,
    isLoading,
    error,
    addresses,
    pendingOutbound,
    acknowledgeOutbound,
    isWalletAvailable,
    isWalletConnecting,
    walletAddress,
    walletNetwork,
    walletError,
    connectWallet,
    importInbound,
    inscribeWithWallet,
    inscribing,
    inscriptionResults,
  } = useEphemeral();

  const [draft, setDraft] = useState('');
  const [incomingPayload, setIncomingPayload] = useState('');
  const [incomingAddress, setIncomingAddress] = useState('');
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isManualPanelOpen, setIsManualPanelOpen] = useState(false);

  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const orderedPending = useMemo(
    () => pendingOutbound.map((item, index) => ({ ...item, sequence: index + 1 })),
    [pendingOutbound],
  );

  const pendingLabelMap = useMemo(() => {
    return orderedPending.reduce<Record<string, string>>((acc, item) => {
      acc[item.id] = `INS ${item.sequence.toString().padStart(2, '0')}`;
      return acc;
    }, {});
  }, [orderedPending]);

  useEffect(() => {
    void checkForMessages();
  }, [checkForMessages]);

  useEffect(() => {
    if (!scrollerRef.current) {
      return;
    }

    scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
  }, [messages]);

  const primaryAddress = addresses.at(0);

  const addressHint = useMemo(() => {
    if (!primaryAddress) {
      return '';
    }

    return `${primaryAddress.slice(0, 12)}…${primaryAddress.slice(-6)}`;
  }, [primaryAddress]);

  const walletConnected = Boolean(walletAddress);
  const walletOnTestnet = (walletNetwork ?? '').toLowerCase().includes('test');
  const walletReady = walletConnected && walletOnTestnet && !walletError;
  const walletDisplay = walletAddress
    ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`
    : 'not connected';
  const networkDisplay = walletNetwork
    ? walletNetwork.toUpperCase()
    : walletConnected
      ? 'CHECKING'
      : 'UNKNOWN';

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!draft.trim()) {
      return;
    }

    await sendMessage(draft);
    setDraft('');
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.warn('Copy failed', err);
    }
  };

  const handleRefresh = async () => {
    await checkForMessages();
  };

  const handleImportInbound = async (event: FormEvent) => {
    event.preventDefault();

    const payload = incomingPayload.trim();

    if (!payload) {
      setImportStatus('error');
      setImportMessage('Paste a Base64 payload before attempting to decode it.');
      return;
    }

    setIsManualPanelOpen(true);
    setIsImporting(true);
    setImportStatus('idle');
    setImportMessage(null);

    try {
      const success = await importInbound(
        payload,
        incomingAddress.trim() || undefined,
      );

      if (success) {
        setIncomingPayload('');
        setIncomingAddress('');
        setImportStatus('success');
        setImportMessage('Payload decrypted and added to your timeline.');
      } else {
        setImportStatus('error');
        setImportMessage(
          'We could not decrypt this payload. Double-check the mnemonic and payload.',
        );
      }
    } catch (err) {
      console.error('Manual import failed', err);
      setImportStatus('error');
      setImportMessage('An unexpected error occurred while decoding this payload.');
    } finally {
      setIsImporting(false);
    }
  };

  const importMessageClass =
    importStatus === 'success'
      ? 'text-emerald-300'
      : importStatus === 'error'
        ? 'text-rose-300'
        : 'text-slate-400';

  const triggerInscribe = async (
    id: string,
    address: string,
    payload: string,
    messageContent?: string,
  ) => {
    await inscribeWithWallet({
      id,
      address,
      payload,
      message: messageContent,
    });
  };

  return (
    <section className="flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-800/60 bg-slate-950/80 shadow-[0_40px_120px_-40px_rgba(16,185,129,0.35)] backdrop-blur sm:rounded-[32px]">
      <header className="flex flex-col gap-3 border-b border-slate-800/70 bg-slate-950/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-white sm:text-xl">Ephemeral Channel</h2>
          {addressHint ? (
            <p className="text-xs text-slate-300 sm:text-sm">
              Primary taproot address: <span className="font-mono">{addressHint}</span>
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300 sm:text-[13px]">
          <span className="inline-flex items-center rounded-full border border-slate-700/60 bg-slate-900/70 px-3 py-1 font-mono text-[11px] text-slate-200">
            Wallet: {walletDisplay}
          </span>
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] ${walletOnTestnet ? 'border-emerald-500/50 text-emerald-300' : 'border-amber-400/40 text-amber-200'}`}
          >
            Network: {networkDisplay}
          </span>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-5 p-4 sm:p-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)]">
        <div className="flex h-full flex-col overflow-hidden rounded-[26px] border border-slate-800/70 bg-gradient-to-b from-slate-950/80 to-slate-900/60 sm:rounded-3xl">
          <div
            ref={scrollerRef}
            className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-700/70"
          >
            {messages.length === 0 ? (
              <div className="mt-16 flex flex-col items-center gap-3 text-center text-sm text-slate-400">
                <p className="text-base font-medium text-slate-200">Your channel is quiet.</p>
                <p className="max-w-xs text-xs sm:text-sm">
                  Send an encrypted note or fetch the inbox to pull in any inscriptions minted for this mnemonic.
                </p>
              </div>
            ) : (
              messages.map((message) => {
                const result = inscriptionResults[message.id] ?? null;
                const isInscribing = Boolean(inscribing[message.id]);
                const canInscribeMessage =
                  walletReady && message.direction === 'outbound';

                return (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    inscriptionLabel={pendingLabelMap[message.id] ?? null}
                    onInscribe={
                      message.direction === 'outbound'
                        ? () =>
                            triggerInscribe(
                              message.id,
                              message.address,
                              message.encrypted,
                              message.content,
                            )
                        : undefined
                    }
                    canInscribe={canInscribeMessage}
                    isInscribing={isInscribing}
                    inscriptionResult={result}
                  />
                );
              })
            )}
          </div>

          <div className="space-y-3 border-t border-slate-800 bg-slate-900/90 px-6 py-4">
            {error ? (
              <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-xs text-rose-200">
                {error}
              </div>
            ) : null}

            <form className="flex items-end gap-3" onSubmit={handleSubmit}>
              <div className="flex-1">
                <label className="text-xs font-medium text-slate-300" htmlFor="new-message">
                  Send (encrypt ➜ inscribe)
                </label>
                <textarea
                  id="new-message"
                  className="mt-1 min-h-[110px] w-full resize-none rounded-2xl border border-slate-700 bg-slate-950/60 p-4 text-sm text-slate-200 shadow-inner outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/70"
                  placeholder="Write the message you’ll encrypt and inscribe"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                />
              </div>

              <button
                type="submit"
                className="flex h-[56px] w-[56px] items-center justify-center rounded-full bg-emerald-500 text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-700/40 disabled:text-emerald-200"
                disabled={isLoading || !draft.trim()}
                aria-label="Send encrypted message"
              >
                <SendHorizontal className="h-5 w-5" />
              </button>
            </form>
          </div>
        </div>

        <div className="flex h-full flex-col gap-4 overflow-y-auto pr-1">
          <div className="rounded-3xl border border-slate-800/70 bg-slate-900/80 p-6 text-sm">
            <header className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300">
                  <WalletIcon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">UniSat wallet</h3>
                  <p className="text-xs text-slate-400">
                    Connect your Bitcoin Testnet wallet to push inscriptions directly from this browser.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void connectWallet()}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 px-4 py-2 text-xs font-semibold text-emerald-200 transition hover:border-emerald-300 hover:text-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isWalletConnecting || (!isWalletAvailable && walletConnected)}
              >
                {isWalletConnecting ? 'Connecting…' : walletConnected ? 'Refresh access' : 'Connect UniSat'}
              </button>
            </header>

            <dl className="mt-4 space-y-3 text-xs">
              <div className="flex items-center justify-between rounded-2xl border border-slate-800/60 bg-slate-950/70 px-4 py-2">
                <dt className="font-semibold text-slate-300">Extension</dt>
                <dd className="font-mono text-[11px] text-slate-200">
                  {isWalletAvailable ? 'Detected' : 'Not detected'}
                </dd>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-slate-800/60 bg-slate-950/70 px-4 py-2">
                <dt className="font-semibold text-slate-300">Network</dt>
                <dd className={`font-mono text-[11px] ${walletOnTestnet ? 'text-emerald-300' : 'text-amber-200'}`}>
                  {networkDisplay}
                </dd>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-slate-800/60 bg-slate-950/70 px-4 py-2">
                <dt className="font-semibold text-slate-300">Account</dt>
                <dd className="font-mono text-[11px] text-slate-200">{walletDisplay}</dd>
              </div>
            </dl>

            {walletError ? (
              <p className="mt-4 flex items-center gap-2 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-3 text-[11px] text-amber-200">
                <AlertTriangle className="h-4 w-4" />
                {walletError}
              </p>
            ) : null}

            {!isWalletAvailable ? (
              <p className="mt-3 text-[11px] text-slate-400">
                Install the UniSat browser extension and refresh this page to connect.
              </p>
            ) : null}
          </div>

          <div className="space-y-4 rounded-3xl border border-emerald-400/25 bg-emerald-500/5 p-6 text-sm text-emerald-100">
            <header className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300">
                <Info className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-emerald-100">Send → Inscribe on Testnet</h3>
                <p className="text-xs text-emerald-200/70">
                  Every outbound message yields a taproot address + Base64 payload ready for an Ordinal inscription.
                </p>
              </div>
            </header>

            <ol className="space-y-3 text-xs leading-5 text-emerald-100/90">
              <li className="flex gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/25 font-semibold text-emerald-100">
                  1
                </span>
                <p>Send an encrypted message in the left panel to mint a fresh instruction card.</p>
              </li>
              <li className="flex gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/25 font-semibold text-emerald-100">
                  2
                </span>
                <p>Copy the taproot address into UniSat (Testnet) and choose the inscription flow.</p>
              </li>
              <li className="flex gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/25 font-semibold text-emerald-100">
                  3
                </span>
                <p>Paste the Base64 payload, confirm the transaction, and mark the card as complete.</p>
              </li>
            </ol>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-emerald-100">Pending inscription cards</h4>

              {orderedPending.length === 0 ? (
                <p className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-4 text-xs text-emerald-200/70">
                  Send a message to generate an instruction card with its taproot address and payload.
                </p>
              ) : (
                <ul className="space-y-3">
                  {orderedPending.map((item) => (
                    <li
                      key={item.id}
                      className="space-y-3 rounded-2xl border border-emerald-400/35 bg-slate-950/60 p-4"
                    >
                      {(() => {
                        const result = inscriptionResults[item.id] ?? null;
                        const isPending = Boolean(inscribing[item.id]);
                        const txLink = result?.txid
                          ? `https://mempool.space/testnet/tx/${result.txid}`
                          : null;
                        const tone = result
                          ? result.success
                            ? 'text-emerald-200'
                            : 'text-rose-300'
                          : 'text-emerald-200/70';

                        return (
                          <>
                            <header className="flex flex-wrap items-center justify-between gap-3">
                              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-emerald-200/80">
                                <span className="inline-flex h-7 min-w-[3rem] items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 font-semibold">
                                  INS {item.sequence.toString().padStart(2, '0')}
                                </span>
                                <span className="flex items-center gap-2 text-[10px] normal-case tracking-[0.12em] text-emerald-200/70">
                                  <Link2 className="h-3.5 w-3.5" /> Linked message preview
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    triggerInscribe(item.id, item.address, item.payload, item.message)
                                  }
                                  disabled={!walletReady || isPending}
                                  className="inline-flex h-8 items-center gap-2 rounded-full border border-emerald-400/40 px-3 text-[11px] font-semibold text-emerald-200 transition hover:border-emerald-300 hover:text-emerald-100 disabled:cursor-not-allowed disabled:border-emerald-400/20 disabled:text-emerald-200/50"
                                >
                                  {isPending ? 'Inscribe…' : walletReady ? 'Inscribe via UniSat' : 'Connect UniSat'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => acknowledgeOutbound(item.id)}
                                  className="inline-flex h-8 items-center gap-1 rounded-full border border-emerald-500/30 px-3 text-[11px] text-emerald-200 transition hover:bg-emerald-500/10"
                                >
                                  Mark done
                                </button>
                              </div>
                            </header>

                            <p className="rounded-2xl border border-emerald-400/25 bg-emerald-900/15 p-3 text-xs text-emerald-100/90">
                              “{item.message}”
                            </p>

                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200/80">
                              Taproot address
                            </p>
                            <div className="rounded-2xl border border-emerald-400/20 bg-slate-950/70 p-3">
                              <p className="select-all font-mono text-xs text-emerald-100/90">{item.address}</p>
                              <button
                                type="button"
                                onClick={() => handleCopy(item.address)}
                                className="mt-2 inline-flex items-center gap-1 text-[11px] text-emerald-300 transition hover:text-emerald-200"
                              >
                                <Copy className="h-3.5 w-3.5" />
                                Copy address
                              </button>
                            </div>

                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200/80">
                              Base64 payload
                            </p>
                            <div className="rounded-2xl border border-emerald-400/20 bg-slate-950/70 p-3">
                              <p className="select-all break-all font-mono text-xs leading-5 text-emerald-100/90">
                                {item.payload}
                              </p>
                              <button
                                type="button"
                                onClick={() => handleCopy(item.payload)}
                                className="mt-2 inline-flex items-center gap-1 text-[11px] text-emerald-300 transition hover:text-emerald-200"
                              >
                                <Copy className="h-3.5 w-3.5" />
                                Copy payload
                              </button>
                            </div>

                            {result ? (
                              <div className={`rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-[11px] ${tone}`}>
                                {result.error ? <p>{result.error}</p> : null}
                                {result.message ? <p>{result.message}</p> : null}
                                {txLink ? (
                                  <a
                                    className="mt-1 inline-flex items-center gap-2 font-mono text-[10px] text-emerald-100 underline-offset-4 hover:underline"
                                    href={txLink}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    View transaction
                                  </a>
                                ) : null}
                              </div>
                            ) : null}

                            <p className="text-[10px] uppercase tracking-[0.3em] text-emerald-200/60">
                              {new Date(item.createdAt).toLocaleString('en-US')}
                            </p>
                          </>
                        );
                      })()}
                    </li>
                   ))}
                 </ul>
               )}
             </div>
          </div>

          <div className="rounded-[26px] border border-slate-800/70 bg-slate-950/70 p-5 text-sm sm:rounded-3xl sm:p-6">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-800/60 text-emerald-300">
                  <Download className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-slate-100">Receive tools</h3>
                  <p className="text-xs text-slate-400 sm:max-w-xs">
                    Sync your inbox instantly or use the advanced fallback to decode a payload shared outside the app.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleRefresh}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-600/70 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:border-emerald-400/70 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isLoading}
                >
                  <RotateCcw className="h-4 w-4" />
                  Fetch inbox
                </button>
                <button
                  type="button"
                  onClick={() => setIsManualPanelOpen((prev) => !prev)}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-700/60 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:border-emerald-300/70 hover:text-emerald-100"
                >
                  {isManualPanelOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  {isManualPanelOpen ? 'Hide manual decode' : 'Manual decode'}
                </button>
              </div>
            </header>

            {isManualPanelOpen ? (
              <form className="mt-4 space-y-4" onSubmit={handleImportInbound}>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300" htmlFor="incoming-payload">
                    Base64 inscription payload
                  </label>
                  <textarea
                    id="incoming-payload"
                    className="min-h-[120px] w-full resize-none rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-xs font-mono leading-5 text-slate-100 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/70"
                    placeholder="Paste the Base64 payload from an inscription"
                    value={incomingPayload}
                    onChange={(event) => setIncomingPayload(event.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300" htmlFor="incoming-address">
                    Taproot address (optional)
                  </label>
                  <input
                    id="incoming-address"
                    className="w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-xs font-mono text-slate-100 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/70"
                    placeholder="e.g. tb1p..."
                    value={incomingAddress}
                    onChange={(event) => setIncomingAddress(event.target.value)}
                  />
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 px-4 py-2 text-xs font-semibold text-emerald-200 transition hover:border-emerald-300 hover:text-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isImporting || !incomingPayload.trim()}
                  >
                    {isImporting ? 'Decoding…' : (
                      <>
                        <Download className="h-4 w-4" />
                        Decode payload
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : null}

            {importMessage ? (
              <p className={`mt-3 text-xs ${importMessageClass}`}>{importMessage}</p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

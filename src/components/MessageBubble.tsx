import { Copy, ExternalLink } from 'lucide-react';
import { EphemeralMessage, InscriptionResult } from '@/context/EphemeralContext';

type MessageBubbleProps = {
  message: EphemeralMessage;
  inscriptionLabel?: string | null;
  onInscribe?: () => void | Promise<void>;
  canInscribe?: boolean;
  isInscribing?: boolean;
  inscriptionResult?: InscriptionResult | null;
};

function formatTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp);
}

export function MessageBubble({
  message,
  inscriptionLabel,
  onInscribe,
  canInscribe = false,
  isInscribing = false,
  inscriptionResult = null,
}: MessageBubbleProps) {
  const isOwn = message.direction === 'outbound';
  const roleLabel = isOwn ? 'You' : 'Partner';
  const timestamp = formatTimestamp(message.timestamp);

  const truncatedAddress = `${message.address.slice(0, 10)}…${message.address.slice(-6)}`;

  const containerClasses = isOwn
    ? 'border border-emerald-400/60 bg-gradient-to-br from-emerald-600/90 to-emerald-500/85 text-emerald-50'
    : 'border border-slate-700/70 bg-slate-900/90 text-slate-100';

  const headerTextClass = isOwn ? 'text-emerald-50/85' : 'text-slate-200/85';
  const chipClasses = isOwn
    ? 'border-emerald-200/60 bg-emerald-500/20 text-emerald-50'
    : 'border-slate-500/50 bg-slate-800/70 text-slate-200';
  const footerButtonClasses = isOwn
    ? 'border-emerald-200/60 text-emerald-50 hover:bg-emerald-500/25'
    : 'border-slate-600/60 text-slate-100 hover:bg-slate-800';
  const footerTextClass = isOwn ? 'text-emerald-50/80' : 'text-slate-300/90';
  const timestampClass = isOwn ? 'text-emerald-100/80' : 'text-slate-400/80';

  const walletButtonClasses = isOwn
    ? 'border-emerald-100/70 bg-emerald-50/90 text-emerald-900 hover:bg-emerald-200/70 disabled:bg-emerald-50/50 disabled:text-emerald-900/40 disabled:border-emerald-100/40'
    : 'border-slate-500/50 text-slate-200 hover:bg-slate-800/70 disabled:text-slate-400 disabled:border-slate-600/40 disabled:hover:bg-transparent';

  const resultTone = inscriptionResult
    ? inscriptionResult.success
      ? 'text-emerald-100'
      : 'text-rose-200'
    : null;

  const txid = message.txid ?? inscriptionResult?.txid;
  const txLink = txid ? `https://mempool.space/testnet/tx/${txid}` : null;

  const statusCopy = inscriptionResult
    ? inscriptionResult.error ?? inscriptionResult.message ?? null
    : null;

  const isAlreadyInscribed = Boolean(message.txid);

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch (error) {
      console.warn('Copy failed', error);
    }
  };

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} px-1 sm:px-2`}>
      <article
        className={`max-w-[92%] rounded-3xl border text-sm shadow-lg transition sm:max-w-[80%] lg:max-w-[70%] xl:max-w-[620px] ${containerClasses}`}
      >
        <header className={`flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3 text-sm sm:px-5 ${headerTextClass}`}>
          <span className="font-semibold tracking-tight">{roleLabel}</span>
          {inscriptionLabel ? (
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-mono tracking-[0.18em] ${chipClasses}`}
            >
              {inscriptionLabel}
            </span>
          ) : null}
          <span className="hidden text-xs opacity-60 sm:inline">•</span>
          <button
            type="button"
            onClick={() => handleCopy(message.address)}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-xs tracking-[0.18em] transition ${chipClasses}`}
          >
            {truncatedAddress}
            <Copy className="h-3.5 w-3.5" />
          </button>
        </header>

        <div className="space-y-4 px-4 py-4 sm:px-5">
          <p className="whitespace-pre-wrap break-words text-base leading-relaxed sm:text-[15px]">
            {message.content}
          </p>

          <footer className={`flex flex-wrap items-center gap-3 text-sm ${footerTextClass}`}>
            <span className="font-semibold">{isOwn ? 'Sent' : 'Received'}</span>
            <span className={`text-xs font-mono ${timestampClass}`}>{timestamp}</span>
            <button
              type="button"
              onClick={() => handleCopy(message.encrypted)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition ${footerButtonClasses}`}
            >
              Copy encrypted
            </button>
            {isOwn && !isAlreadyInscribed ? (
              <button
                type="button"
                onClick={onInscribe}
                disabled={!onInscribe || !canInscribe || isInscribing}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition ${walletButtonClasses}`}
              >
                {isInscribing ? 'Inscribing…' : 'Inscribe via UniSat'}
              </button>
            ) : null}
            {isOwn && isAlreadyInscribed && txLink ? (
              <a
                href={txLink}
                target="_blank"
                rel="noreferrer"
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition ${walletButtonClasses}`}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View on mempool
              </a>
            ) : null}
          </footer>

          {isOwn && isAlreadyInscribed && !statusCopy ? (
            <div className="rounded-2xl border border-white/10 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-100/90">
              <div className="flex items-start gap-2">
                <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-emerald-50/80" />
                <div className="space-y-1">
                  <p className="font-medium">✓ Already on blockchain</p>
                  <p className="text-emerald-100/70">This message was found on Bitcoin Testnet</p>
                </div>
              </div>
            </div>
          ) : null}
          
          {isOwn && (statusCopy || (txLink && inscriptionResult)) ? (
            <div
              className={`rounded-2xl border border-white/10 px-4 py-3 text-xs ${resultTone ?? 'text-emerald-100/80'}`}
            >
              <div className="flex items-start gap-2">
                <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-emerald-50/80" />
                <div className="space-y-1">
                  {statusCopy ? <p>{statusCopy}</p> : null}
                  {txLink && inscriptionResult ? (
                    <a
                      className="inline-flex items-center gap-2 font-mono text-[11px] text-emerald-50 underline-offset-4 hover:underline"
                      href={txLink}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View on mempool.space
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </article>
    </div>
  );
}

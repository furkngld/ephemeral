import * as bitcoin from "bitcoinjs-lib";

export type SimulatedInscription = {
  id: string;
  address: string;
  payload: string;
  timestamp: number;
  senderAddress?: string;
};

const STORAGE_PREFIX = "ephemeral::inbox::";

const encoder = new TextEncoder();

function requireBrowserStorage() {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  return window.localStorage;
}

function requireCrypto() {
  if (typeof window === "undefined") {
    throw new Error("Web Crypto API is not available in this environment.");
  }

  const api = globalThis.crypto;

  if (!api || !api.subtle) {
    throw new Error("Web Crypto API is not available in this environment.");
  }

  return api;
}

async function inboxKeyFor(secret: string) {
  const cryptoApi = requireCrypto();
  const digest = await cryptoApi.subtle.digest(
    "SHA-256",
    encoder.encode(secret.normalize("NFKD")),
  );

  return (
    STORAGE_PREFIX +
    Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")
  );
}

function parseInscriptions(raw: string | null) {
  if (!raw) {
    return [] as SimulatedInscription[];
  }

  try {
    const parsed = JSON.parse(raw) as SimulatedInscription[];
    return parsed;
  } catch (error) {
  console.warn("Failed to parse simulated inscription data", error);
    return [];
  }
}

function persistInscriptions(key: string, data: SimulatedInscription[]) {
  const storage = requireBrowserStorage();

  if (!storage) {
    return;
  }

  storage.setItem(key, JSON.stringify(data));
}


function extractOpReturnData(txHex: string): string | null {
  try {
    const transaction = bitcoin.Transaction.fromHex(txHex);

    for (const output of transaction.outs) {
      const chunks = bitcoin.script.decompile(output.script);

      if (!chunks || chunks.length === 0) {
        continue;
      }

      const [op, data] = chunks;

      if (op === bitcoin.opcodes.OP_RETURN && Buffer.isBuffer(data)) {
        const text = data.toString("utf-8").trim();

        if (text.length) {
          return text;
        }
      }
    }

    return null;
  } catch (error) {
    console.warn("Failed to extract OP_RETURN data:", error);
    return null;
  }
}


async function fetchRealBlockchainTransactions(
  addresses: string[],
): Promise<SimulatedInscription[]> {
  if (addresses.length === 0) {
    return [];
  }

  const results: SimulatedInscription[] = [];
  const addressSet = new Set(addresses.map(a => a.toLowerCase()));

  for (const address of addresses) {
    try {
      const response = await fetch(
        `https://mempool.space/testnet/api/address/${address}/txs`,
      );

      if (!response.ok) {
        console.warn(`Failed to fetch transactions for ${address}`);
        continue;
      }

      const txs = (await response.json()) as Array<{
        txid: string;
        status: { confirmed: boolean; block_time?: number };
        vout: Array<{
          scriptpubkey_address?: string;
          scriptpubkey?: string;
          value: number;
        }>;
        vin: Array<{
          prevout?: {
            scriptpubkey_address?: string;
          };
        }>;
      }>;

      for (const tx of txs) {
        const isRecipient = tx.vout.some(
          (output) => output.scriptpubkey_address === address,
        );

        if (!isRecipient) {
          continue;
        }
        
        let senderAddress: string | undefined;
        if (tx.vin && tx.vin.length > 0 && tx.vin[0].prevout?.scriptpubkey_address) {
          senderAddress = tx.vin[0].prevout.scriptpubkey_address;
        }

        const confirmed = Boolean(tx.status.confirmed);

        try {
          const txHexResponse = await fetch(
            `https://mempool.space/testnet/api/tx/${tx.txid}/hex`,
          );

          if (!txHexResponse.ok) {
            console.warn(
              `[Blockchain] Failed to fetch hex for tx ${tx.txid}: ${txHexResponse.status} ${txHexResponse.statusText}`,
            );
            continue;
          }

          const txHex = await txHexResponse.text();
          const opReturnData = extractOpReturnData(txHex);

          if (!opReturnData || !opReturnData.trim()) {
            continue;
          }

          let timestampMs = (tx.status.block_time ?? 0) * 1000;

          if (!timestampMs) {
            try {
              const metadataResponse = await fetch(
                `https://mempool.space/testnet/api/tx/${tx.txid}`,
              );

              if (metadataResponse.ok) {
                const metadata = (await metadataResponse.json()) as {
                  status?: { block_time?: number; confirmed?: boolean };
                  firstSeen?: number;
                  first_seen?: number;
                  received?: number;
                  time?: number;
                };

                const candidateTimes = [
                  metadata.received,
                  metadata.firstSeen,
                  metadata.first_seen,
                  metadata.time,
                  metadata.status?.block_time,
                ].filter((value): value is number => typeof value === "number" && value > 0);

                if (candidateTimes.length) {
                  timestampMs = candidateTimes[0] * 1000;
                }
              }
            } catch (metadataError) {
              console.warn(
                `[Blockchain] Failed to fetch metadata for tx ${tx.txid}:`,
                metadataError,
              );
            }

            if (!timestampMs) {
              timestampMs = Date.now();
            }
          }

          console.info(
            `[Blockchain] Found payload in tx ${tx.txid} (${confirmed ? 'confirmed' : 'mempool'})`,
            senderAddress ? `from ${senderAddress}` : ''
          );

          results.push({
            id: tx.txid,
            address,
            payload: opReturnData,
            timestamp: timestampMs,
            senderAddress,
          });
        } catch (txError) {
          console.warn(`Failed to process transaction ${tx.txid}:`, txError);
        }
      }
    } catch (error) {
      console.error(`Error fetching transactions for ${address}:`, error);
    }
  }

  return results;
}

export async function fetchSimulatedInscriptions(
  secret: string,
  addresses: string[],
) {
  if (addresses.length === 0) {
    return [] as SimulatedInscription[];
  }

  const results: SimulatedInscription[] = [];

  try {
    console.info('[Blockchain] Fetching transactions from mempool.space...');
    const blockchainTxs = await fetchRealBlockchainTransactions(addresses);
    results.push(...blockchainTxs);
    console.info(`[Blockchain] Found ${blockchainTxs.length} transactions with payloads`);
  } catch (error) {
    console.error('[Blockchain] Failed to fetch transactions:', error);
  }

  const storage = requireBrowserStorage();
  if (storage && results.length === 0) {
    console.info('[Blockchain] No blockchain results, checking localStorage fallback...');
    const key = await inboxKeyFor(secret);
    const existing = parseInscriptions(storage.getItem(key));
    const matching = existing.filter((item) => addresses.includes(item.address));

    if (matching.length) {
      console.info(`[Blockchain] Found ${matching.length} local messages`);
      const remaining = existing.filter(
        (item) => !matching.some((target) => target.id === item.id),
      );
      persistInscriptions(key, remaining);
      results.push(...matching);
    }
  }

  return results.sort((a, b) => a.timestamp - b.timestamp);
}

export async function enqueueSimulatedInbound(
  secret: string,
  inscription: Omit<SimulatedInscription, "id" | "timestamp">,
) {
  const storage = requireBrowserStorage();

  if (!storage) {
  console.warn("Browser storage unavailable; simulated inbound could not be saved.");
    return;
  }

  const key = await inboxKeyFor(secret);
  const payloads = parseInscriptions(storage.getItem(key));

  payloads.push({
    ...inscription,
    id:
      globalThis.crypto?.randomUUID?.() ??
      Math.random().toString(36).slice(2, 10),
    timestamp: Date.now(),
  });

  persistInscriptions(key, payloads);
}

if (typeof window !== "undefined") {
  (window as typeof window & {
    EphemeralSim?: {
      enqueueInbound: typeof enqueueSimulatedInbound;
    };
  }).EphemeralSim = {
    enqueueInbound: enqueueSimulatedInbound,
  };
}

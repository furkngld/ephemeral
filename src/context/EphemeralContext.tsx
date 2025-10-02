'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as bip39 from 'bip39';
import { deriveTaprootAddresses } from '@/lib/bitcoin';
import { decryptMessage, encryptMessage } from '@/lib/crypto';
import {
  fetchSimulatedInscriptions,
  SimulatedInscription,
} from '@/lib/blockchain';

export type EphemeralMessageDirection = 'outbound' | 'inbound';

export type EphemeralMessage = {
  id: string;
  direction: EphemeralMessageDirection;
  content: string;
  encrypted: string;
  address: string;
  timestamp: number;
};

export type OutboundInstruction = {
  id: string;
  address: string;
  payload: string;
  createdAt: number;
  message: string;
};

export type InscriptionResult = {
  success: boolean;
  txid?: string | null;
  error?: string | null;
  message?: string | null;
};

type InscribeRequest = {
  id?: string;
  address: string;
  payload: string;
  message?: string;
  feeRate?: number;
};

type EphemeralContextValue = {
  isLoggedIn: boolean;
  isLoading: boolean;
  error: string | null;
  addresses: string[];
  messages: EphemeralMessage[];
  pendingOutbound: OutboundInstruction[];
  isWalletAvailable: boolean;
  isWalletConnecting: boolean;
  walletAddress: string | null;
  walletNetwork: string | null;
  walletError: string | null;
  acknowledgeOutbound: (id: string) => void;
  connectWallet: () => Promise<void>;
  login: (secret: string) => Promise<void>;
  sendMessage: (message: string) => Promise<void>;
  checkForMessages: () => Promise<void>;
  importInbound: (payload: string, address?: string) => Promise<boolean>;
  inscribeWithWallet: (request: InscribeRequest) => Promise<InscriptionResult>;
  inscribing: Record<string, boolean>;
  inscriptionResults: Record<string, InscriptionResult>;
};

const EphemeralContext = createContext<EphemeralContextValue | null>(null);

const DEFAULT_ADDRESS_COUNT = 8;

function normaliseMnemonic(mnemonic: string) {
  return mnemonic.trim().replace(/\s+/g, ' ').toLowerCase();
}

function normaliseNetworkName(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const lowered = value.toString().toLowerCase();

  if (lowered.includes('test')) {
    return 'testnet';
  }

  if (lowered.includes('signet')) {
    return 'signet';
  }

  if (lowered.includes('main') || lowered.includes('live')) {
    return 'mainnet';
  }

  return value.toString();
}

function extractNetworkName(info: unknown) {
  if (!info || typeof info !== 'object') {
    return null;
  }

  const source = info as Record<string, unknown>;
  const candidate =
    (source.network as string | undefined) ??
    (source.net as string | undefined) ??
    (source.chain as string | undefined) ??
    null;

  return normaliseNetworkName(candidate);
}

function inferNetworkFromAddress(address: string | null | undefined) {
  if (!address) {
    return null;
  }

  const lowered = address.toLowerCase();

  if (lowered.startsWith('tb1') || lowered.startsWith('bcrt') || lowered.startsWith('m') || lowered.startsWith('n') || lowered.startsWith('2')) {
    return 'testnet';
  }

  if (lowered.startsWith('bc1') || lowered.startsWith('1') || lowered.startsWith('3')) {
    return 'mainnet';
  }

  return null;
}

const DEFAULT_UNISAT_REQUEST_METHODS = [
  'unisat_inscribe',
  'ordinals_inscribe',
  'ord_inscribe',
  'ordinals.createInscription',
  'inscribe',
  'unisat_pushInscribe',
  'ordinals_pushInscribe',
  'ordinals.pushInscribe',
];

const EXCLUDED_INSCRIBE_KEYWORDS = [
  'order',
  'brc20',
  'brc-20',
  'ticker',
];

function shouldSkipInscribeHandler(label: string) {
  const normalized = label.replace(/[^a-z0-9]/gi, '').toLowerCase();
  
  // Only skip if it contains order/brc20/ticker keywords
  // BUT allow plain "inscribe" methods even if they contain other text
  const hasExcludedKeyword = EXCLUDED_INSCRIBE_KEYWORDS.some((keyword) => 
    normalized.includes(keyword)
  );
  
  // If it has an excluded keyword, make sure it's not just a simple inscribe method
  if (hasExcludedKeyword) {
    const isSimpleInscribe = normalized === 'inscribe' || 
                            normalized.endsWith('inscribe') ||
                            normalized.includes('pushinscribe');
    return !isSimpleInscribe;
  }
  
  return false;
}

function parseConfiguredInscribeMethods() {
  const raw = process.env.NEXT_PUBLIC_UNISAT_INSCRIBE_METHODS;

  if (!raw) {
    return [] as string[];
  }

  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

type BoundInscribeHandler = {
  label: string;
  invoke: (payload: UniSatInscribeOptions) => Promise<unknown>;
};

function discoverInscribeHandlers(
  source: unknown,
  basePath: string[] = [],
  visited: WeakSet<object> = new WeakSet(),
): BoundInscribeHandler[] {
  if (!source || typeof source !== 'object') {
    return [];
  }

  if (visited.has(source as object)) {
    return [];
  }

  visited.add(source as object);

  let keys: string[] = [];
  try {
    keys = Object.getOwnPropertyNames(source);
  } catch (err) {
    console.warn('[Ephemeral] Unable to inspect UniSat object', {
      path: basePath.join('.'),
      error: err,
    });
    return [];
  }

  const results: BoundInscribeHandler[] = [];

  for (const key of keys) {
    const value = (source as Record<string, unknown>)[key];
    const nextPath = [...basePath, key];

    if (typeof value === 'function') {
      if (key.toLowerCase().includes('inscrib')) {
        const label = nextPath.join('.');

        if (shouldSkipInscribeHandler(label)) {
          continue;
        }

        const bound = value.bind(source) as (payload: UniSatInscribeOptions) => Promise<unknown>;
        results.push({
          label,
          invoke: (payload) => bound(payload),
        });
      }
      continue;
    }

    if (value && typeof value === 'object' && nextPath.length <= 4) {
      results.push(...discoverInscribeHandlers(value, nextPath, visited));
    }
  }

  return results;
}

function expandRequestMethodVariants(label: string) {
  const variants = new Set<string>();
  const sanitized = label.replace(/\s+/g, '');

  variants.add(sanitized);
  variants.add(sanitized.replace(/\./g, '_'));
  variants.add(sanitized.replace(/\./g, '/'));
  variants.add(sanitized.replace(/\./g, ''));

  return Array.from(variants).filter(Boolean);
}

// Kept for future reference - UniSat API is currently broken for text inscriptions
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function invokeUniSatInscribe(
  unisat: UniSatWallet,
  options: UniSatInscribeOptions,
) {
  const allErrors: Array<{ label: string; error: unknown }> = [];
  const attemptedLabels = new Set<string>();

  const recordFailure = (label: string, error: unknown) => {
    allErrors.push({ label, error });
    console.warn('[Ephemeral] UniSat inscription pathway failed', {
      label,
      error,
    });
  };

  if (typeof unisat.inscribe === 'function') {
    attemptedLabels.add('unisat.inscribe');
    try {
      return await unisat.inscribe(options);
    } catch (error) {
      recordFailure('unisat.inscribe', error);
    }
  }

  const requestFns: Array<
    (method: string | { method: string; params?: unknown }, params?: unknown) => Promise<unknown>
  > = [];

  if (typeof unisat.request === 'function') {
    const walletRequest = unisat.request.bind(unisat) as (...args: unknown[]) => Promise<unknown>;

    requestFns.push((method, params) =>
      params === undefined ? walletRequest(method) : walletRequest(method, params),
    );
  }

  if (typeof unisat.provider?.request === 'function') {
    const providerRequest = unisat.provider.request.bind(
      unisat.provider,
    ) as (...args: unknown[]) => Promise<unknown>;

    requestFns.push((method, params) =>
      params === undefined ? providerRequest(method) : providerRequest(method, params),
    );
  }

  if (typeof unisat.ordinals?.request === 'function') {
    const ordinalsRequest = unisat.ordinals.request.bind(
      unisat.ordinals,
    ) as (method: string, params?: unknown) => Promise<unknown>;

    requestFns.push((method, params) => {
      if (typeof method === 'string') {
        return ordinalsRequest(method, params);
      }

      const combinedParams = method.params ?? params;
      return ordinalsRequest(method.method, combinedParams);
    });
  }

  const enableAttempts: Array<{ label: string; call: () => Promise<unknown> }> = [];

  if (typeof unisat.ordinals?.enable === 'function') {
    enableAttempts.push({
      label: 'ordinals.enable',
      call: () => unisat.ordinals!.enable!({ network: 'testnet' }),
    });
  }

  const uniqueRequestFns = Array.from(new Set(requestFns));

  uniqueRequestFns.forEach((fn, index) => {
    const requestLabelBase = `request#${index + 1}:ordinals_enable`;

    enableAttempts.push({
      label: `${requestLabelBase}:object`,
      call: () => fn({ method: 'ordinals_enable', params: [{ network: 'testnet' }] }),
    });

    enableAttempts.push({
      label: `${requestLabelBase}:tuple`,
      call: () => fn('ordinals_enable', [{ network: 'testnet' }]),
    });
  });

  for (const attempt of enableAttempts) {
    attemptedLabels.add(attempt.label);
    try {
      await attempt.call();
    } catch (error) {
      recordFailure(attempt.label, error);
    }
  }

  const directHandlers: BoundInscribeHandler[] = [];

  if (typeof unisat.ordinals?.inscribe === 'function' && !shouldSkipInscribeHandler('ordinals.inscribe')) {
    directHandlers.push({
      label: 'ordinals.inscribe',
      invoke: (payload) => unisat.ordinals!.inscribe!(payload),
    });
  }

  if (
    typeof unisat.ordinals?.pushInscribe === 'function' &&
    !shouldSkipInscribeHandler('ordinals.pushInscribe')
  ) {
    directHandlers.push({
      label: 'ordinals.pushInscribe',
      invoke: (payload) => unisat.ordinals!.pushInscribe!(payload),
    });
  }

  const discoveredHandlers = discoverInscribeHandlers(unisat);

  for (const handler of discoveredHandlers) {
    if (shouldSkipInscribeHandler(handler.label)) {
      continue;
    }

    if (!directHandlers.some((existing) => existing.label === handler.label)) {
      directHandlers.push(handler);
    }
  }

  for (const handler of directHandlers) {
    attemptedLabels.add(handler.label);

    try {
      return await handler.invoke(options);
    } catch (error) {
      recordFailure(handler.label, error);
    }
  }

  if (uniqueRequestFns.length) {
    const configuredMethods = parseConfiguredInscribeMethods();
    const methodCandidates = new Set<string>([...DEFAULT_UNISAT_REQUEST_METHODS, ...configuredMethods]);

    for (const configured of configuredMethods) {
      for (const variant of expandRequestMethodVariants(configured)) {
        methodCandidates.add(variant);
      }
    }

    for (const handler of directHandlers) {
      for (const variant of expandRequestMethodVariants(handler.label)) {
        methodCandidates.add(variant);
      }
    }

    const payloadVariants: UniSatInscribeOptions[] = [
      // Primary payload without options to avoid BRC-20 detection
      {
        address: options.address,
        content: options.content,
        contentType: options.contentType,
        feeRate: options.feeRate,
      },
      // Fallback with original options if needed
      options,
    ];

    const filteredCandidates = Array.from(methodCandidates).filter(
      (method) => !shouldSkipInscribeHandler(method),
    );

    for (const method of filteredCandidates) {
      for (const payload of payloadVariants) {
        for (const [requestIndex, requestFn] of uniqueRequestFns.entries()) {
          const requestShapes: Array<
            | { method: string; params?: unknown }
            | [string, unknown]
            | [string, unknown[]]
          > = [
            { method, params: [payload] },
            { method, params: payload },
            [method, [payload]],
            [method, payload],
          ];

          for (const shape of requestShapes) {
            const labelBase = `request#${requestIndex + 1}:${method}`;
            attemptedLabels.add(labelBase);
            try {
              if (Array.isArray(shape)) {
                const [methodName, paramsArg] = shape;
                return await requestFn(methodName, paramsArg);
              }

              return await requestFn(shape);
            } catch (error) {
              recordFailure(labelBase, { error, payload, shape });
            }
          }
        }
      }
    }
  }

  const helpMessage =
    'UniSat wallet did not expose any inscription RPCs. Enable the Ordinals module (Settings → Experimental → Inscriptions) in UniSat, refresh, and retry. You can also provide additional RPC method names via NEXT_PUBLIC_UNISAT_INSCRIBE_METHODS.';

  if (allErrors.length) {
    const lastMeaningful = [...allErrors].reverse().find((item) => item.error instanceof Error);

    if (lastMeaningful?.error instanceof Error) {
      const attemptedSummary = Array.from(attemptedLabels).join(', ');
      const mergedError = new Error(
        `${helpMessage}${attemptedSummary ? ` Attempted methods: ${attemptedSummary}.` : ''} (Last error: ${lastMeaningful.error.message})`,
      );
      (mergedError as Error & { cause?: unknown }).cause = lastMeaningful.error;
      throw mergedError;
    }
  }

  const attemptedSummary = Array.from(attemptedLabels).join(', ');

  throw new Error(
    `${helpMessage}${attemptedSummary ? ` Attempted methods: ${attemptedSummary}.` : ''}`,
  );
}

function sortMessages(messages: EphemeralMessage[]) {
  return [...messages].sort((a, b) => a.timestamp - b.timestamp);
}

async function decryptInscription(
  secret: string,
  inscription: SimulatedInscription,
) {
  const decrypted = await decryptMessage(secret, inscription.payload);

  if (!decrypted) {
    return null;
  }

  return {
    id: inscription.id,
    direction: 'inbound' as const,
    content: decrypted,
    encrypted: inscription.payload,
    address: inscription.address,
    timestamp: inscription.timestamp,
  } satisfies EphemeralMessage;
}

export function EphemeralProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [secret, setSecret] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<string[]>([]);
  const [messages, setMessages] = useState<EphemeralMessage[]>([]);
  const [pendingOutbound, setPendingOutbound] = useState<OutboundInstruction[]>([]);
  const [isWalletAvailable, setIsWalletAvailable] = useState(false);
  const [isWalletConnecting, setIsWalletConnecting] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletNetwork, setWalletNetwork] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [inscribing, setInscribing] = useState<Record<string, boolean>>({});
  const [inscriptionResults, setInscriptionResults] =
    useState<Record<string, InscriptionResult>>({});

  const seenInscriptionIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const unisat = window.unisat;

    if (!unisat) {
      setIsWalletAvailable(false);
      return;
    }

    setIsWalletAvailable(true);

    const syncWalletState = async () => {
      let fallbackNetwork: string | null = null;

      try {
        const accounts = await unisat.getAccounts();
        const primaryAccount = accounts?.[0] ?? null;
        setWalletAddress(primaryAccount);
        fallbackNetwork = inferNetworkFromAddress(primaryAccount);

        if (fallbackNetwork) {
          setWalletNetwork((prev) => prev ?? fallbackNetwork);
        }
      } catch (err) {
        console.warn('Unable to read UniSat accounts', err);
      }

      try {
        const networkInfo = await unisat.getNetwork();
        const resolvedNetwork = extractNetworkName(networkInfo) ?? fallbackNetwork;
        setWalletNetwork(resolvedNetwork ?? null);
      } catch (err) {
        console.warn('Unable to read UniSat network', err);
      }
    };

    void syncWalletState();

    const handleAccountsChanged = (accounts: string[]) => {
      const primaryAccount = accounts?.[0] ?? null;
      setWalletAddress(primaryAccount);

      const inferred = inferNetworkFromAddress(primaryAccount);
      if (inferred) {
        setWalletNetwork((prev) => prev ?? inferred);
      }
    };

    const handleNetworkChanged = (result: UniSatNetworkResult) => {
      setWalletNetwork(extractNetworkName(result));
    };

    unisat.on?.('accountsChanged', handleAccountsChanged);
    unisat.on?.('networkChanged', handleNetworkChanged);

    return () => {
      unisat.removeListener?.('accountsChanged', handleAccountsChanged);
      unisat.removeListener?.('networkChanged', handleNetworkChanged);
    };
  }, []);

  const acknowledgeOutbound = useCallback((id: string) => {
    setPendingOutbound((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const connectWallet = useCallback(async () => {
    if (typeof window === 'undefined' || !window.unisat) {
      setWalletError('UniSat wallet extension not detected. Install it and refresh this page.');
      setIsWalletAvailable(false);
      return;
    }

    setIsWalletConnecting(true);

    try {
      setWalletError(null);

      const initialNetworkInfo = await window.unisat.getNetwork();
      let currentNetwork = extractNetworkName(initialNetworkInfo);

      if (currentNetwork !== 'testnet' && window.unisat.switchNetwork) {
        try {
          const switchedInfo = await window.unisat.switchNetwork('testnet');
          currentNetwork = extractNetworkName(switchedInfo) ?? currentNetwork;
        } catch (switchError) {
          console.warn('Failed to switch UniSat network', switchError);
          setWalletError('Please switch your UniSat wallet to Bitcoin Testnet and try again.');
        }
      }

      const accounts = await window.unisat.requestAccounts();
      const primaryAccount = accounts?.[0] ?? null;
      setWalletAddress(primaryAccount);

      const accountInferredNetwork = inferNetworkFromAddress(primaryAccount);
      if (accountInferredNetwork) {
        setWalletNetwork((prev) => prev ?? accountInferredNetwork);
      }

      const latestNetworkInfo = await window.unisat.getNetwork();
      const latestNetwork = extractNetworkName(latestNetworkInfo);
      const effectiveNetwork = latestNetwork ?? currentNetwork ?? accountInferredNetwork ?? null;
      const normalizedEffective = effectiveNetwork
        ? normaliseNetworkName(effectiveNetwork)
        : null;
      setWalletNetwork(normalizedEffective ?? effectiveNetwork ?? null);

      if ((normalizedEffective ?? effectiveNetwork) !== 'testnet') {
        setWalletError('Connected wallet is not on Bitcoin Testnet. Switch networks to continue.');
      } else {
        setWalletError(null);
      }

      setIsWalletAvailable(true);
    } catch (err) {
      console.error('Wallet connection failed', err);
      setWalletError('Could not connect to UniSat wallet. Approve the request and retry.');
    } finally {
      setIsWalletConnecting(false);
    }
  }, []);

  const login = useCallback(async (rawSecret: string) => {
    // Ensure we're in browser environment before attempting crypto operations
    if (typeof window === 'undefined') {
      setError('Login must be performed in a browser environment.');
      setIsLoggedIn(false);
      return;
    }

    const normalised = normaliseMnemonic(rawSecret);
    const words = normalised.split(' ');

    if (words.length !== 12) {
      setError('The secret phrase must contain exactly 12 words.');
      setIsLoggedIn(false);
      return;
    }

    if (!bip39.validateMnemonic(normalised)) {
      setError('The provided secret phrase is not a valid BIP39 mnemonic.');
      setIsLoggedIn(false);
      return;
    }

    setIsLoading(true);

    try {
      const derivedAddresses = await deriveTaprootAddresses(
        normalised,
        DEFAULT_ADDRESS_COUNT,
      );
      const inscriptions = await fetchSimulatedInscriptions(
        normalised,
        derivedAddresses,
      );

      const decryptedMessages = (
        await Promise.all(
          inscriptions.map((inscription) =>
            decryptInscription(normalised, inscription),
          ),
        )
      ).filter(Boolean) as EphemeralMessage[];

      seenInscriptionIds.current = new Set(
        decryptedMessages.map((message) => message.id),
      );

      setSecret(normalised);
      setAddresses(derivedAddresses);
      setMessages(sortMessages(decryptedMessages));
      setPendingOutbound([]);
      setIsLoggedIn(true);
      setError(null);
    } catch (err) {
      console.error('Login failed', err);
      setError('We could not derive your keys. Please retry with a valid mnemonic.');
      setIsLoggedIn(false);
      setSecret(null);
      setAddresses([]);
      setMessages([]);
      setPendingOutbound([]);
      seenInscriptionIds.current = new Set();
    } finally {
      setIsLoading(false);
    }
  }, []);

  const sendMessage = useCallback(
    async (rawMessage: string) => {
      if (!secret) {
        throw new Error('User not authenticated.');
      }

      const message = rawMessage.trim();

      if (!message) {
        return;
      }

      if (!addresses.length) {
        throw new Error('No taproot addresses are available.');
      }

      setIsLoading(true);

      try {
        const encrypted = await encryptMessage(secret, message);
        let targetAddress = addresses[0];
        const timestamp = Date.now();
        const id =
          globalThis.crypto?.randomUUID?.() ??
          Math.random().toString(36).slice(2, 10);

        setMessages((prev) => {
          const outboundCount = prev.filter(
            (item) => item.direction === 'outbound',
          ).length;
          targetAddress =
            addresses[outboundCount % addresses.length] ?? addresses[0];

          return sortMessages([
            ...prev,
            {
              id,
              direction: 'outbound',
              content: message,
              encrypted,
              address: targetAddress,
              timestamp,
            },
          ]);
        });

        setPendingOutbound((prev) => [
          ...prev,
          {
            id,
            address: targetAddress,
            payload: encrypted,
            createdAt: timestamp,
            message,
          },
        ]);
        setError(null);
      } catch (err) {
        console.error('Message send failed', err);
        setError('We could not encrypt the message. Please try again.');
      } finally {
        setIsLoading(false);
      }
    },
    [addresses, secret],
  );

  const importInbound = useCallback(
    async (payload: string, address?: string) => {
      if (!secret) {
        throw new Error('User not authenticated.');
      }

      const trimmedPayload = payload.trim();

      if (!trimmedPayload) {
        setError('Inbound payload cannot be empty.');
        return false;
      }

      try {
        const decrypted = await decryptMessage(secret, trimmedPayload);

        if (!decrypted) {
          setError('We could not decrypt the supplied payload.');
          return false;
        }

        const timestamp = Date.now();
        const id =
          globalThis.crypto?.randomUUID?.() ??
          Math.random().toString(36).slice(2, 10);
        const resolvedAddress = address?.trim() || addresses[0] || 'unknown-address';

        setMessages((prev) =>
          sortMessages([
            ...prev,
            {
              id,
              direction: 'inbound',
              content: decrypted,
              encrypted: trimmedPayload,
              address: resolvedAddress,
              timestamp,
            },
          ]),
        );

        setError(null);
        return true;
      } catch (err) {
        console.error('Inbound payload import failed', err);
        setError('We could not import that inscription payload.');
        return false;
      }
    },
    [addresses, secret],
  );

  const checkForMessages = useCallback(async () => {
    if (!secret) {
      throw new Error('User not authenticated.');
    }

    if (!addresses.length) {
      return;
    }

    setIsLoading(true);

    try {
      const inscriptions = await fetchSimulatedInscriptions(secret, addresses);

      if (!inscriptions.length) {
        setError(null);
        return;
      }

      const candidates = (
        await Promise.all(
          inscriptions.map(async (inscription) => {
            if (seenInscriptionIds.current.has(inscription.id)) {
              return null;
            }

            const decrypted = await decryptInscription(secret, inscription);

            if (!decrypted) {
              return null;
            }

            seenInscriptionIds.current.add(inscription.id);
            return decrypted;
          }),
        )
      ).filter(Boolean) as EphemeralMessage[];

      if (candidates.length) {
        setMessages((prev) => sortMessages([...prev, ...candidates]));
      }

      setError(null);
    } catch (err) {
      console.error('Messages could not be fetched', err);
      setError('We could not read inscriptions from the chain.');
    } finally {
      setIsLoading(false);
    }
  }, [addresses, secret]);

  const inscribeWithWallet = useCallback(
    async ({ id, address, payload }: InscribeRequest) => {
      const trimmedPayload = payload.trim();
      const key = id ?? `${address}:${trimmedPayload.slice(0, 16)}`;

      if (!trimmedPayload) {
        const result: InscriptionResult = {
          success: false,
          txid: null,
          error: 'Cannot inscribe an empty payload.',
        };
        setInscriptionResults((prev) => ({ ...prev, [key]: result }));
        return result;
      }

      if (typeof window === 'undefined' || !window.unisat) {
        const errorMessage =
          'UniSat wallet extension not detected. Install it and refresh this page.';
        setWalletError(errorMessage);
        const result: InscriptionResult = {
          success: false,
          txid: null,
          error: errorMessage,
        };
        setInscriptionResults((prev) => ({ ...prev, [key]: result }));
        return result;
      }

      setInscribing((prev) => ({ ...prev, [key]: true }));
      setWalletError(null);
      setInscriptionResults((prev) => ({
        ...prev,
        [key]: { success: false, txid: null, error: null, message: null },
      }));

      try {
        const accounts = await window.unisat.requestAccounts();
        const primaryAccount = accounts?.[0] ?? null;
        setWalletAddress(primaryAccount);

        const accountInferredNetwork = inferNetworkFromAddress(primaryAccount);
        if (accountInferredNetwork) {
          setWalletNetwork((prev) => prev ?? accountInferredNetwork);
        }

        const networkInfo = await window.unisat.getNetwork();
        let network = extractNetworkName(networkInfo) ?? accountInferredNetwork;

        if (network !== 'testnet' && window.unisat.switchNetwork) {
          try {
            const switched = await window.unisat.switchNetwork('testnet');
            network = extractNetworkName(switched) ?? network ?? accountInferredNetwork;
          } catch (switchError) {
            console.warn('Failed to switch UniSat network', switchError);
            const result: InscriptionResult = {
              success: false,
              txid: null,
              error: 'Please switch your UniSat wallet to Bitcoin Testnet and try again.',
            };
            setWalletError(result.error ?? null);
            setInscriptionResults((prev) => ({ ...prev, [key]: result }));
            return result;
          }
        }

        const normalizedNetwork = network ? normaliseNetworkName(network) : null;

        if (normalizedNetwork !== 'testnet') {
          const errorMessage =
            'UniSat wallet is not connected to Bitcoin Testnet. Switch networks and retry.';
          setWalletError(errorMessage);
          const result: InscriptionResult = {
            success: false,
            txid: null,
            error: errorMessage,
          };
          setInscriptionResults((prev) => ({ ...prev, [key]: result }));
          return result;
        }

        setWalletNetwork(normalizedNetwork);
        
        // Create transaction with OP_RETURN for cross-device payload delivery
        console.info('[Ephemeral] Creating OP_RETURN transaction');
        console.info('Target Address:', address);
        console.info('Payload Length:', trimmedPayload.length, 'bytes');
        
        if (!window.unisat.signPsbt || !window.unisat.pushPsbt) {
          const errorMessage = 'UniSat PSBT methods not available. Update your extension.';
          setWalletError(errorMessage);
          const result: InscriptionResult = {
            success: false,
            txid: null,
            error: errorMessage,
          };
          setInscriptionResults((prev) => ({ ...prev, [key]: result }));
          return result;
        }
        
        try {
          // Fetch UTXOs for the sender
          const { fetchUtxos, buildOpReturnTransaction } = await import('@/lib/psbt-builder');
          const utxos = await fetchUtxos(primaryAccount);
          
          if (!utxos.length) {
            throw new Error('No confirmed UTXOs available. Fund your wallet with testnet BTC.');
          }
          
          console.info(`[Ephemeral] Found ${utxos.length} UTXOs`);
          
          // Build unsigned PSBT with OP_RETURN
          const unsignedPsbt = await buildOpReturnTransaction(
            primaryAccount,
            address,
            trimmedPayload,
            utxos,
            12, // fee rate
          );
          
          console.info('[Ephemeral] PSBT created, requesting signature...');
          
          // Sign with UniSat
          const signedPsbt = await window.unisat.signPsbt(unsignedPsbt);
          
          console.info('[Ephemeral] PSBT signed, broadcasting...');
          
          // Broadcast to network
          const txid = await window.unisat.pushPsbt(signedPsbt);
          
          if (!txid) {
            throw new Error('Transaction broadcast returned no txid');
          }
          
          console.info('[Ephemeral] Transaction broadcast:', txid);
          
          const result: InscriptionResult = {
            success: true,
            txid,
            message: [
              '✅ Encrypted message sent to Bitcoin Testnet!',
              '',
              `Transaction ID: ${txid.slice(0, 16)}...`,
              '',
              '📡 Payload embedded in blockchain via OP_RETURN',
              '🌍 Recipients can decrypt from ANY device with the shared mnemonic',
              '',
              'View on mempool.space/testnet',
            ].join('\n'),
          };
          
          setInscriptionResults((prev) => ({ ...prev, [key]: result }));
          return result;
        } catch (psbtError) {
          console.error('[Ephemeral] PSBT broadcast failed:', psbtError);
          
          const errorMessage = psbtError instanceof Error 
            ? psbtError.message 
            : 'Failed to broadcast transaction via UniSat';
          
          const result: InscriptionResult = {
            success: false,
            txid: null,
            error: errorMessage,
            message: [
              'Could not complete on-chain inscription automatically.',
              '',
              'Alternative: Copy the payload below and share it with your recipient directly.',
              'They can import it via the "Receive & decode" panel.',
            ].join('\n'),
          };
          
          setInscriptionResults((prev) => ({ ...prev, [key]: result }));
          return result;
        }
      } catch (err) {
        console.error('Inscribe via UniSat failed', err);
        const errorMessage =
          err instanceof Error ? err.message : 'An unknown error occurred while inscribing.';
        const result: InscriptionResult = {
          success: false,
          txid: null,
          error: errorMessage,
        };
        setInscriptionResults((prev) => ({ ...prev, [key]: result }));
        return result;
      } finally {
        setInscribing((prev) => ({ ...prev, [key]: false }));
      }
    },
    [],
  );

  const value = useMemo(
    () => ({
      isLoggedIn,
      isLoading,
      error,
      addresses,
      messages,
      pendingOutbound,
      isWalletAvailable,
      isWalletConnecting,
      walletAddress,
      walletNetwork,
      walletError,
      acknowledgeOutbound,
      connectWallet,
      login,
      sendMessage,
      checkForMessages,
      importInbound,
      inscribeWithWallet,
      inscribing,
      inscriptionResults,
    }),
    [
      acknowledgeOutbound,
      addresses,
      checkForMessages,
      connectWallet,
      error,
      importInbound,
      isLoading,
      isLoggedIn,
      isWalletAvailable,
      isWalletConnecting,
      login,
      messages,
      pendingOutbound,
      sendMessage,
      walletAddress,
      walletError,
      walletNetwork,
      inscribeWithWallet,
      inscribing,
      inscriptionResults,
    ],
  );

  return (
    <EphemeralContext.Provider value={value}>
      {children}
    </EphemeralContext.Provider>
  );
}

export function useEphemeralContext() {
  const context = useContext(EphemeralContext);

  if (!context) {
    throw new Error('EphemeralContext must be used within its provider.');
  }

  return context;
}

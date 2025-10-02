export {};

declare global {
  type UniSatNetwork = 'livenet' | 'testnet' | 'signet' | string;

  interface UniSatNetworkResult {
    network: UniSatNetwork;
    net?: string;
    chain?: string;
    [key: string]: unknown;
  }

  interface UniSatProvider {
    request<T = unknown>(
      method: string | { method: string; params?: unknown },
      params?: unknown,
    ): Promise<T>;
  }

  interface UniSatOrdinalsAPI {
    enable?(options?: unknown): Promise<unknown>;
    inscribe?(options: UniSatInscribeOptions): Promise<UniSatInscribeResult | string>;
    pushInscribe?(options: UniSatInscribeOptions): Promise<UniSatInscribeResult | string>;
    createInscribeOrder?(options: UniSatInscribeOptions): Promise<UniSatInscribeResult | string>;
    request?<T = unknown>(method: string, params?: unknown): Promise<T>;
  }

  interface UniSatWallet {
    requestAccounts(): Promise<string[]>;
    getAccounts(): Promise<string[]>;
    getNetwork(): Promise<UniSatNetworkResult>;
    switchNetwork(network: UniSatNetwork): Promise<UniSatNetworkResult>;
    request?<T = unknown>(
      method: string | { method: string; params?: unknown },
      params?: unknown,
    ): Promise<T>;
    sendBitcoin?(toAddress: string, amountInSats: number, options?: { inscription?: { contentType: string; body: string } }): Promise<string>;
    signPsbt?(psbt: string, options?: Record<string, unknown>): Promise<string>;
    pushPsbt?(psbt: string): Promise<string>;
    inscribe?(options: UniSatInscribeOptions): Promise<UniSatInscribeResult | string>;
    provider?: UniSatProvider;
    ordinals?: UniSatOrdinalsAPI;
    on?(event: 'accountsChanged', handler: (accounts: string[]) => void): void;
    on?(event: 'networkChanged', handler: (result: UniSatNetworkResult) => void): void;
    removeListener?(event: 'accountsChanged', handler: (accounts: string[]) => void): void;
    removeListener?(event: 'networkChanged', handler: (result: UniSatNetworkResult) => void): void;
  }

  interface UniSatInscribeOptions {
    address: string;
    content: string;
    contentType?: string;
    feeRate?: number;
    options?: Record<string, unknown>;
  }

  interface UniSatInscribeResult {
    txid?: string;
    txId?: string;
    inscriptionId?: string;
    inscription?: string;
    [key: string]: unknown;
  }

  interface Window {
    unisat?: UniSatWallet;
  }
}

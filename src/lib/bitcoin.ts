import { fromSeed } from "bip32";
import * as bip39 from "bip39";
import * as bitcoin from "bitcoinjs-lib";
import * as ecc from "tiny-secp256k1";

bitcoin.initEccLib(ecc);

const TESTNET = bitcoin.networks.testnet;

function requireCrypto() {
  // Ensure we're in browser environment
  if (typeof window === "undefined") {
    throw new Error("Web Crypto API is not available in this environment.");
  }

  const api = globalThis.crypto;

  if (!api || !api.getRandomValues) {
    throw new Error("Web Crypto API is not available in this environment.");
  }

  return api;
}

/**
 * Deterministically derives Taproot (BIP86) addresses on Bitcoin Testnet.
 * The derivation path used is m/86'/1'/0'/0/i where `i` is the index.
 */
export async function deriveTaprootAddresses(secret: string, count: number) {
  const normalized = secret.trim().replace(/\s+/g, " ").toLowerCase();

  if (!bip39.validateMnemonic(normalized)) {
    throw new Error("Invalid BIP39 mnemonic.");
  }

  if (count <= 0) {
    throw new Error("Address count must be at least 1.");
  }

  const seed = await bip39.mnemonicToSeed(normalized);
  const root = fromSeed(seed, TESTNET);

  const addresses: string[] = [];

  for (let i = 0; i < count; i += 1) {
    const path = `m/86'/1'/0'/0/${i}`;
    const child = root.derivePath(path);

    if (!child.privateKey || !child.publicKey) {
      throw new Error("Derived key is missing.");
    }

    const internalPubkey = child.publicKey.subarray(1, 33);
    const payment = bitcoin.payments.p2tr({
      internalPubkey,
      network: TESTNET,
    });

    if (!payment.address) {
      throw new Error("Failed to derive a Taproot address.");
    }

    addresses.push(payment.address);
  }

  return addresses;
}

export function generateMnemonic(words = 12) {
  const cryptoApi = requireCrypto();
  const strength = words === 24 ? 256 : 128;
  const entropyBytes = strength / 8;
  const randomBytes = new Uint8Array(entropyBytes);
  cryptoApi.getRandomValues(randomBytes);
  const entropyHex = Array.from(randomBytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return bip39.entropyToMnemonic(entropyHex);
}

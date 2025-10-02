const SALT_PHRASE = "ephemeral::pbkdf2::v1";
const PBKDF2_ITERATIONS = 150_000;
const IV_LENGTH = 12; // AES-GCM standard IV length in bytes

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function requireCrypto() {
  // Ensure we're in browser environment
  if (typeof window === "undefined") {
    throw new Error("Web Crypto API is not available in this environment.");
  }

  const api = globalThis.crypto;

  if (!api || !api.subtle) {
    throw new Error("Web Crypto API is not available in this environment.");
  }

  return api;
}

async function deriveAesKey(secret: string) {
  const cryptoApi = requireCrypto();
  const keyMaterial = await cryptoApi.subtle.importKey(
    "raw",
    encoder.encode(secret.normalize("NFKD")),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return cryptoApi.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode(SALT_PHRASE),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function concatBuffers(iv: Uint8Array, ciphertext: ArrayBuffer) {
  const cipherBytes = new Uint8Array(ciphertext);
  const result = new Uint8Array(iv.byteLength + cipherBytes.byteLength);
  result.set(iv, 0);
  result.set(cipherBytes, iv.byteLength);
  return result;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary);
}

function base64ToUint8Array(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

export async function encryptMessage(secret: string, message: string) {
  if (!message.trim()) {
    throw new Error("Message to encrypt cannot be empty.");
  }

  const cryptoApi = requireCrypto();
  const key = await deriveAesKey(secret);
  const iv = cryptoApi.getRandomValues(new Uint8Array(IV_LENGTH));

  const ciphertext = await cryptoApi.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(message),
  );

  return bytesToBase64(concatBuffers(iv, ciphertext));
}

export async function decryptMessage(secret: string, encryptedBase64: string) {
  try {
    const cryptoApi = requireCrypto();
    const payload = base64ToUint8Array(encryptedBase64);

    const iv = payload.slice(0, IV_LENGTH);
    const ciphertext = payload.slice(IV_LENGTH);

    const key = await deriveAesKey(secret);

    const plainBuffer = await cryptoApi.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext,
    );

    return decoder.decode(plainBuffer);
  } catch (error) {
  console.warn("Failed to decrypt message", error);
    return null;
  }
}

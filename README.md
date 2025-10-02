# Ephemeral Protocol

### Deniable, Uncensorable, One-Shot Messaging on Bitcoin.

**[Live Demo on Vercel](https://ephemeral-labs.vercel.app/)**

Ephemeral is a minimalist, privacy-first messaging protocol that transforms the Bitcoin blockchain into a secure, serverless, and anonymous communication channel.

Two parties, sharing nothing but a **12-word secret phrase**, can establish an end-to-end encrypted channel. All messages are inscribed on-chain as encrypted, seemingly random data. Without the shared secret, the messages are undiscoverable and unreadable. **No accounts, no servers, no metadata.**

This project was built for the **Weapons of Liberation - Freedom Apps on Bitcoin** hackathon.

---

## Ephemeral Protocol Showcase

<img width="1920" height="919" alt="screencapture-ephemeral-labs-vercel-app-2025-10-02-10_53_39" src="https://github.com/user-attachments/assets/5f512050-34d8-4acd-9bc0-b78b3dc10e94" />
<img width="1920" height="924" alt="screencapture-ephemeral-labs-vercel-app-2025-10-02-11_11_33" src="https://github.com/user-attachments/assets/ee4d43df-62e4-4c94-8979-7e00a23b0908" />

---

## The Philosophy: What if a message never existed?

In a world of constant surveillance, true privacy isn't just about encrypting content—it's about **deniability**. Ephemeral explores this concept by leaving no trace of a user's identity. The protocol is designed for journalists, activists, and individuals in high-risk environments where even the *existence* of a messaging app can be a liability.

With Ephemeral, your "identity" is a temporary key derived from a secret you hold only in your mind. The blockchain is merely a public bulletin board where you post encrypted notes that only your intended recipient can ever find or decipher.

## Key Features

-   🤫 **Deniable & Anonymous:** No user accounts, email, or phone numbers. Your only identifier is a shared secret phrase.
-   🔐 **End-to-End Encryption:** Messages are encrypted client-side using **AES-256-GCM** via the browser's Web Crypto API. The encryption key is deterministically derived from your mnemonic.
-   ⛓️ **On-Chain & Uncensorable:** Encrypted payloads are inscribed directly onto the **Bitcoin Testnet**, making them as immutable and censorship-resistant as Bitcoin itself.
-   💻 **Serverless Architecture:** All cryptographic operations happen in your browser. We have no servers, and we store **zero** user data.
-   📱 **Fully Responsive:** A seamless experience on both desktop and mobile devices.
-   🧩 **Wallet Integration:** Natively integrates with **Unisat Wallet** for a smooth, secure on-chain interaction experience.

---

## How It Works: The Magic Behind the Curtain

The entire protocol is built on a foundation of deterministic cryptography, made possible by Bitcoin's BIP39 and BIP86 standards.

1.  **Shared Secret:** Two users (Alice & Bob) agree on a 12-word BIP39 mnemonic phrase offline. This is their master key.
2.  **Deterministic Derivation:** When Alice or Bob enters the mnemonic into the app, two things are generated **identically** on both their devices:
    -   An **AES-256 encryption key** for messaging.
    -   A sequential list of **Taproot addresses**, which serve as their shared, secret "dead drop" mailboxes.
3.  **Sending a Message:**
    -   Alice writes a message. The app encrypts it using the derived key.
    -   The app selects the next unused Taproot address from the shared list.
    -   It requests Alice's Unisat Wallet to **inscribe** the encrypted text onto the blockchain, sending it to the target address.
4.  **Receiving a Message:**
    -   Bob opens the app and enters the same mnemonic.
    -   He clicks "Fetch Inbox." The app queries a public indexer for any transactions sent to the shared list of Taproot addresses.
    -   When an inscription is found, the app fetches the encrypted payload, decrypts it with the shared key, and displays the original message to Bob.

To an outside observer, this entire exchange appears as random data being sent to random Bitcoin addresses. Only those who know the secret phrase can find the mailboxes and unlock the messages.

## Tech Stack

-   **Framework:** Next.js 14 (App Router) & TypeScript
-   **Styling:** Tailwind CSS
-   **State Management:** React Context API
-   **Cryptography:** Web Crypto API (AES-256-GCM, PBKDF2)
-   **Bitcoin Logic:** `bitcoinjs-lib` for key/address derivation and transaction building.
-   **Wallet Connector:** Unisat Wallet Web API
-   **Blockchain Data:** Public Testnet Indexers

---

## Getting Started: Run It Locally

**Prerequisites:**
-   Node.js (v18 or later)
-   npm or yarn
-   [Unisat Wallet](https://unisat.io/) browser extension
-   Some Bitcoin **Testnet** funds in your Unisat wallet. You can get some from a [Testnet Faucet](https://coinfaucet.eu/en/btc-testnet/).

**1. Clone the repository:**
```bash
git clone https://github.com/furkngld/ephemeral.git
cd ephemeral
```

**2. Install dependencies:**
```bash
npm install
```

**3. Run the development server:**
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

**4. Test the flow:**
-   Open two different browser windows (or one on desktop, one on mobile).
-   Generate a new 12-word mnemonic in the app and copy it.
-   Enter the **same mnemonic** in both windows to join the same channel.
-   Connect your Unisat wallet (make sure it's on the Testnet network).
-   In one window, type a message and click send. Approve the transaction in Unisat.
-   In the other window, click "Fetch Inbox." Your encrypted message will appear!

---

## Security & Limitations

-   ⚠️ **Testnet Only:** This is a proof-of-concept and should **ONLY** be used on the Bitcoin Testnet. Do not use a mnemonic associated with real funds.
-   **Mnemonic Security:** The security of a channel is entirely dependent on the secrecy of the shared mnemonic. Never share it digitally.
-   **Transaction Costs:** Every message is a real Bitcoin transaction and incurs network fees. Our future roadmap explores Layer 2 solutions to drastically reduce costs.
-   **Indexer Reliance:** The app currently relies on public indexers to find messages. A more robust version would use multiple indexers or a light client.

## Future Roadmap: The Path Forward

Ephemeral is more than a hackathon project; it's a foundation for truly sovereign communication.

-   **State Channels for Messaging:** Implement a Layer 2 solution where hundreds of messages can be exchanged off-chain instantly and for free, with only periodic on-chain "anchor" transactions to ensure immutability. This solves the cost and speed limitations.
-   **Forward Secrecy:** Integrate a Diffie-Hellman key exchange to generate per-message keys, so even if the master mnemonic is compromised, past messages remain secure.
-   **File Sharing:** Extend the protocol to support encrypted, on-chain file inscriptions.
-   **Decentralized Indexing:** Reduce reliance on centralized indexers by integrating with decentralized alternatives or running a client-side light node.

---
## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

In short, this means you are free to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the software, provided that the original copyright notice and this permission notice are included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED.
---
Built with ❤️ for a free and open internet.

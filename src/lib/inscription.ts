import * as bitcoin from 'bitcoinjs-lib';

/**
 * Creates a taproot inscription commitment script
 * This embeds the content into a Bitcoin script using OP_FALSE OP_IF pattern
 */
export function createInscriptionScript(
  contentType: string,
  content: string,
): Buffer {
  const contentBuffer = Buffer.from(content, 'utf-8');
  const contentTypeBuffer = Buffer.from(contentType, 'utf-8');

  // Inscription envelope pattern:
  // OP_FALSE
  // OP_IF
  //   OP_PUSH "ord"
  //   OP_PUSH 0x01 (content-type tag)
  //   OP_PUSH <content-type>
  //   OP_PUSH 0x00 (body tag)
  //   OP_PUSH <content>
  // OP_ENDIF

  const script = [
    bitcoin.opcodes.OP_FALSE,
    bitcoin.opcodes.OP_IF,
    Buffer.from('ord'),
    bitcoin.script.number.encode(1), // content-type tag
    contentTypeBuffer,
    bitcoin.script.number.encode(0), // body tag
    contentBuffer,
    bitcoin.opcodes.OP_ENDIF,
  ];

  return bitcoin.script.compile(script);
}

/**
 * Simplified inscription via UniSat wallet
 * Uses sendBitcoin with OP_RETURN data as fallback
 */
export async function inscribeViaOpReturn(
  unisat: {
    sendBitcoin: (address: string, amount: number, options?: { memo?: string }) => Promise<string>;
  },
  recipientAddress: string,
  content: string,
): Promise<string> {
  // Send minimal satoshis with content as memo/note
  // This is a fallback - not a true inscription, but ensures delivery
  const txid = await unisat.sendBitcoin(recipientAddress, 546, {
    memo: content,
  });

  return txid;
}

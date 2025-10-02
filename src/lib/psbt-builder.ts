import * as bitcoin from 'bitcoinjs-lib';

/**
 * Creates a Bitcoin transaction with OP_RETURN data
 * Returns unsigned PSBT for wallet signing
 */
export async function buildOpReturnTransaction(
  senderAddress: string,
  recipientAddress: string,
  payload: string,
  utxos: Array<{
    txid: string;
    vout: number;
    value: number;
    scriptPubKey?: string;
  }>,
  feeRate: number = 10,
): Promise<string> {
  const network = bitcoin.networks.testnet;
  const psbt = new bitcoin.Psbt({ network });

  if (!payload.trim()) {
    throw new Error('Cannot broadcast an empty payload.');
  }

  const payloadBuffer = Buffer.from(payload, 'utf-8');

  if (payloadBuffer.length > 80) {
    throw new Error('Payload exceeds OP_RETURN limit (80 bytes).');
  }

  // Calculate required input value
  let totalInput = 0;
  const dustAmount = 546; // Minimum output for recipient
  const inputCost = 68; // approx virtual bytes per P2TR input
  const baseCost = 110; // approx base tx cost
  const targetAmount = dustAmount + feeRate * (baseCost + inputCost); // initial estimate

  // Add inputs from UTXOs
  for (const utxo of utxos) {
    if (totalInput >= targetAmount) {
      break;
    }

    if (!utxo.scriptPubKey) {
      throw new Error('UTXO missing scriptPubKey; cannot build PSBT.');
    }

    psbt.addInput({
      hash: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        script: Buffer.from(utxo.scriptPubKey, 'hex'),
        value: utxo.value,
      },
    });

    totalInput += utxo.value;
  }

  if (totalInput < targetAmount) {
    throw new Error('Insufficient funds for transaction');
  }

  const inputCount = psbt.inputCount;
  const estimatedVBytes = baseCost + inputCount * inputCost;
  const estimatedFee = Math.max(Math.floor(feeRate * estimatedVBytes), 500);

  // Output 1: Dust to recipient address
  psbt.addOutput({
    address: recipientAddress,
    value: dustAmount,
  });

  // Output 2: OP_RETURN with payload
  const opReturnScript = bitcoin.script.compile([
    bitcoin.opcodes.OP_RETURN,
    payloadBuffer,
  ]);

  psbt.addOutput({
    script: opReturnScript,
    value: 0,
  });

  // Output 3: Change back to sender
  const change = totalInput - dustAmount - estimatedFee;

  if (change < 0) {
    throw new Error('Insufficient balance to cover fee.');
  }

  if (change >= dustAmount) {
    psbt.addOutput({
      address: senderAddress,
      value: change,
    });
  }

  return psbt.toBase64();
}

/**
 * Fetches UTXOs for an address from mempool.space
 */
function normalizeSatoshis(value: number) {
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid UTXO value received: ${value}`);
  }

  if (Number.isInteger(value)) {
    return value;
  }

  // Some API responses may return BTC instead of satoshis; convert when a fractional component exists
  const sats = Math.round(value * 1e8);

  if (!Number.isInteger(sats) || sats <= 0) {
    throw new Error(`Failed to normalise UTXO value: ${value}`);
  }

  return sats;
}

export async function fetchUtxos(
  address: string,
): Promise<
  Array<{
    txid: string;
    vout: number;
    value: number;
    scriptPubKey?: string;
  }>
> {
  try {
    const response = await fetch(
      `https://mempool.space/testnet/api/address/${address}/utxo`,
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch UTXOs: ${response.statusText}`);
    }

    const utxos = (await response.json()) as Array<{
      txid: string;
      vout: number;
      value: number;
      status: {
        confirmed: boolean;
      };
      scriptpubkey?: string;
    }>;

    // Only return confirmed UTXOs
  const confirmed = utxos.filter((utxo) => utxo.status.confirmed);

    const results: Array<{
      txid: string;
      vout: number;
      value: number;
      scriptPubKey?: string;
    }> = [];

    for (const utxo of confirmed) {
      let scriptPubKey = utxo.scriptpubkey;

      if (!scriptPubKey) {
        try {
          const txResp = await fetch(
            `https://mempool.space/testnet/api/tx/${utxo.txid}`,
          );

          if (txResp.ok) {
            const txData = (await txResp.json()) as {
              vout: Array<{ scriptpubkey: string }>;
            };

            scriptPubKey = txData.vout?.[utxo.vout]?.scriptpubkey;
          }
        } catch (innerError) {
          console.warn('Failed to fetch tx data for UTXO script:', innerError);
        }
      }

      try {
        const normalisedValue = normalizeSatoshis(utxo.value);

        results.push({
        txid: utxo.txid,
        vout: utxo.vout,
        value: normalisedValue,
        scriptPubKey,
      });
      } catch (valueError) {
        console.warn('Skipping UTXO with invalid value', {
          txid: utxo.txid,
          vout: utxo.vout,
          value: utxo.value,
          error: valueError,
        });
      }
    }

    return results;
  } catch (error) {
    console.error('Failed to fetch UTXOs:', error);
    throw error;
  }
}

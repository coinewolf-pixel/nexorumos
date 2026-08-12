import { Connection, PublicKey, Keypair, SystemProgram, Transaction } from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  MINT_SIZE,
  getMinimumBalanceForRentExemptMint,
  createInitializeMintInstruction,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
} from '@solana/spl-token';
import { ethers } from 'ethers';

/** SPL token amounts are stored on-chain as an unsigned 64-bit integer. */
const U64_MAX = 18446744073709551615n;

export interface DeploySolanaTokenParams {
  rpcUrl: string;
  payerPublicKey: PublicKey;
  /** Must implement Phantom's `signTransaction`. We submit the signed tx ourselves via `rpcUrl`, rather than letting the wallet submit it on whatever network Phantom happens to be pointed at — otherwise the cluster shown in our UI and the cluster the tx actually lands on could silently mismatch. */
  provider: { signTransaction: (tx: Transaction) => Promise<Transaction> };
  name: string;
  symbol: string;
  decimals: number;
  /** Human-readable total supply, e.g. "1000000" or "0.5". */
  supply: string;
}

export interface DeploySolanaTokenResult {
  mintAddress: string;
  tokenAccount: string;
  signature: string;
}

/**
 * Computes the raw on-chain amount (supply × 10^decimals) and throws a clear
 * error instead of silently overflowing if it doesn't fit in a u64 — SPL
 * amounts are u64, unlike Ethereum's uint256, so combinations that would be
 * fine for an ERC-20 (e.g. 1,000,000 supply at 18 decimals) can overflow
 * here and must be caught before we ever ask the wallet to sign anything.
 */
export function computeSplAmount(supply: string, decimals: number): bigint {
  const amount = ethers.parseUnits(supply || '0', decimals);
  if (amount < 0n) {
    throw new Error('Total supply must be non-negative.');
  }
  if (amount > U64_MAX) {
    throw new Error(
      `Total supply × 10^decimals (${amount.toString()}) is too large for an SPL token — it must fit in a 64-bit integer (max ${U64_MAX.toString()}). Use fewer decimals or a smaller total supply.`
    );
  }
  return amount;
}

export async function deploySolanaToken(params: DeploySolanaTokenParams): Promise<DeploySolanaTokenResult> {
  const { rpcUrl, payerPublicKey, provider, decimals, supply } = params;
  const amount = computeSplAmount(supply, decimals);

  const connection = new Connection(rpcUrl, 'confirmed');
  const mintKeypair = Keypair.generate();
  const lamportsForMint = await getMinimumBalanceForRentExemptMint(connection);
  const associatedTokenAccount = getAssociatedTokenAddressSync(mintKeypair.publicKey, payerPublicKey);

  const transaction = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payerPublicKey,
      newAccountPubkey: mintKeypair.publicKey,
      space: MINT_SIZE,
      lamports: lamportsForMint,
      programId: TOKEN_PROGRAM_ID,
    }),
    createInitializeMintInstruction(mintKeypair.publicKey, decimals, payerPublicKey, payerPublicKey, TOKEN_PROGRAM_ID),
    createAssociatedTokenAccountInstruction(payerPublicKey, associatedTokenAccount, payerPublicKey, mintKeypair.publicKey),
    createMintToInstruction(mintKeypair.publicKey, associatedTokenAccount, payerPublicKey, amount, [], TOKEN_PROGRAM_ID)
  );

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = payerPublicKey;
  // The new mint account must co-sign its own creation — Phantom only signs
  // as the fee payer/mint authority, so we partial-sign with the locally
  // generated mint keypair before asking the wallet to sign the rest.
  transaction.partialSign(mintKeypair);

  const signedTransaction = await provider.signTransaction(transaction);
  const signature = await connection.sendRawTransaction(signedTransaction.serialize());
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');

  return {
    mintAddress: mintKeypair.publicKey.toBase58(),
    tokenAccount: associatedTokenAccount.toBase58(),
    signature,
  };
}

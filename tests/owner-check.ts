import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { OwnerCheck } from "../target/types/owner_check";
import { Clone } from "../target/types/clone";
import { expect } from "chai";
import {
  createMint,
  createAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { airdropIfRequired } from "@solana-developers/helpers";

describe("Owner Check", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.OwnerCheck as Program<OwnerCheck>;
  const programClone = anchor.workspace.Clone as Program<Clone>;

  const connection = provider.connection;
  const walletAuthority = provider.wallet as anchor.Wallet;

  const unauthorizedWallet = Keypair.generate();
  const vaultAccount = Keypair.generate();
  const vaultCloneAccount = Keypair.generate();

  const TOKEN_SEED = "token";
  const [tokenPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from(TOKEN_SEED)],
    program.programId
  );

  let tokenMint: PublicKey;
  let authorizedWithdrawDestination: PublicKey;
  let unauthorizedWithdrawDestination: PublicKey;

  const INITIAL_AIRDROP_AMOUNT = 1 * LAMPORTS_PER_SOL;
  const MINIMUM_BALANCE_FOR_RENT_EXEMPTION = 1 * LAMPORTS_PER_SOL;
  const INITIAL_TOKEN_AMOUNT = 100;

  before(async () => {
    try {
      tokenMint = await createMint(
        connection,
        walletAuthority.payer,
        walletAuthority.publicKey,
        null,
        0
      );

      authorizedWithdrawDestination = await createAccount(
        connection,
        walletAuthority.payer,
        tokenMint,
        walletAuthority.publicKey
      );

      unauthorizedWithdrawDestination = await createAccount(
        connection,
        walletAuthority.payer,
        tokenMint,
        unauthorizedWallet.publicKey
      );

      await airdropIfRequired(
        connection,
        unauthorizedWallet.publicKey,
        INITIAL_AIRDROP_AMOUNT,
        MINIMUM_BALANCE_FOR_RENT_EXEMPTION
      );
    } catch (error) {
      console.error("Test setup failed:", error);
      throw error;
    }
  });

  it("initializes vault", async () => {
    try {
      await program.methods
        .initializeVault()
        .accounts({
          vault: vaultAccount.publicKey,
          tokenAccount: tokenPDA,
          mint: tokenMint,
          authority: walletAuthority.publicKey,
        })
        .signers([vaultAccount])
        .rpc();

      await mintTo(
        connection,
        walletAuthority.payer,
        tokenMint,
        tokenPDA,
        walletAuthority.payer,
        INITIAL_TOKEN_AMOUNT
      );

      const tokenAccountInfo = await getAccount(connection, tokenPDA);
      expect(Number(tokenAccountInfo.amount)).to.equal(INITIAL_TOKEN_AMOUNT);
    } catch (error) {
      console.error("Vault initialization failed:", error);
      throw error;
    }
  });

  it("initializes fake vault", async () => {
    try {
      const transaction = await programClone.methods
        .initializeVault()
        .accounts({
          vault: vaultCloneAccount.publicKey,
          tokenAccount: tokenPDA,
          authority: unauthorizedWallet.publicKey,
        })
        .transaction();

      await anchor.web3.sendAndConfirmTransaction(connection, transaction, [
        unauthorizedWallet,
        vaultCloneAccount,
      ]);
    } catch (error) {
      console.error("Fake vault initialization failed:", error);
      throw error;
    }
  });
});

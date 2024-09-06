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
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
} from "@solana/web3.js";
import { airdropIfRequired } from "@solana-developers/helpers";

// Set up Anchor
anchor.AnchorProvider.env().opts.commitment = "confirmed";
const provider = anchor.AnchorProvider.env();
const connection = provider.connection;
const wallet = provider.wallet as anchor.Wallet;

const program = anchor.workspace.OwnerCheck as Program<OwnerCheck>;

const programClone = anchor.workspace.Clone as Program<Clone>;

const walletFake = Keypair.generate();
const vault = Keypair.generate();
const vaultClone = Keypair.generate();

const [tokenPDA] = PublicKey.findProgramAddressSync(
  [Buffer.from("token")],
  program.programId
);

let mint: PublicKey;
let withdrawDestination: PublicKey;
let withdrawDestinationFake: PublicKey;

describe("owner-check", () => {
  before(async () => {
    try {
      mint = await createMint(
        connection,
        wallet.payer,
        wallet.publicKey,
        null,
        0
      );

      withdrawDestination = await createAccount(
        connection,
        wallet.payer,
        mint,
        wallet.publicKey
      );

      withdrawDestinationFake = await createAccount(
        connection,
        wallet.payer,
        mint,
        walletFake.publicKey
      );

      await airdropIfRequired(
        connection,
        walletFake.publicKey,
        1 * LAMPORTS_PER_SOL,
        1 * LAMPORTS_PER_SOL
      );
    } catch (error) {
      throw new Error(`Failed to set up test: ${error.message}`);
    }
  });

  it("initializes vault", async () => {
    try {
      await program.methods
        .initializeVault()
        .accounts({
          vault: vault.publicKey,
          tokenAccount: tokenPDA,
          mint: mint,
          authority: provider.wallet.publicKey,
        })
        .signers([vault])
        .rpc();

      await mintTo(connection, wallet.payer, mint, tokenPDA, wallet.payer, 100);

      const tokenAccountInfo = await getAccount(connection, tokenPDA);
      expect(tokenAccountInfo.amount).to.equal(100n);
    } catch (error) {
      throw new Error(`Failed to initialize vault: ${error.message}`);
    }
  });

  it("initializes fake vault", async () => {
    try {
      const tx = await programClone.methods
        .initializeVault()
        .accounts({
          vault: vaultClone.publicKey,
          tokenAccount: tokenPDA,
          authority: walletFake.publicKey,
        })
        .transaction();

      await anchor.web3.sendAndConfirmTransaction(connection, tx, [
        walletFake,
        vaultClone,
      ]);
    } catch (error) {
      throw new Error(`Failed to initialize fake vault: ${error.message}`);
    }
  });

  it("performs insecure withdraw", async () => {
    try {
      const tx = await program.methods
        .insecureWithdraw()
        .accounts({
          vault: vaultClone.publicKey,
          tokenAccount: tokenPDA,
          withdrawDestination: withdrawDestinationFake,
          authority: walletFake.publicKey,
        })
        .transaction();

      await anchor.web3.sendAndConfirmTransaction(connection, tx, [walletFake]);

      const tokenAccountInfo = await getAccount(connection, tokenPDA);
      expect(tokenAccountInfo.amount).to.equal(0n);
    } catch (error) {
      throw new Error(`Failed to perform insecure withdraw: ${error.message}`);
    }
  });

  it("fails secure withdraw with incorrect authority", async () => {
    try {
      const tx = await program.methods
        .secureWithdraw()
        .accounts({
          vault: vaultClone.publicKey,
          tokenAccount: tokenPDA,
          withdrawDestination: withdrawDestinationFake,
          authority: walletFake.publicKey,
        })
        .transaction();

      await anchor.web3.sendAndConfirmTransaction(connection, tx, [walletFake]);
      throw new Error("Expected transaction to fail, but it succeeded");
    } catch (error) {
      expect(error).to.be.an("error");
      console.log("Error message:", error.message);
    }
  });

  it("performs secure withdraw successfully", async () => {
    try {
      await mintTo(connection, wallet.payer, mint, tokenPDA, wallet.payer, 100);

      await program.methods
        .secureWithdraw()
        .accounts({
          vault: vault.publicKey,
          tokenAccount: tokenPDA,
          withdrawDestination: withdrawDestination,
          authority: wallet.publicKey,
        })
        .rpc();

      const tokenAccountInfo = await getAccount(connection, tokenPDA);
      expect(tokenAccountInfo.amount).to.equal(0n);
    } catch (error) {
      throw new Error(`Failed to perform secure withdraw: ${error.message}`);
    }
  });
});

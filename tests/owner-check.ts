import * as anchor from "@coral-xyz/anchor";
import * as spl from "@solana/spl-token";
import { Program, Wallet } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { OwnerCheck } from "../target/types/owner_check";
import { Clone } from "../target/types/clone";
import { expect } from "chai";

describe("owner-check", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const connection = anchor.getProvider().connection;
  const wallet = anchor.workspace.OwnerCheck.provider.wallet as Wallet;
  const walletFake = anchor.web3.Keypair.generate();

  const program = anchor.workspace.OwnerCheck as Program<OwnerCheck>;
  const programClone = anchor.workspace.Clone as Program<Clone>;

  const vault = anchor.web3.Keypair.generate();
  const vaultClone = anchor.web3.Keypair.generate();

  const [tokenPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("token")],
    program.programId
  );

  let mint: anchor.web3.PublicKey;
  let withdrawDestination: anchor.web3.PublicKey;
  let withdrawDestinationFake: anchor.web3.PublicKey;

  before(async () => {
    mint = await spl.createMint(
      connection,
      wallet.payer,
      wallet.publicKey,
      null,
      0
    );

    withdrawDestination = await spl.createAccount(
      connection,
      wallet.payer,
      mint,
      wallet.publicKey
    );

    withdrawDestinationFake = await spl.createAccount(
      connection,
      wallet.payer,
      mint,
      walletFake.publicKey
    );

    const airdropSignature = await provider.connection.requestAirdrop(
      walletFake.publicKey,
      1 * anchor.web3.LAMPORTS_PER_SOL
    );

    const latestBlockHash = await provider.connection.getLatestBlockhash();

    await provider.connection.confirmTransaction(
      {
        blockhash: latestBlockHash.blockhash,
        lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
        signature: airdropSignature,
      },
      "confirmed"
    );
  });

  it("Initialize Vault should be successful", async () => {
    await program.methods
      .initializeVault()
      .accounts({
        vault: vault.publicKey,
        mint: mint,
        authority: provider.wallet.publicKey,
      })
      .signers([vault])
      .rpc();

    await spl.mintTo(
      connection,
      wallet.payer,
      mint,
      tokenPDA,
      wallet.payer,
      100
    );

    const balance = await connection.getTokenAccountBalance(tokenPDA);
    expect(balance.value.uiAmount).to.eq(100);
  });

  it("Initialize Fake Vault should be successful", async () => {
    await programClone.methods
      .initializeVault()
      .accounts({
        vault: vaultClone.publicKey,
        tokenAccount: tokenPDA,
        authority: walletFake.publicKey,
      })
      .signers([vaultClone, walletFake])
      .rpc();
  });

  it("Insecure withdraw should be successful", async () => {
    await program.methods
      .insecureWithdraw()
      .accounts({
        vault: vaultClone.publicKey,
        withdrawDestination: withdrawDestinationFake,
        authority: walletFake.publicKey,
      })
      .signers([walletFake])
      .rpc();

    const balance = await connection.getTokenAccountBalance(tokenPDA);
    expect(balance.value.uiAmount).to.eq(0);
  });

  it("Secure withdraw should throw an error", async () => {
    try {
      await program.methods
        .secureWithdraw()
        .accounts({
          vault: vaultClone.publicKey,
          withdrawDestination: withdrawDestinationFake,
        })
        .rpc();
    } catch (err) {
      expect(err);
      console.log(err);
    }
  });

  it("Secure withdraw should be successful", async () => {
    await spl.mintTo(
      connection,
      wallet.payer,
      mint,
      tokenPDA,
      wallet.payer,
      100
    );
    await program.methods
      .secureWithdraw()
      .accounts({
        vault: vault.publicKey,
        withdrawDestination: withdrawDestination,
      })
      .rpc();
    const balance = await connection.getTokenAccountBalance(tokenPDA);
    expect(balance.value.uiAmount).to.eq(0);
  });
});
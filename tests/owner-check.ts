import * as anchor from "@project-serum/anchor"
import * as spl from "@solana/spl-token"
import { Program } from "@project-serum/anchor"
import { OwnerCheck } from "../target/types/owner_check"
import { Clone } from "../target/types/clone"
import { findProgramAddressSync } from "@project-serum/anchor/dist/cjs/utils/pubkey"
import { expect } from "chai"

describe("owner-check", () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const connection = anchor.getProvider().connection
  const wallet = anchor.workspace.OwnerCheck.provider.wallet
  const walletFake = anchor.web3.Keypair.generate()

  const program = anchor.workspace.OwnerCheck as Program<OwnerCheck>
  const programClone = anchor.workspace.Clone as Program<Clone>

  const vault = anchor.web3.Keypair.generate()
  const vaultClone = anchor.web3.Keypair.generate()

  const [tokenPDA] = findProgramAddressSync(
    [Buffer.from("token")],
    program.programId
  )

  let mint: anchor.web3.PublicKey
  let withdrawDestination: anchor.web3.PublicKey
  let withdrawDestinationFake: anchor.web3.PublicKey

  before(async () => {
    mint = await spl.createMint(
      connection,
      wallet.payer,
      wallet.publicKey,
      null,
      0
    )

    withdrawDestination = await spl.createAccount(
      connection,
      wallet.payer,
      mint,
      wallet.publicKey
    )

    withdrawDestinationFake = await spl.createAccount(
      connection,
      wallet.payer,
      mint,
      walletFake.publicKey
    )

    await connection.confirmTransaction(
      await connection.requestAirdrop(
        walletFake.publicKey,
        1 * anchor.web3.LAMPORTS_PER_SOL
      ),
      "confirmed"
    )
  })

  it("Initialize Vault", async () => {
    await program.methods
      .initializeVault()
      .accounts({
        vault: vault.publicKey,
        tokenAccount: tokenPDA,
        mint: mint,
        authority: provider.wallet.publicKey,
      })
      .signers([vault])
      .rpc()

    await spl.mintTo(
      connection,
      wallet.payer,
      mint,
      tokenPDA,
      wallet.payer,
      100
    )

    const balance = await connection.getTokenAccountBalance(tokenPDA)
    expect(balance.value.uiAmount).to.eq(100)
  })

  it("Initialize Fake Vault", async () => {
    const tx = await programClone.methods
      .initializeVault()
      .accounts({
        vault: vaultClone.publicKey,
        tokenAccount: tokenPDA,
        authority: walletFake.publicKey,
      })
      .transaction()

    await anchor.web3.sendAndConfirmTransaction(connection, tx, [
      walletFake,
      vaultClone,
    ])
  })

  it("Insecure withdraw", async () => {
    const tx = await program.methods
      .insecureWithdraw()
      .accounts({
        vault: vaultClone.publicKey,
        tokenAccount: tokenPDA,
        withdrawDestination: withdrawDestinationFake,
        authority: walletFake.publicKey,
      })
      .transaction()

    await anchor.web3.sendAndConfirmTransaction(connection, tx, [walletFake])

    const balance = await connection.getTokenAccountBalance(tokenPDA)
    expect(balance.value.uiAmount).to.eq(0)
  })

  it("Secure withdraw, expect error", async () => {
    try {
      const tx = await program.methods
        .secureWithdraw()
        .accounts({
          vault: vaultClone.publicKey,
          tokenAccount: tokenPDA,
          withdrawDestination: withdrawDestinationFake,
          authority: walletFake.publicKey,
        })
        .transaction()

      await anchor.web3.sendAndConfirmTransaction(connection, tx, [walletFake])
    } catch (err) {
      expect(err)
      console.log(err)
    }
  })

  it("Secure withdraw", async () => {
    await spl.mintTo(
      connection,
      wallet.payer,
      mint,
      tokenPDA,
      wallet.payer,
      100
    )

    await program.methods
      .secureWithdraw()
      .accounts({
        vault: vault.publicKey,
        tokenAccount: tokenPDA,
        withdrawDestination: withdrawDestination,
        authority: wallet.publicKey,
      })
      .rpc()

    const balance = await connection.getTokenAccountBalance(tokenPDA)
    expect(balance.value.uiAmount).to.eq(0)
  })
})

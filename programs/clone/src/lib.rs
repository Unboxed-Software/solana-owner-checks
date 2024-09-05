use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

declare_id!("7967qGRBusM49RUdBiFU8s9YY3fSwA9rxCSELXgk8Tk1");

const DISCRIMINATOR_SIZE: usize = 8;

#[program]
pub mod clone {
    use super::*;

    pub fn initialize_vault(ctx: Context<InitializeVault>) -> Result<()> {
        ctx.accounts.vault.token_account = ctx.accounts.token_account.key();
        ctx.accounts.vault.authority = ctx.accounts.authority.key();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(
        init,
        payer = authority,
        space = DISCRIMINATOR_SIZE + Vault::INIT_SPACE,
    )]
    pub vault: Account<'info, Vault>,
    pub token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct Vault {
    token_account: Pubkey,
    authority: Pubkey,
}
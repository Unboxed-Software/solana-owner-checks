use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

declare_id!("2Gn5MFGMvRjd548z6vhreh84UiL7L5TFzV5kKGmk4Fga");

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
#[derive(Default, InitSpace)]
pub struct Vault {
    token_account: Pubkey,
    authority: Pubkey,
}
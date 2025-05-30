use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer, Mint, MintTo, Burn};

declare_id!("B6WsBQgwpFpQZMYLPt9groFwSjp2nKL7JBoTJASyEYb4");

#[program]
pub mod solana_amm_educational_template {
    use super::*;

    pub fn initialize_pool(ctx: Context<InitializePool>, pool_type: u8) -> Result<()> {
        let pool = &mut ctx.accounts.pool_state;
        pool.token_a = ctx.accounts.token_a_mint.key();
        pool.token_b = ctx.accounts.token_b_mint.key();
        pool.lp_mint = ctx.accounts.lp_mint.key();
        pool.pool_type = pool_type; // 0=standard, 1=stable, 2=concentrated
        pool.bump = ctx.bumps.pool_state;
        
        // Set fee rate based on pool type
        pool.fee_rate = match pool_type {
            0 => 300,  // Standard: 0.3%
            1 => 50,   // Stable: 0.05% 
            2 => 500,  // Concentrated: 0.5%
            _ => return Err(SwapError::InvalidPoolType.into()),
        };
        
        let pool_type_name = match pool_type {
            0 => "Standard",
            1 => "Stable", 
            2 => "Concentrated",
            _ => "Unknown"
        };
        
        msg!("{} pool initialized for tokens: {} and {}, LP mint: {}, Fee: {}bp", 
             pool_type_name, pool.token_a, pool.token_b, pool.lp_mint, pool.fee_rate);
        Ok(())
    }

    pub fn add_liquidity(
        ctx: Context<AddLiquidity>, 
        amount_a: u64, 
        amount_b: u64
    ) -> Result<()> {
        require!(amount_a > 0 && amount_b > 0, SwapError::InvalidAmount);

        // CRITICAL FIX: Get vault balances BEFORE any transfers
        // This ensures we calculate LP tokens based on the pool state before this deposit
        let vault_a_balance_before = ctx.accounts.pool_token_a_vault.amount;
        let vault_b_balance_before = ctx.accounts.pool_token_b_vault.amount;
        let lp_supply = ctx.accounts.lp_mint.supply;

        // Transfer token A from user to pool
        let cpi_ctx_a = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_token_a.to_account_info(),
                to: ctx.accounts.pool_token_a_vault.to_account_info(),
                authority: ctx.accounts.user_authority.to_account_info(),
            },
        );
        token::transfer(cpi_ctx_a, amount_a)?;

        // Transfer token B from user to pool
        let cpi_ctx_b = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_token_b.to_account_info(),
                to: ctx.accounts.pool_token_b_vault.to_account_info(),
                authority: ctx.accounts.user_authority.to_account_info(),
            },
        );
        token::transfer(cpi_ctx_b, amount_b)?;

        // Calculate LP tokens based on pool type
        let lp_to_mint = if lp_supply == 0 {
            // First liquidity provider gets a fixed amount of LP tokens
            1_000_000_u64
        } else {
            match ctx.accounts.pool_state.pool_type {
                0 => {
                    // Standard pool: proportional to existing ratio
                    let ratio_a = (amount_a as u128 * lp_supply as u128) / vault_a_balance_before as u128;
                    let ratio_b = (amount_b as u128 * lp_supply as u128) / vault_b_balance_before as u128;
                    std::cmp::min(ratio_a, ratio_b) as u64
                },
                1 => {
                    // Stable pool: more generous LP tokens since assets are similar
                    let avg_ratio = ((amount_a as u128 + amount_b as u128) * lp_supply as u128) 
                        / ((vault_a_balance_before + vault_b_balance_before) as u128 * 2);
                    avg_ratio as u64
                },
                2 => {
                    // Concentrated pool: bonus LP tokens for providing liquidity
                    let ratio_a = (amount_a as u128 * lp_supply as u128) / vault_a_balance_before as u128;
                    let ratio_b = (amount_b as u128 * lp_supply as u128) / vault_b_balance_before as u128;
                    let base_ratio = std::cmp::min(ratio_a, ratio_b);
                    // 10% bonus for concentrated liquidity
                    (base_ratio * 110 / 100) as u64
                },
                _ => {
                    // Fallback to standard calculation
                    let ratio_a = (amount_a as u128 * lp_supply as u128) / vault_a_balance_before as u128;
                    let ratio_b = (amount_b as u128 * lp_supply as u128) / vault_b_balance_before as u128;
                    std::cmp::min(ratio_a, ratio_b) as u64
                }
            }
        };

        require!(lp_to_mint > 0, SwapError::InvalidAmount);

        // Mint LP tokens to the user using pool authority as signer
        let seeds = &[
            b"pool_authority",
            ctx.accounts.pool_state.token_a.as_ref(),
            ctx.accounts.pool_state.token_b.as_ref(),
            &[ctx.bumps.pool_authority],
        ];
        let signer = &[&seeds[..]];

        let cpi_ctx_mint = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.lp_mint.to_account_info(),
                to: ctx.accounts.user_lp_token.to_account_info(),
                authority: ctx.accounts.pool_authority.to_account_info(),
            },
            signer,
        );
        token::mint_to(cpi_ctx_mint, lp_to_mint)?;

        msg!("Liquidity added: {} token A, {} token B, {} LP tokens minted", 
             amount_a, amount_b, lp_to_mint);
        Ok(())
    }

    pub fn remove_liquidity(
        ctx: Context<RemoveLiquidity>,
        lp_amount: u64,
        minimum_a_out: u64,
        minimum_b_out: u64,
    ) -> Result<()> {
        require!(lp_amount > 0, SwapError::InvalidAmount);
        require!(ctx.accounts.user_lp_token.amount >= lp_amount, SwapError::InsufficientLpBalance);

        // Calculate how much of each token the user should receive
        // Formula: (lp_amount / total_lp_supply) * vault_balance
        let lp_supply = ctx.accounts.lp_mint.supply;
        let vault_a_balance = ctx.accounts.pool_token_a_vault.amount;
        let vault_b_balance = ctx.accounts.pool_token_b_vault.amount;

        let amount_a_out = (vault_a_balance as u128 * lp_amount as u128) / lp_supply as u128;
        let amount_b_out = (vault_b_balance as u128 * lp_amount as u128) / lp_supply as u128;

        let amount_a_out = amount_a_out as u64;
        let amount_b_out = amount_b_out as u64;

        // Slippage protection - ensure user gets at least minimum amounts
        require!(amount_a_out >= minimum_a_out, SwapError::SlippageExceeded);
        require!(amount_b_out >= minimum_b_out, SwapError::SlippageExceeded);

        // Ensure pool has enough liquidity
        require!(vault_a_balance >= amount_a_out, SwapError::InsufficientLiquidity);
        require!(vault_b_balance >= amount_b_out, SwapError::InsufficientLiquidity);

        // Burn the user's LP tokens first
        let cpi_ctx_burn = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.lp_mint.to_account_info(),
                from: ctx.accounts.user_lp_token.to_account_info(),
                authority: ctx.accounts.user_authority.to_account_info(),
            },
        );
        token::burn(cpi_ctx_burn, lp_amount)?;

        // Transfer token A from pool to user using pool authority
        let seeds = &[
            b"pool_authority",
            ctx.accounts.pool_state.token_a.as_ref(),
            ctx.accounts.pool_state.token_b.as_ref(),
            &[ctx.bumps.pool_authority],
        ];
        let signer = &[&seeds[..]];

        let cpi_ctx_a = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.pool_token_a_vault.to_account_info(),
                to: ctx.accounts.user_token_a.to_account_info(),
                authority: ctx.accounts.pool_authority.to_account_info(),
            },
            signer,
        );
        token::transfer(cpi_ctx_a, amount_a_out)?;

        // Transfer token B from pool to user using pool authority
        let cpi_ctx_b = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.pool_token_b_vault.to_account_info(),
                to: ctx.accounts.user_token_b.to_account_info(),
                authority: ctx.accounts.pool_authority.to_account_info(),
            },
            signer,
        );
        token::transfer(cpi_ctx_b, amount_b_out)?;

        msg!("Liquidity removed: {} LP tokens burned, {} token A, {} token B withdrawn", 
             lp_amount, amount_a_out, amount_b_out);
        Ok(())
    }

    pub fn swap(
        ctx: Context<Swap>, 
        amount_in: u64, 
        minimum_amount_out: u64,
        a_to_b: bool
    ) -> Result<()> {
        require!(amount_in > 0, SwapError::InvalidAmount);

        let (input_vault, output_vault, user_input, user_output) = if a_to_b {
            (
                &ctx.accounts.pool_token_a_vault,
                &ctx.accounts.pool_token_b_vault,
                &ctx.accounts.user_token_a,
                &ctx.accounts.user_token_b,
            )
        } else {
            (
                &ctx.accounts.pool_token_b_vault,
                &ctx.accounts.pool_token_a_vault,
                &ctx.accounts.user_token_b,
                &ctx.accounts.user_token_a,
            )
        };

        let input_balance = input_vault.amount;
        let output_balance = output_vault.amount;

        // Ensure sufficient liquidity
        require!(input_balance > 0 && output_balance > 0, SwapError::InsufficientLiquidity);

        // Calculate fee
        let fee_amount = (amount_in as u128 * ctx.accounts.pool_state.fee_rate as u128) / 100000;
        let amount_in_after_fee = amount_in - fee_amount as u64;

        // Calculate output amount based on pool type
        let amount_out = match ctx.accounts.pool_state.pool_type {
            0 => calculate_standard_swap(input_balance, output_balance, amount_in_after_fee),
            1 => calculate_stable_swap(input_balance, output_balance, amount_in_after_fee),
            2 => calculate_concentrated_swap(input_balance, output_balance, amount_in_after_fee),
            _ => calculate_standard_swap(input_balance, output_balance, amount_in_after_fee), // fallback
        };

        // Slippage protection
        require!(amount_out >= minimum_amount_out, SwapError::SlippageExceeded);
        require!(amount_out <= output_balance, SwapError::InsufficientLiquidity);

        // Transfer input token from user to pool
        let cpi_ctx_in = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: user_input.to_account_info(),
                to: input_vault.to_account_info(),
                authority: ctx.accounts.user_authority.to_account_info(),
            },
        );
        token::transfer(cpi_ctx_in, amount_in)?;

        // Transfer output token from pool to user using PDA authority
        let seeds = &[
            b"pool_authority",
            ctx.accounts.pool_state.token_a.as_ref(),
            ctx.accounts.pool_state.token_b.as_ref(),
            &[ctx.bumps.pool_authority],
        ];
        let signer = &[&seeds[..]];

        let cpi_ctx_out = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: output_vault.to_account_info(),
                to: user_output.to_account_info(),
                authority: ctx.accounts.pool_authority.to_account_info(),
            },
            signer,
        );
        token::transfer(cpi_ctx_out, amount_out)?;

        let pool_type_name = match ctx.accounts.pool_state.pool_type {
            0 => "Standard",
            1 => "Stable",
            2 => "Concentrated",
            _ => "Unknown"
        };

        msg!("{} swap completed: {} in, {} out, fee: {}", 
             pool_type_name, amount_in, amount_out, fee_amount);
        Ok(())
    }
}

// ========== SWAP CALCULATION FUNCTIONS ==========

fn calculate_standard_swap(input_balance: u64, output_balance: u64, amount_in: u64) -> u64 {
    // Standard constant product formula: x * y = k
    let amount_out = (output_balance as u128 * amount_in as u128)
        / (input_balance as u128 + amount_in as u128);
    amount_out as u64
}

fn calculate_stable_swap(input_balance: u64, output_balance: u64, amount_in: u64) -> u64 {
    // Stable swap: much lower slippage for similar assets
    let standard_out = calculate_standard_swap(input_balance, output_balance, amount_in);
    
    // Apply stability factor - less slippage for stable pairs
    let stability_bonus = amount_in / 20; // 5% bonus to reduce slippage
    std::cmp::min(standard_out + stability_bonus, output_balance - 1)
}

fn calculate_concentrated_swap(input_balance: u64, output_balance: u64, amount_in: u64) -> u64 {
    // Concentrated liquidity: better price within range
    let standard_out = calculate_standard_swap(input_balance, output_balance, amount_in);
    let efficiency_bonus = amount_in / 10; // 10% better price
    std::cmp::min(standard_out + efficiency_bonus, output_balance - 1)
}

// ========== ACCOUNTS & STATE ==========

#[account]
pub struct PoolState {
    pub token_a: Pubkey,
    pub token_b: Pubkey,
    pub lp_mint: Pubkey,    // Added LP mint address
    pub fee_rate: u32,      // Fee rate in basis points (300 = 0.3%)
    pub pool_type: u8,      // 0=standard, 1=stable, 2=concentrated
    pub bump: u8,
}

#[derive(Accounts)]
pub struct InitializePool<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + 32 + 32 + 32 + 4 + 1 + 1, // discriminator + token_a + token_b + lp_mint + fee_rate + pool_type + bump
        seeds = [b"pool", token_a_mint.key().as_ref(), token_b_mint.key().as_ref()],
        bump
    )]
    pub pool_state: Account<'info, PoolState>,

    /// CHECK: Token A mint account
    pub token_a_mint: AccountInfo<'info>,
    /// CHECK: Token B mint account  
    pub token_b_mint: AccountInfo<'info>,

    // LP token mint - owned and controlled by the pool authority
    #[account(
        init,
        payer = payer,
        mint::decimals = 6,
        mint::authority = pool_authority,
        seeds = [b"lp_mint", token_a_mint.key().as_ref(), token_b_mint.key().as_ref()],
        bump
    )]
    pub lp_mint: Account<'info, Mint>,

    // FIXED: Vault A as PDA - no signer required
    #[account(
        init,
        payer = payer,
        token::mint = token_a_mint,
        token::authority = pool_authority,
        seeds = [b"vault_a", token_a_mint.key().as_ref(), token_b_mint.key().as_ref()],
        bump
    )]
    pub token_a_vault: Account<'info, TokenAccount>,
    
    // FIXED: Vault B as PDA - no signer required
    #[account(
        init,
        payer = payer,
        token::mint = token_b_mint,
        token::authority = pool_authority,
        seeds = [b"vault_b", token_a_mint.key().as_ref(), token_b_mint.key().as_ref()],
        bump
    )]
    pub token_b_vault: Account<'info, TokenAccount>,

    /// CHECK: PDA used as authority for token vaults and LP mint
    #[account(
        seeds = [b"pool_authority", token_a_mint.key().as_ref(), token_b_mint.key().as_ref()],
        bump
    )]
    pub pool_authority: UncheckedAccount<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct AddLiquidity<'info> {
    #[account(
        seeds = [b"pool", pool_state.token_a.as_ref(), pool_state.token_b.as_ref()],
        bump = pool_state.bump
    )]
    pub pool_state: Account<'info, PoolState>,

    #[account(
        mut,
        constraint = user_token_a.mint == pool_state.token_a @ SwapError::InvalidTokenMint
    )]
    pub user_token_a: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = user_token_b.mint == pool_state.token_b @ SwapError::InvalidTokenMint
    )]
    pub user_token_b: Account<'info, TokenAccount>,

    // User's LP token account - where minted LP tokens will be sent
    #[account(
        mut,
        constraint = user_lp_token.mint == pool_state.lp_mint @ SwapError::InvalidTokenMint
    )]
    pub user_lp_token: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = pool_token_a_vault.mint == pool_state.token_a @ SwapError::InvalidTokenMint,
        constraint = pool_token_a_vault.owner == pool_authority.key() @ SwapError::InvalidVaultAuthority,
        seeds = [b"vault_a", pool_state.token_a.as_ref(), pool_state.token_b.as_ref()],
        bump
    )]
    pub pool_token_a_vault: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = pool_token_b_vault.mint == pool_state.token_b @ SwapError::InvalidTokenMint,
        constraint = pool_token_b_vault.owner == pool_authority.key() @ SwapError::InvalidVaultAuthority,
        seeds = [b"vault_b", pool_state.token_a.as_ref(), pool_state.token_b.as_ref()],
        bump
    )]
    pub pool_token_b_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = lp_mint.key() == pool_state.lp_mint @ SwapError::InvalidTokenMint
    )]
    pub lp_mint: Account<'info, Mint>,

    /// CHECK: PDA authority for vaults and LP mint
    #[account(
        seeds = [b"pool_authority", pool_state.token_a.as_ref(), pool_state.token_b.as_ref()],
        bump
    )]
    pub pool_authority: UncheckedAccount<'info>,

    pub user_authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct RemoveLiquidity<'info> {
    #[account(
        seeds = [b"pool", pool_state.token_a.as_ref(), pool_state.token_b.as_ref()],
        bump = pool_state.bump
    )]
    pub pool_state: Account<'info, PoolState>,

    #[account(
        mut,
        constraint = user_token_a.mint == pool_state.token_a @ SwapError::InvalidTokenMint
    )]
    pub user_token_a: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = user_token_b.mint == pool_state.token_b @ SwapError::InvalidTokenMint
    )]
    pub user_token_b: Account<'info, TokenAccount>,

    // User's LP token account - LP tokens will be burned from here
    #[account(
        mut,
        constraint = user_lp_token.mint == pool_state.lp_mint @ SwapError::InvalidTokenMint
    )]
    pub user_lp_token: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = pool_token_a_vault.mint == pool_state.token_a @ SwapError::InvalidTokenMint,
        constraint = pool_token_a_vault.owner == pool_authority.key() @ SwapError::InvalidVaultAuthority,
        seeds = [b"vault_a", pool_state.token_a.as_ref(), pool_state.token_b.as_ref()],
        bump
    )]
    pub pool_token_a_vault: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = pool_token_b_vault.mint == pool_state.token_b @ SwapError::InvalidTokenMint,
        constraint = pool_token_b_vault.owner == pool_authority.key() @ SwapError::InvalidVaultAuthority,
        seeds = [b"vault_b", pool_state.token_a.as_ref(), pool_state.token_b.as_ref()],
        bump
    )]
    pub pool_token_b_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = lp_mint.key() == pool_state.lp_mint @ SwapError::InvalidTokenMint
    )]
    pub lp_mint: Account<'info, Mint>,

    /// CHECK: PDA authority for vaults
    #[account(
        seeds = [b"pool_authority", pool_state.token_a.as_ref(), pool_state.token_b.as_ref()],
        bump
    )]
    pub pool_authority: UncheckedAccount<'info>,

    pub user_authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Swap<'info> {
    #[account(
        seeds = [b"pool", pool_state.token_a.as_ref(), pool_state.token_b.as_ref()],
        bump = pool_state.bump
    )]
    pub pool_state: Account<'info, PoolState>,

    #[account(
        mut,
        constraint = user_token_a.mint == pool_state.token_a @ SwapError::InvalidTokenMint
    )]
    pub user_token_a: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = user_token_b.mint == pool_state.token_b @ SwapError::InvalidTokenMint
    )]
    pub user_token_b: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = pool_token_a_vault.mint == pool_state.token_a @ SwapError::InvalidTokenMint,
        constraint = pool_token_a_vault.owner == pool_authority.key() @ SwapError::InvalidVaultAuthority,
        seeds = [b"vault_a", pool_state.token_a.as_ref(), pool_state.token_b.as_ref()],
        bump
    )]
    pub pool_token_a_vault: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = pool_token_b_vault.mint == pool_state.token_b @ SwapError::InvalidTokenMint,
        constraint = pool_token_b_vault.owner == pool_authority.key() @ SwapError::InvalidVaultAuthority,
        seeds = [b"vault_b", pool_state.token_a.as_ref(), pool_state.token_b.as_ref()],
        bump
    )]
    pub pool_token_b_vault: Account<'info, TokenAccount>,

    /// CHECK: PDA authority for vaults
    #[account(
        seeds = [b"pool_authority", pool_state.token_a.as_ref(), pool_state.token_b.as_ref()],
        bump
    )]
    pub pool_authority: UncheckedAccount<'info>,

    pub user_authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[error_code]
pub enum SwapError {
    #[msg("Insufficient liquidity in the pool")]
    InsufficientLiquidity,
    #[msg("Invalid amount provided")]
    InvalidAmount,
    #[msg("Slippage tolerance exceeded")]
    SlippageExceeded,
    #[msg("Invalid token mint")]
    InvalidTokenMint,
    #[msg("Invalid vault authority")]
    InvalidVaultAuthority,
    #[msg("Insufficient LP token balance")]
    InsufficientLpBalance,
    #[msg("Invalid pool type")]
    InvalidPoolType,
}
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  mintTo,
  createAccount,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import * as fs from "fs";
import dotenv from "dotenv";

dotenv.config();

// Updated IDL matching your Rust program
const IDL = {
  "address": "B6WsBQgwpFpQZMYLPt9groFwSjp2nKL7JBoTJASyEYb4",
  "metadata": {
    "name": "solana_amm_educational_template",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "add_liquidity",
      "discriminator": [181, 157, 89, 67, 143, 182, 52, 72],
      "accounts": [
        {
          "name": "pool_state",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [112, 111, 111, 108]
              },
              {
                "kind": "account",
                "path": "pool_state.token_a",
                "account": "PoolState"
              },
              {
                "kind": "account",
                "path": "pool_state.token_b",
                "account": "PoolState"
              }
            ]
          }
        },
        {
          "name": "user_token_a",
          "writable": true
        },
        {
          "name": "user_token_b",
          "writable": true
        },
        {
          "name": "user_lp_token",
          "writable": true
        },
        {
          "name": "pool_token_a_vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [118, 97, 117, 108, 116, 95, 97]
              },
              {
                "kind": "account",
                "path": "pool_state.token_a",
                "account": "PoolState"
              },
              {
                "kind": "account",
                "path": "pool_state.token_b",
                "account": "PoolState"
              }
            ]
          }
        },
        {
          "name": "pool_token_b_vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [118, 97, 117, 108, 116, 95, 98]
              },
              {
                "kind": "account",
                "path": "pool_state.token_a",
                "account": "PoolState"
              },
              {
                "kind": "account",
                "path": "pool_state.token_b",
                "account": "PoolState"
              }
            ]
          }
        },
        {
          "name": "lp_mint",
          "writable": true
        },
        {
          "name": "pool_authority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [112, 111, 111, 108, 95, 97, 117, 116, 104, 111, 114, 105, 116, 121]
              },
              {
                "kind": "account",
                "path": "pool_state.token_a",
                "account": "PoolState"
              },
              {
                "kind": "account",
                "path": "pool_state.token_b",
                "account": "PoolState"
              }
            ]
          }
        },
        {
          "name": "user_authority",
          "signer": true
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount_a",
          "type": "u64"
        },
        {
          "name": "amount_b",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initialize_pool",
      "discriminator": [95, 180, 10, 172, 84, 174, 232, 40],
      "accounts": [
        {
          "name": "pool_state",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [112, 111, 111, 108]
              },
              {
                "kind": "account",
                "path": "token_a_mint"
              },
              {
                "kind": "account",
                "path": "token_b_mint"
              }
            ]
          }
        },
        {
          "name": "token_a_mint"
        },
        {
          "name": "token_b_mint"
        },
        {
          "name": "lp_mint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [108, 112, 95, 109, 105, 110, 116]
              },
              {
                "kind": "account",
                "path": "token_a_mint"
              },
              {
                "kind": "account",
                "path": "token_b_mint"
              }
            ]
          }
        },
        {
          "name": "token_a_vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [118, 97, 117, 108, 116, 95, 97]
              },
              {
                "kind": "account",
                "path": "token_a_mint"
              },
              {
                "kind": "account",
                "path": "token_b_mint"
              }
            ]
          }
        },
        {
          "name": "token_b_vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [118, 97, 117, 108, 116, 95, 98]
              },
              {
                "kind": "account",
                "path": "token_a_mint"
              },
              {
                "kind": "account",
                "path": "token_b_mint"
              }
            ]
          }
        },
        {
          "name": "pool_authority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [112, 111, 111, 108, 95, 97, 117, 116, 104, 111, 114, 105, 116, 121]
              },
              {
                "kind": "account",
                "path": "token_a_mint"
              },
              {
                "kind": "account",
                "path": "token_b_mint"
              }
            ]
          }
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "pool_type",
          "type": "u8"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "PoolState",
      "discriminator": [247, 237, 227, 245, 215, 195, 222, 70]
    }
  ],
  "types": [
    {
      "name": "PoolState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "token_a",
            "type": "pubkey"
          },
          {
            "name": "token_b",
            "type": "pubkey"
          },
          {
            "name": "lp_mint",
            "type": "pubkey"
          },
          {
            "name": "fee_rate",
            "type": "u32"
          },
          {
            "name": "pool_type",
            "type": "u8"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ]
};

interface CurrencyPool {
  name: string;
  tokenA: { name: string; symbol: string; keypair: Keypair; mint?: PublicKey };
  tokenB: { name: string; symbol: string; keypair: Keypair; mint?: PublicKey };
  poolType: number;
  initialLiquidity: { amountA: number; amountB: number };
}

async function setupThreeCurrencyPools() {
  try {
    console.log("Setting up Three Currency Exchange Pools...");
    console.log("===============================================");

    // 1. Load Wallet & RPC  
    const deployerKeypair = Keypair.fromSecretKey(
      new Uint8Array(
        JSON.parse(fs.readFileSync("./keys/devnet-deployer.json", "utf8"))
      )
    );
    
    const connection = new Connection(
      process.env.ANCHOR_PROVIDER_URL || "https://api.devnet.solana.com",
      "confirmed"
    );

    const programId = new PublicKey("B6WsBQgwpFpQZMYLPt9groFwSjp2nKL7JBoTJASyEYb4");
    
    console.log(`Deployer: ${deployerKeypair.publicKey.toString()}`);
    console.log(`Program ID: ${programId.toString()}`);
    console.log(`RPC: ${connection.rpcEndpoint}`);

    // Check balance
    const balance = await connection.getBalance(deployerKeypair.publicKey);
    console.log(`Deployer balance: ${balance / 1e9} SOL`);
    
    if (balance < 0.5 * 1e9) {
      throw new Error("Insufficient SOL balance. Need at least 0.5 SOL for 3 pools deployment.");
    }

    // 2. Define Three Currency Pools with vault keypairs
    const currencyPools: CurrencyPool[] = [
      {
        name: "NTD/USD Stable Pool",
        tokenA: { 
          name: "New Taiwan Dollar", 
          symbol: "NTD", 
          keypair: Keypair.fromSecretKey(
            new Uint8Array(JSON.parse(fs.readFileSync("./keys/ntd-mint.json", "utf8")))
          )
        },
        tokenB: { 
          name: "US Dollar", 
          symbol: "USD", 
          keypair: Keypair.fromSecretKey(
            new Uint8Array(JSON.parse(fs.readFileSync("./keys/usd-mint.json", "utf8")))
          )
        },
        poolType: 1, // Stable pool - low fees for stable currency exchange
        initialLiquidity: { amountA: 3200000, amountB: 100000 } // ~32 NTD = 1 USD
      },
      {
        name: "USD/YEN Standard Pool",
        tokenA: { 
          name: "US Dollar", 
          symbol: "USD", 
          keypair: Keypair.fromSecretKey(
            new Uint8Array(JSON.parse(fs.readFileSync("./keys/usd-mint.json", "utf8")))
          )
        },
        tokenB: { 
          name: "Japanese Yen", 
          symbol: "YEN", 
          keypair: Keypair.fromSecretKey(
            new Uint8Array(JSON.parse(fs.readFileSync("./keys/yen-mint.json", "utf8")))
          )
        },
        poolType: 0, // Standard pool - normal AMM for USD/YEN
        initialLiquidity: { amountA: 100000, amountB: 15000000 } // ~1 USD = 150 YEN
      },
      {
        name: "NTD/YEN Concentrated Pool",
        tokenA: { 
          name: "New Taiwan Dollar", 
          symbol: "NTD", 
          keypair: Keypair.fromSecretKey(
            new Uint8Array(JSON.parse(fs.readFileSync("./keys/ntd-mint.json", "utf8")))
          )
        },
        tokenB: { 
          name: "Japanese Yen", 
          symbol: "YEN", 
          keypair: Keypair.fromSecretKey(
            new Uint8Array(JSON.parse(fs.readFileSync("./keys/yen-mint.json", "utf8")))
          )
        },
        poolType: 2, // Concentrated liquidity - better price discovery for direct NTD/YEN
        initialLiquidity: { amountA: 3200000, amountB: 15000000 } // ~32 NTD = 150 YEN
      }
    ];

    // 3. Create Token Mints
    console.log("\nCreating currency token mints...");
    const uniqueTokens = new Map();
    
    for (const pool of currencyPools) {
      // Create Token A if not exists
      if (!uniqueTokens.has(pool.tokenA.symbol)) {
        console.log(`Creating ${pool.tokenA.name} (${pool.tokenA.symbol}) mint...`);
        pool.tokenA.mint = await createMint(
          connection,
          deployerKeypair,
          deployerKeypair.publicKey,
          deployerKeypair.publicKey,
          6, // All currencies use 6 decimals
          pool.tokenA.keypair
        );
        uniqueTokens.set(pool.tokenA.symbol, pool.tokenA.mint);
        console.log(`${pool.tokenA.symbol} Mint: ${pool.tokenA.mint.toString()}`);
      } else {
        pool.tokenA.mint = uniqueTokens.get(pool.tokenA.symbol);
        console.log(`Reusing ${pool.tokenA.symbol} Mint: ${pool.tokenA.mint.toString()}`);
      }

      // Create Token B if not exists
      if (!uniqueTokens.has(pool.tokenB.symbol)) {
        console.log(`Creating ${pool.tokenB.name} (${pool.tokenB.symbol}) mint...`);
        pool.tokenB.mint = await createMint(
          connection,
          deployerKeypair,
          deployerKeypair.publicKey,
          deployerKeypair.publicKey,
          6, // All currencies use 6 decimals
          pool.tokenB.keypair
        );
        uniqueTokens.set(pool.tokenB.symbol, pool.tokenB.mint);
        console.log(`${pool.tokenB.symbol} Mint: ${pool.tokenB.mint.toString()}`);
      } else {
        pool.tokenB.mint = uniqueTokens.get(pool.tokenB.symbol);
        console.log(`Reusing ${pool.tokenB.symbol} Mint: ${pool.tokenB.mint.toString()}`);
      }
    }

    // 4. Initialize Anchor Program
    const provider = new anchor.AnchorProvider(
      connection,
      new anchor.Wallet(deployerKeypair),
      { commitment: "confirmed" }
    );
    
    anchor.setProvider(provider);
    const program = new Program(IDL as any, provider);

    // 5. Setup Each Pool
    console.log("\nInitializing currency exchange pools...");
    
    const poolSummary: any[] = [];
    
    for (let i = 0; i < currencyPools.length; i++) {
      const pool = currencyPools[i];
      console.log(`\n--- ${pool.name} ---`);
      
      // Debug: Print token mint addresses for verification
      console.log(`Token A Mint (${pool.tokenA.symbol}): ${pool.tokenA.mint!.toString()}`);
      console.log(`Token B Mint (${pool.tokenB.symbol}): ${pool.tokenB.mint!.toString()}`);
      
      // Derive PDAs
      const [poolState] = PublicKey.findProgramAddressSync(
        [Buffer.from("pool"), pool.tokenA.mint!.toBuffer(), pool.tokenB.mint!.toBuffer()],
        programId
      );
      
      // Debug: Show expected vs calculated pool state
      console.log(`Expected Pool State: ${poolState.toString()}`);
      
      const [lpMint] = PublicKey.findProgramAddressSync(
        [Buffer.from("lp_mint"), pool.tokenA.mint!.toBuffer(), pool.tokenB.mint!.toBuffer()],
        programId
      );
      
      const [poolAuthority] = PublicKey.findProgramAddressSync(
        [Buffer.from("pool_authority"), pool.tokenA.mint!.toBuffer(), pool.tokenB.mint!.toBuffer()],
        programId
      );

      // Derive vault PDAs using the same seeds as in Rust code
      const [vaultA] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault_a"), pool.tokenA.mint!.toBuffer(), pool.tokenB.mint!.toBuffer()],
        programId
      );
      
      const [vaultB] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault_b"), pool.tokenA.mint!.toBuffer(), pool.tokenB.mint!.toBuffer()],
        programId
      );

      console.log(`Pool State: ${poolState.toString()}`);
      console.log(`LP Mint: ${lpMint.toString()}`);
      console.log(`Pool Authority: ${poolAuthority.toString()}`);
      console.log(`Vault A (${pool.tokenA.symbol}): ${vaultA.toString()}`);
      console.log(`Vault B (${pool.tokenB.symbol}): ${vaultB.toString()}`);

      // Initialize Pool with PDA vaults - no signers needed for vaults
      console.log(`Initializing ${pool.name} (Type: ${pool.poolType})...`);
      const tx = await program.methods
        .initializePool(pool.poolType)
        .accounts({
          poolState,
          tokenAMint: pool.tokenA.mint!,
          tokenBMint: pool.tokenB.mint!,
          lpMint,
          tokenAVault: vaultA,
          tokenBVault: vaultB,
          poolAuthority,
          payer: deployerKeypair.publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([deployerKeypair])  // Only deployer signs - vaults are PDAs
        .rpc();

      console.log(`${pool.name} initialized! TX: ${tx}`);

      // Create user token accounts for initial liquidity
      console.log(`Creating user token accounts for initial liquidity...`);
      
      const userTokenA = await getOrCreateAssociatedTokenAccount(
        connection,
        deployerKeypair,
        pool.tokenA.mint!,
        deployerKeypair.publicKey
      );

      const userTokenB = await getOrCreateAssociatedTokenAccount(
        connection,
        deployerKeypair,
        pool.tokenB.mint!,
        deployerKeypair.publicKey
      );

      const userLpToken = await getOrCreateAssociatedTokenAccount(
        connection,
        deployerKeypair,
        lpMint,
        deployerKeypair.publicKey
      );

      // Mint tokens to user accounts
      console.log(`Minting tokens to user accounts...`);
      const amountAWithDecimals = pool.initialLiquidity.amountA * Math.pow(10, 6);
      const amountBWithDecimals = pool.initialLiquidity.amountB * Math.pow(10, 6);
      
      await mintTo(
        connection,
        deployerKeypair,
        pool.tokenA.mint!,
        userTokenA.address,
        deployerKeypair,
        amountAWithDecimals
      );
      
      await mintTo(
        connection,
        deployerKeypair,
        pool.tokenB.mint!,
        userTokenB.address,
        deployerKeypair,
        amountBWithDecimals
      );

      // Add initial liquidity to the pool
      console.log(`Adding initial liquidity to ${pool.name}...`);
      const addLiquidityTx = await program.methods
        .addLiquidity(
          new anchor.BN(amountAWithDecimals),
          new anchor.BN(amountBWithDecimals)
        )
        .accounts({
          poolState,
          userTokenA: userTokenA.address,
          userTokenB: userTokenB.address,
          userLpToken: userLpToken.address,
          poolTokenAVault: vaultA,
          poolTokenBVault: vaultB,
          lpMint,
          poolAuthority,
          userAuthority: deployerKeypair.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([deployerKeypair])
        .rpc();

      console.log(`Initial liquidity added! TX: ${addLiquidityTx}`);
      console.log(`Added ${pool.initialLiquidity.amountA} ${pool.tokenA.symbol} and ${pool.initialLiquidity.amountB} ${pool.tokenB.symbol}`);

      // Store pool info for summary
      poolSummary.push({
        name: pool.name,
        type: pool.poolType === 0 ? "Standard" : pool.poolType === 1 ? "Stable" : "Concentrated",
        tokenA: `${pool.tokenA.symbol} (${pool.tokenA.mint!.toString()})`,
        tokenB: `${pool.tokenB.symbol} (${pool.tokenB.mint!.toString()})`,
        poolState: poolState.toString(),
        lpMint: lpMint.toString(),
        vaultAAddress: vaultA.toString(),
        vaultBAddress: vaultB.toString(),
        initialLiquidity: `${pool.initialLiquidity.amountA} ${pool.tokenA.symbol} / ${pool.initialLiquidity.amountB} ${pool.tokenB.symbol}`
      });
    }

    // 6. Print Final Summary
    console.log("\nTHREE CURRENCY EXCHANGE POOLS SETUP COMPLETE!");
    console.log("=====================================================");
    console.log("\nAvailable Currency Exchange Routes:");
    console.log("1. NTD <-> USD (Stable Pool - 0.05% fee)");
    console.log("2. USD <-> YEN (Standard Pool - 0.3% fee)");
    console.log("3. NTD <-> YEN (Concentrated Pool - 0.5% fee)");
    
    console.log("\nPool Details:");
    poolSummary.forEach((pool, index) => {
      console.log(`\n${index + 1}. ${pool.name} (${pool.type})`);
      console.log(`   Token A: ${pool.tokenA}`);
      console.log(`   Token B: ${pool.tokenB}`);
      console.log(`   Pool State: ${pool.poolState}`);
      console.log(`   LP Mint: ${pool.lpMint}`);
      console.log(`   Vault A: ${pool.vaultAAddress}`);
      console.log(`   Vault B: ${pool.vaultBAddress}`);
      console.log(`   Initial Liquidity: ${pool.initialLiquidity}`);
    });

    console.log("\nReady for currency exchange operations!");
    console.log("=====================================================");

    process.exit(0);

  } catch (error) {
    console.error("Three-pool setup failed:");
    console.error(error);
    process.exit(1);
  }
}

// Run the setup
setupThreeCurrencyPools();
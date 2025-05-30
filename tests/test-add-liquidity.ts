import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import * as fs from "fs";
import dotenv from "dotenv";

dotenv.config();

// Hardcoded IDL
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

async function testAddLiquidity() {
  try {
    console.log("Testing AMM Add Liquidity Function...");
    console.log("====================================");

    // Load deployer keypair
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
    
    // Load token mint keypairs from ./keys folder (following setup script pattern)
    const ntdMintKeypair = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(fs.readFileSync("./keys/ntd-mint.json", "utf8")))
    );
    const usdMintKeypair = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(fs.readFileSync("./keys/usd-mint.json", "utf8")))
    );

    // Get the public keys from the keypairs
    const ntdMint = ntdMintKeypair.publicKey;
    const usdMint = usdMintKeypair.publicKey;

    console.log(`Deployer: ${deployerKeypair.publicKey.toString()}`);
    console.log(`NTD Mint: ${ntdMint.toString()}`);
    console.log(`USD Mint: ${usdMint.toString()}`);

    // Initialize Anchor Program
    const provider = new anchor.AnchorProvider(
      connection,
      new anchor.Wallet(deployerKeypair),
      { commitment: "confirmed" }
    );
    anchor.setProvider(provider);
    const program = new Program(IDL as any, provider);

    // Derive PDAs
    const [poolState] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool"), ntdMint.toBuffer(), usdMint.toBuffer()],
      programId
    );

    const [lpMint] = PublicKey.findProgramAddressSync(
      [Buffer.from("lp_mint"), ntdMint.toBuffer(), usdMint.toBuffer()],
      programId
    );

    const [poolAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool_authority"), ntdMint.toBuffer(), usdMint.toBuffer()],
      programId
    );

    const [vaultA] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_a"), ntdMint.toBuffer(), usdMint.toBuffer()],
      programId
    );

    const [vaultB] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_b"), ntdMint.toBuffer(), usdMint.toBuffer()],
      programId
    );

    console.log(`Pool State: ${poolState.toString()}`);
    console.log(`LP Mint: ${lpMint.toString()}`);
    console.log(`Pool Authority: ${poolAuthority.toString()}`);
    console.log(`Vault A (NTD): ${vaultA.toString()}`);
    console.log(`Vault B (USD): ${vaultB.toString()}`);

    // Get or create user token accounts
    const userNtdAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      deployerKeypair,
      ntdMint,
      deployerKeypair.publicKey
    );

    const userUsdAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      deployerKeypair,
      usdMint,
      deployerKeypair.publicKey
    );

    const userLpAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      deployerKeypair,
      lpMint,
      deployerKeypair.publicKey
    );

    console.log(`User NTD Account: ${userNtdAccount.address.toString()}`);
    console.log(`User USD Account: ${userUsdAccount.address.toString()}`);
    console.log(`User LP Account: ${userLpAccount.address.toString()}`);

    // Check balances before adding liquidity
    const ntdBalanceBefore = userNtdAccount.amount;
    const usdBalanceBefore = userUsdAccount.amount;
    const lpBalanceBefore = userLpAccount.amount;
    
    console.log(`\nBalances before adding liquidity:`);
    console.log(`NTD: ${Number(ntdBalanceBefore) / 1e6}`);
    console.log(`USD: ${Number(usdBalanceBefore) / 1e6}`);
    console.log(`LP: ${Number(lpBalanceBefore) / 1e6}`);

    // Mint some tokens for testing if needed
    if (ntdBalanceBefore < 2000 * 1e6) {
      console.log(`\nMinting 2000 NTD tokens for testing...`);
      await mintTo(
        connection,
        deployerKeypair,
        ntdMint,
        userNtdAccount.address,
        deployerKeypair,
        2000 * 1e6 // 2000 NTD
      );
    }

    if (usdBalanceBefore < 100 * 1e6) {
      console.log(`Minting 100 USD tokens for testing...`);
      await mintTo(
        connection,
        deployerKeypair,
        usdMint,
        userUsdAccount.address,
        deployerKeypair,
        100 * 1e6 // 100 USD
      );
    }

    // Add liquidity: 320 NTD + 10 USD (32:1 ratio)
    const amountNtd = 320 * 1e6; // 320 NTD
    const amountUsd = 10 * 1e6;  // 10 USD

    console.log(`\nAdding liquidity:`);
    console.log(`NTD amount: ${amountNtd / 1e6}`);
    console.log(`USD amount: ${amountUsd / 1e6}`);

    const addLiquidityTx = await program.methods
      .addLiquidity(
        new anchor.BN(amountNtd),
        new anchor.BN(amountUsd)
      )
      .accounts({
        poolState,
        userTokenA: userNtdAccount.address,
        userTokenB: userUsdAccount.address,
        userLpToken: userLpAccount.address,
        poolTokenAVault: vaultA,
        poolTokenBVault: vaultB,
        lpMint,
        poolAuthority,
        userAuthority: deployerKeypair.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([deployerKeypair])
      .rpc();

    console.log(`\nAdd liquidity successful! TX: ${addLiquidityTx}`);

    // Check balances after adding liquidity
    const ntdAccountAfter = await getOrCreateAssociatedTokenAccount(
      connection,
      deployerKeypair,
      ntdMint,
      deployerKeypair.publicKey
    );

    const usdAccountAfter = await getOrCreateAssociatedTokenAccount(
      connection,
      deployerKeypair,
      usdMint,
      deployerKeypair.publicKey
    );

    const lpAccountAfter = await getOrCreateAssociatedTokenAccount(
      connection,
      deployerKeypair,
      lpMint,
      deployerKeypair.publicKey
    );

    const ntdBalanceAfter = ntdAccountAfter.amount;
    const usdBalanceAfter = usdAccountAfter.amount;
    const lpBalanceAfter = lpAccountAfter.amount;

    console.log(`\nBalances after adding liquidity:`);
    console.log(`NTD: ${Number(ntdBalanceAfter) / 1e6} (change: ${(Number(ntdBalanceAfter) - Number(ntdBalanceBefore)) / 1e6})`);
    console.log(`USD: ${Number(usdBalanceAfter) / 1e6} (change: ${(Number(usdBalanceAfter) - Number(usdBalanceBefore)) / 1e6})`);
    console.log(`LP: ${Number(lpBalanceAfter) / 1e6} (change: ${(Number(lpBalanceAfter) - Number(lpBalanceBefore)) / 1e6})`);

    console.log(`\nAdd liquidity test completed successfully!`);

  } catch (error) {
    console.error("Add liquidity test failed:");
    console.error(error);
    process.exit(1);
  }
}

// Run the test
testAddLiquidity();
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
      "name": "remove_liquidity",
      "discriminator": [80, 85, 209, 72, 24, 206, 177, 108],
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
          "name": "lp_amount",
          "type": "u64"
        },
        {
          "name": "minimum_a_out",
          "type": "u64"
        },
        {
          "name": "minimum_b_out",
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

async function testRemoveLiquidity() {
  try {
    console.log("Testing AMM Remove Liquidity Function...");
    console.log("======================================");

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

    // Check balances before removing liquidity
    const ntdBalanceBefore = userNtdAccount.amount;
    const usdBalanceBefore = userUsdAccount.amount;
    const lpBalanceBefore = userLpAccount.amount;
    
    console.log(`\nBalances before removing liquidity:`);
    console.log(`NTD: ${Number(ntdBalanceBefore) / 1e6}`);
    console.log(`USD: ${Number(usdBalanceBefore) / 1e6}`);
    console.log(`LP: ${Number(lpBalanceBefore) / 1e6}`);

    // Check if user has LP tokens
    if (lpBalanceBefore === BigInt(0)) {
      console.log("\nError: User has no LP tokens to remove!");
      console.log("Please run test-add-liquidity.ts first to get LP tokens.");
      process.exit(1);
    }

    // Remove liquidity: 25% of LP tokens
    const lpToRemove = lpBalanceBefore / BigInt(4); // Remove 25% of LP tokens
    const minimumNtdOut = 1 * 1e6; // Minimum 1 NTD (adjust as needed)
    const minimumUsdOut = 0.01 * 1e6; // Minimum 0.01 USD (adjust as needed)

    console.log(`\nRemoving liquidity:`);
    console.log(`LP tokens to remove: ${Number(lpToRemove) / 1e6}`);
    console.log(`Minimum NTD out: ${minimumNtdOut / 1e6}`);
    console.log(`Minimum USD out: ${minimumUsdOut / 1e6}`);

    const removeLiquidityTx = await program.methods
      .removeLiquidity(
        new anchor.BN(lpToRemove.toString()),
        new anchor.BN(minimumNtdOut),
        new anchor.BN(minimumUsdOut)
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

    console.log(`\nRemove liquidity successful! TX: ${removeLiquidityTx}`);

    // Check balances after removing liquidity
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

    console.log(`\nBalances after removing liquidity:`);
    console.log(`NTD: ${Number(ntdBalanceAfter) / 1e6} (change: ${(Number(ntdBalanceAfter) - Number(ntdBalanceBefore)) / 1e6})`);
    console.log(`USD: ${Number(usdBalanceAfter) / 1e6} (change: ${(Number(usdBalanceAfter) - Number(usdBalanceBefore)) / 1e6})`);
    console.log(`LP: ${Number(lpBalanceAfter) / 1e6} (change: ${(Number(lpBalanceAfter) - Number(lpBalanceBefore)) / 1e6})`);

    console.log(`\nRemove liquidity test completed successfully!`);

  } catch (error) {
    console.error("Remove liquidity test failed:");
    console.error(error);
    process.exit(1);
  }
}

// Run the test
testRemoveLiquidity();
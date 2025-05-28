import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import * as fs from "fs";
import dotenv from "dotenv";

dotenv.config();

async function airdropSol() {
  try {
    console.log("Requesting SOL airdrop...");

    const deployerKeypair = Keypair.fromSecretKey(
      new Uint8Array(
        JSON.parse(fs.readFileSync("./keys/devnet-deployer.json", "utf8"))
      )
    );

    const connection = new Connection(
      process.env.ANCHOR_PROVIDER_URL || "https://api.devnet.solana.com",
      "confirmed"
    );

    console.log(`Deployer: ${deployerKeypair.publicKey.toString()}`);
    console.log(`RPC: ${connection.rpcEndpoint}`);

    // Check current balance
    const currentBalance = await connection.getBalance(deployerKeypair.publicKey);
    console.log(`Current balance: ${currentBalance / LAMPORTS_PER_SOL} SOL`);

    // Simply request 5 SOL airdrop
    console.log("Requesting 5 SOL airdrop...");
    
    try {
      const airdropSignature = await connection.requestAirdrop(
        deployerKeypair.publicKey,
        5 * LAMPORTS_PER_SOL
      );
      
      console.log(`Airdrop signature: ${airdropSignature}`);
      await connection.confirmTransaction(airdropSignature, "confirmed");
      
      // Check new balance
      const newBalance = await connection.getBalance(deployerKeypair.publicKey);
      console.log(`Airdrop successful! New balance: ${newBalance / LAMPORTS_PER_SOL} SOL`);
      
    } catch (error) {
      console.log("Airdrop failed:", error.message);
      console.log("Continuing with deployment anyway...");
    }

    process.exit(0);
  } catch (error) {
    console.log("Airdrop script error:", error.message);
    console.log("Continuing with deployment...");
    process.exit(0);
  }
}

airdropSol();
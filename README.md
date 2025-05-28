Solana AMM Educational Template
===============================

A structured, automation-ready Solana Automated Market Maker (AMM) template, built for Devnet deployment and educational demonstration.

Overview
--------

This project provides a minimal yet extensible AMM program implemented with Anchor on the Solana blockchain. It includes full Devnet deployment automation via GitHub Actions, secure keypair management, and initialization scripts for multi-token pool configuration.

Key Features
------------

- Anchor 0.31.1 compatible Solana smart contract
- Three predefined currency pairs: NTD/USD, USD/YEN, NTD/YEN
- GitHub Actions workflow for automated build, deployment, and pool setup
- Secure Base64 keypair decoding from GitHub Secrets
- TypeScript-based utility scripts for airdrops, vault initialization, and key generation
- Conditional deployment logic to skip redundant redeployments
- Supports scheduled (cron) and manual (workflow_dispatch) deployments

Liquidity Pool Design Rationale
===============================

This project includes three currency pairs, each with distinct fee structures and liquidity models. While at first glance the configuration may appear inconsistent, it is intentionally designed to simulate real-world differences in market depth and trading cost.

1. USD-JPY Pool (Stable Pool, 0.05% Fee)
----------------------------------------

- Represents one of the most liquid forex pairs globally.
- Tight spreads and deep liquidity in interbank markets.
- Used here to simulate major currency pairs with minimal slippage.

2. NTD-USD Pool (Standard Pool, 0.3% Fee)
-----------------------------------------

- Represents a regional currency pair with moderate trading volume.
- Models a typical exchange environment for less dominant but still active currency pairs.

3. NTD-JPY Pool (Concentrated Liquidity, 0.5% Fee)
--------------------------------------------------

- Simulates a niche or low-volume currency pair.
- Liquidity is concentrated in narrow price bands.
- Higher fees reflect wider spreads and lower liquidity.

Educational Value
-----------------

This configuration enables learners to explore:

- Why different currency pairs have different fee structures.
- How liquidity depth influences trading cost and slippage.
- When to trade directly versus via an intermediate currency (e.g., NTD → USD → JPY).

By aligning pool behavior with real-world financial dynamics, the AMM serves not just as a technical demo, but also as an educational simulation of global FX market mechanics.

Required Key Files
==================

The project requires 10 local JSON keypair files, decoded from GitHub Secrets at runtime.

1. Deployer Wallet (1 file)
---------------------------

    keys/devnet-deployer.json

This is the main wallet used for deploying the program and executing pool initialization transactions.

2. Token Mint Keypairs (3 files)
--------------------------------

    keys/ntd-mint.json     # Mint keypair for NTD
    keys/usd-mint.json     # Mint keypair for USD
    keys/yen-mint.json     # Mint keypair for YEN

These represent the three token mints used by the AMM pools.

3. Pool Vault Accounts (6 files)
--------------------------------

Each liquidity pool requires two vaults: one for each token in the pair.

    # NTD/USD Pool
    keys/ntd-usd-vault-a.json     # NTD vault
    keys/ntd-usd-vault-b.json     # USD vault

    # USD/YEN Pool
    keys/usd-yen-vault-a.json     # USD vault
    keys/usd-yen-vault-b.json     # YEN vault

    # NTD/YEN Pool
    keys/ntd-yen-vault-a.json     # NTD vault
    keys/ntd-yen-vault-b.json     # YEN vault

Summary
-------

- 1 deployer wallet keypair
- 3 token mint keypairs
- 6 vault account keypairs

All 10 JSON keypair files must be base64-encoded and uploaded as GitHub Secrets before deployment.

Directory Structure
-------------------

| Path                  | Description                                 |
|-----------------------|---------------------------------------------|
| `programs/`           | Anchor program source code                  |
| `scripts/`            | TypeScript scripts (airdrop, keygen, setup) |
| `.github/workflows/`  | GitHub Actions CI/CD workflow               |
| `keys/`               | Keypair storage                             |
| `target/deploy/`      | Anchor program keypair file location        |

Usage
-----

1. Generate Keypairs
   Run the key generation script locally:

       yarn ts-node scripts/generate-keys.ts

   Encode each resulting JSON file in base64 and store them as GitHub Secrets.

2. Manual Deployment
   Trigger the deployment manually via GitHub Actions (workflow_dispatch).

3. Scheduled Deployment
   The deployment workflow will run every hour by default (via cron trigger).

4. Devnet Pool Initialization
   The `setup-devnet-pool.ts` script automatically initializes the 3 predefined pools during deployment.

Security
--------

Keypairs are never committed to the repository. All private keys are stored in GitHub Secrets and decoded during workflow execution only. File permissions are explicitly set to 600 before use.

Requirements
------------

- Yarn
- ts-node
- Solana CLI (Agave / v2.x)
- Rust (nightly)
- Anchor CLI (via AVM)

License
-------

This project is licensed under the MIT License. See LICENSE for details.

Author
------

Yuanyu Lin  
Kaohsiung, Taiwan  

# Solana AMM Backend

A NestJS backend service for a 3-pool Automated Market Maker (AMM) on Solana, featuring real-time WebSocket communication and Supabase authentication.

## Features

- **3 Currency Pools**: NTD-USD (Stable), USD-YEN (Standard), NTD-YEN (Concentrated)
- **WebSocket Communication**: Real-time pool states and transaction updates
- **Supabase Integration**: JWT authentication and user data management
- **Memory Caching**: Efficient RPC call management for Solana devnet
- **Transaction Execution**: Swap, add liquidity, remove liquidity operations

## Architecture

```
Frontend (Vercel) 
    ↓ WebSocket + JWT
NestJS Backend (Render)
    ↓ RPC Calls
Solana Devnet Program
```

## Installation

```bash
# Install dependencies
yarn install

# Install additional required packages
yarn add jsonwebtoken @solana/spl-token
yarn add -D @types/jsonwebtoken
```

## Environment Variables

Create `.env` file in project root:

```env
# Solana Configuration
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_PROGRAM_ID=6zvNunxSBZdFAbwMUZCQuCYg19owNb6hvDMv3Z5mYML2

# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_JWT_SECRET=your_jwt_secret

# Frontend Configuration
FRONTEND_URL=http://localhost:3000
PORT=3001

# Token Mints
NTD_MINT=9ZNR5SDKdvUjh1PogrZQYrJ851zv2c4bkpGZaidMFP7V
USD_MINT=EZNZ1GnxJoFAGBUeKGtf7zCcz6F5CtbQCPBkSzVwWUmh
YEN_MINT=AifcapG2iHSTfUiG2ppP4EURm2xsRMGo5ZaWVRkKgkYH

# Pool States
NTD_USD_POOL_STATE=FQwvvVsAWPG5UY33DABQfd1UmykmzNauA7gmFuAUHz6S
USD_YEN_POOL_STATE=BE4GvdHvBT1jub2NaXNS5ZfxhAfyWeJ97bik34Kt1Dao
NTD_YEN_POOL_STATE=BB9vx7vuXhMbkZCtNYqhZCXtszVAgGWGwjBdDhYUd8jC

# Vault Addresses
NTD_USD_VAULT_A=EmcvfAnVSy8opmga89LXetkmpubeqTJ4YcGe6u4edH6G
NTD_USD_VAULT_B=FAb2CZ7RoH2DsLDXLR8LRX52sd2CBPEwPWgqavcvYYgz
USD_YEN_VAULT_A=Hmc3BEfyjMNYUiXmdenNNXJTF5E8GTMz5cEb155Lw9Ad
USD_YEN_VAULT_B=JugQYbhGQqsxt8DVY2qRcgvJxvzBiYS14HcYNMm8FXZ
NTD_YEN_VAULT_A=EuagcnrEbB1cezWsu8Za9UB76opjwi7HjrFZFZyJDbHU
NTD_YEN_VAULT_B=6sa2W96hn1oTF47ohQ98Zc6Jd7CEUojcGRTWKUGz6RRj
```

## Running the Application

```bash
# Development mode
yarn start:dev

# Production mode
yarn build
yarn start:prod
```

## Pool Configuration

### 1. NTD/USD Pool (Stable Pool)
- **Type**: Stable (Type 1)
- **Fee**: 0.05% (50 basis points)
- **Description**: Simulates major currency pair with minimal slippage
- **Initial Liquidity**: 3,200,000 NTD / 100,000 USD

### 2. USD/YEN Pool (Standard Pool)
- **Type**: Standard (Type 0)
- **Fee**: 0.3% (300 basis points)
- **Description**: Typical exchange environment with constant product formula
- **Initial Liquidity**: 100,000 USD / 15,000,000 YEN

### 3. NTD/YEN Pool (Concentrated Pool)
- **Type**: Concentrated (Type 2)
- **Fee**: 0.5% (500 basis points)
- **Description**: Niche currency pair with concentrated liquidity
- **Initial Liquidity**: 3,200,000 NTD / 15,000,000 YEN

## WebSocket API

### Connection
```javascript
const socket = io('ws://localhost:3001', {
  auth: { token: 'your-supabase-jwt-token' }
});
```

### Events

#### Receiving Events
```javascript
// Pool states update (broadcast to all clients)
socket.on('pools_update', (data) => {
  console.log('Pool states:', data.data);
});

// User portfolio update (sent to specific user)
socket.on('user_portfolio', (data) => {
  console.log('Portfolio:', data.data);
});

// Transaction result
socket.on('transaction_result', (result) => {
  console.log('Transaction:', result);
});
```

#### Sending Events
```javascript
// Execute swap
socket.emit('swap', {
  poolType: 'NTD-USD',
  amountIn: 1000,
  tokenType: 'A', // 'A' for first token, 'B' for second
  minAmountOut: 950
});

// Add liquidity
socket.emit('add_liquidity', {
  poolType: 'USD-YEN',
  amountA: 100,
  amountB: 15000
});

// Remove liquidity
socket.emit('remove_liquidity', {
  poolType: 'NTD-YEN',
  lpAmount: 50,
  minAmountA: 1000,
  minAmountB: 5000
});
```

## Database Schema (Supabase)

### user_profiles
```sql
create table user_profiles (
  id uuid primary key references auth.users(id),
  email text not null,
  wallet_address text not null,
  private_key_b64 text,  -- base64 encoded private key for educational use
  created_at timestamptz default now()
);
```

### lp_snapshots
```sql
create table lp_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references user_profiles(id),
  wallet_address text not null,
  lp_token_amount numeric not null,
  token_a_amount numeric not null,
  token_b_amount numeric not null,
  total_value_usd numeric,
  captured_at timestamptz default now()
);
```

### wallet_balances
```sql
create table wallet_balances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references user_profiles(id),
  wallet_address text not null,
  token_a_balance numeric not null,
  token_b_balance numeric not null,
  captured_at timestamptz default now()
);
```

## Testing

### 1. WebSocket Test Client

Create `test-client.js`:
```javascript
const io = require('socket.io-client');

const socket = io('http://localhost:3001', {
  auth: { token: 'your-jwt-token-here' }
});

socket.on('connect', () => {
  console.log(' Connected to WebSocket');
});

socket.on('pools_update', (data) => {
  console.log(' Pool Update:', JSON.stringify(data, null, 2));
});

socket.on('transaction_result', (result) => {
  console.log(' Transaction Result:', result);
});

socket.on('disconnect', () => {
  console.log(' Disconnected');
});

// Test swap after 3 seconds
setTimeout(() => {
  socket.emit('swap', {
    poolType: 'NTD-USD',
    amountIn: 1000,
    tokenType: 'A',
    minAmountOut: 30
  });
}, 3000);
```

Run test:
```bash
yarn add -D socket.io-client
node test-client.js
```

### 2. HTTP Health Check
```bash
curl http://localhost:3001
```

## Project Structure

```
src/
├── config/              # Configuration files
├── common/              # Shared utilities
├── solana/              # Solana blockchain integration
│   ├── program/         # Anchor program interaction
│   └── watchers/        # Pool state monitoring
├── database/            # Supabase integration
├── cache/               # Memory caching
├── gateway/             # WebSocket gateway
├── app.module.ts        # Main application module
└── main.ts              # Application entry point
```

## Key Services

- **SolanaService**: Handles transaction execution using user private keys
- **ProgramService**: Interacts with Solana AMM program via Anchor
- **PoolWatcher**: Monitors pool states every 3 seconds to minimize RPC calls
- **MemoryCacheService**: Caches pool states in memory (no Redis required)
- **SupabaseService**: Manages user authentication and data
- **AppGateway**: WebSocket communication hub

## Deployment

### Render.com
1. Connect GitHub repository
2. Set environment variables
3. Build command: `yarn build`
4. Start command: `yarn start:prod`

### Environment Variables in Production
Make sure to set all environment variables listed above in your deployment platform.

## Development Notes

- **Educational Purpose**: Private keys are stored in database for demo convenience
- **Devnet Only**: Configured for Solana devnet, never use on mainnet
- **Free Tier Optimized**: Minimizes RPC calls to stay within free limits
- **Memory Cache**: No Redis dependency for cost efficiency

## Contributing

This is an educational template. For production use:
1. Implement proper key management (never store private keys in database)
2. Add rate limiting and additional security measures
3. Implement comprehensive error handling
4. Add monitoring and logging
5. Use connection pooling for database operations

## License

Educational use only. Not for production deployment.
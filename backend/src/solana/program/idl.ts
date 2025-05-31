export const IDL = {
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
      "discriminator": [
        181,
        157,
        89,
        67,
        143,
        182,
        52,
        72
      ],
      "accounts": [
        {
          "name": "pool_state",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
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
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  97
                ]
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
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  98
                ]
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
                "value": [
                  112,
                  111,
                  111,
                  108,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
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
      "discriminator": [
        95,
        180,
        10,
        172,
        84,
        174,
        232,
        40
      ],
      "accounts": [
        {
          "name": "pool_state",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
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
                "value": [
                  108,
                  112,
                  95,
                  109,
                  105,
                  110,
                  116
                ]
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
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  97
                ]
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
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  98
                ]
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
                "value": [
                  112,
                  111,
                  111,
                  108,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
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
    },
    {
      "name": "remove_liquidity",
      "discriminator": [
        80,
        85,
        209,
        72,
        24,
        206,
        177,
        108
      ],
      "accounts": [
        {
          "name": "pool_state",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
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
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  97
                ]
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
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  98
                ]
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
                "value": [
                  112,
                  111,
                  111,
                  108,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
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
    },
    {
      "name": "swap",
      "discriminator": [
        248,
        198,
        158,
        145,
        225,
        117,
        135,
        200
      ],
      "accounts": [
        {
          "name": "pool_state",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
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
          "name": "pool_token_a_vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  97
                ]
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
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  98
                ]
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
          "name": "pool_authority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
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
          "name": "amount_in",
          "type": "u64"
        },
        {
          "name": "minimum_amount_out",
          "type": "u64"
        },
        {
          "name": "a_to_b",
          "type": "bool"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "PoolState",
      "discriminator": [
        247,
        237,
        227,
        245,
        215,
        195,
        222,
        70
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "InsufficientLiquidity",
      "msg": "Insufficient liquidity in the pool"
    },
    {
      "code": 6001,
      "name": "InvalidAmount",
      "msg": "Invalid amount provided"
    },
    {
      "code": 6002,
      "name": "SlippageExceeded",
      "msg": "Slippage tolerance exceeded"
    },
    {
      "code": 6003,
      "name": "InvalidTokenMint",
      "msg": "Invalid token mint"
    },
    {
      "code": 6004,
      "name": "InvalidVaultAuthority",
      "msg": "Invalid vault authority"
    },
    {
      "code": 6005,
      "name": "InsufficientLpBalance",
      "msg": "Insufficient LP token balance"
    },
    {
      "code": 6006,
      "name": "InvalidPoolType",
      "msg": "Invalid pool type"
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
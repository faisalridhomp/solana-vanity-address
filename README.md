# solana-vanity-address

Generate a Solana wallet whose address starts or ends with characters you
pick — a vanity address like `jack...`.

Solana addresses are base58 (no `0`, `O`, `I`, `l`). The only way to find
one is brute force: generate keys until the address matches. This tool uses
Node's built-in `crypto` (OpenSSL, native speed — ~9,000 keys/sec per
core, ~100x faster than pure-JS ed25519) across all your CPU cores.

## Only base58 works

Base58 excludes the characters `0`, `O`, `I` and `l` (lowercase L). A
pattern containing any of those can **never** appear in an address. The
tool rejects such input immediately instead of searching forever.

Valid vanity words: `jack`, `sol`, `moon`, `degen`, `based`... (any
combination of `123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz`).

## Difficulty

Each base58 character makes it 58x harder:

| Pattern | Odds | Typical time* |
|---------|------|---------------|
| 2 chars (`ja`) | 1 in 3,364 | seconds |
| 3 chars | 1 in 195,112 | ~1 minute |
| 4 chars (`jack`) | 1 in 11,316,496 | ~1 hour |
| 5 chars | 1 in 656,356,768 | ~2 days |

*At ~9,000 addresses/sec per core. For 5+ characters use the Rust tool
`solana-keygen grind` instead — it is much faster than any JS.

## Usage

```bash
npm i bs58
node vanity.js <prefix> [suffix] [--threads N]
```

```bash
node vanity.js jack            # address starting with "jack"
node vanity.js jack --threads 8
```

Output on success: address + 64-byte secret key (seed + public key, the
format Solana wallets import).

## Security

The secret key is printed to stdout. Run this on your own machine, never
on a shared server. Never share the secret key.

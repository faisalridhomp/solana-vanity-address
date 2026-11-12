// solana-vanity-address — generate a Solana wallet whose address starts
// or ends with characters you pick, e.g. an address starting with "jack".
//
// Solana addresses are base58 (no 0, O, I, l). Difficulty grows 58x per
// character — a 2-char prefix takes seconds, a 4-char prefix ~1 hour at
// ~9,000 keys/sec/core, a 5-char prefix ~2 days. Keep it short.
//
// Uses Node's built-in crypto (OpenSSL, native speed — ~9,000 keys/sec
// per core, ~100x faster than pure-JS ed25519). No heavy dependencies.
//
// Usage:
//   npm i bs58
//   node vanity.js <prefix> [suffix] [--threads N]
// Examples:
//   node vanity.js jack          -> address starting with "jack"
//   node vanity.js jack --threads 8
//
// SECURITY: the secret key is printed to stdout. Run on your own machine,
// never on a shared server. Never share the secret key.

const { generateKeyPairSync } = require("crypto");
const _bs58 = require("bs58");
// bs58 v6 exports ESM-style: encode lives under .default
const bs58Encode = _bs58.encode || (_bs58.default && _bs58.default.encode);
const { Worker, isMainThread, parentPort, workerData } = require("worker_threads");
const os = require("os");

function mine(prefix, suffix) {
    let tries = 0;
    for (;;) {
        const { publicKey, privateKey } = generateKeyPairSync("ed25519");
        const pub = publicKey.export({ type: "spki", format: "der" }).slice(-32);
        const address = bs58Encode(pub);
        tries++;
        if ((!prefix || address.startsWith(prefix)) && (!suffix || address.endsWith(suffix))) {
            const seed = privateKey.export({ type: "pkcs8", format: "der" }).slice(-32);
            // Solana secret key = 32-byte seed + 32-byte public key
            const secretKey = Buffer.concat([seed, pub]);
            return { address, secretKey, tries };
        }
        if (tries % 50000 === 0) parentPort?.postMessage({ tries });
    }
}

if (!isMainThread) {
    const { prefix, suffix } = workerData;
    const { address, secretKey, tries } = mine(prefix, suffix);
    parentPort.postMessage({ found: true, address, secretKey: Array.from(secretKey), tries });
    process.exit(0);
}

function main() {
    const args = process.argv.slice(2);
    let prefix = "", suffix = "";
    let threads = Math.max(1, os.cpus().length - 1);
    for (let i = 0; i < args.length; i++) {
        if (args[i] === "--threads") threads = parseInt(args[++i], 10) || threads;
        else if (!prefix) prefix = args[i];
        else if (!suffix) suffix = args[i];
    }
    if (!prefix && !suffix) {
        console.log("Usage: node vanity.js <prefix> [suffix] [--threads N]");
        console.log("Example: node vanity.js jack");
        process.exit(1);
    }
    const chars = (prefix + suffix).length;
    const difficulty = Math.pow(58, chars);
    console.log(`target: ${prefix || "*"}...${suffix || "*"} (base58)`);
    console.log(`difficulty: ~1 in ${difficulty.toLocaleString()} addresses`);
    console.log(`threads: ${threads} (started ${new Date().toLocaleTimeString()})`);
    const start = Date.now();
    let totalTries = 0;
    const workers = [];
    for (let i = 0; i < threads; i++) {
        const w = new Worker(__filename, { workerData: { prefix, suffix } });
        workers.push(w);
        w.on("message", (m) => {
            if (m.found) {
                const secs = (Date.now() - start) / 1000;
                console.log(`\nFOUND in ${secs.toFixed(1)}s after ${m.tries.toLocaleString()} tries (this worker):`);
                console.log(`  address:    ${m.address}`);
                console.log(`  secret key: [${m.secretKey.join(",")}]`);
                console.log("\nKeep the secret key secret. It controls this address.");
                for (const x of workers) x.terminate();
                process.exit(0);
            } else if (m.tries) {
                totalTries += m.tries;
                const rate = totalTries / ((Date.now() - start) / 1000);
                const eta = difficulty / Math.max(rate, 1);
                process.stdout.write(`\r${totalTries.toLocaleString()} tried, ~${Math.round(rate).toLocaleString()}/s, ETA ~${eta < 60 ? eta.toFixed(0) + "s" : eta < 3600 ? (eta / 60).toFixed(1) + "m" : (eta / 3600).toFixed(1) + "h"}   `);
            }
        });
    }
}

main();

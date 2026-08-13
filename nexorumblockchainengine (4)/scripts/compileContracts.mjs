/**
 * Compiles contracts/NexorumToken.sol with solc and writes the ABI +
 * bytecode artifact the frontend imports to deploy the contract directly
 * from a connected wallet (see src/components/Portfolio.tsx / Launchpad).
 *
 * Run: npm run compile:contracts
 * Re-run this any time NexorumToken.sol changes — the committed JSON
 * artifact in src/core/contracts/ is what actually ships to the browser.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import solc from 'solc';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const contractPath = path.join(root, 'contracts', 'NexorumToken.sol');
const outPath = path.join(root, 'src', 'core', 'contracts', 'NexorumToken.json');

const source = fs.readFileSync(contractPath, 'utf8');

const input = {
  language: 'Solidity',
  sources: {
    'NexorumToken.sol': { content: source },
  },
  settings: {
    // Pin to a widely-supported EVM version instead of solc's default
    // (which tracks the newest hardfork, e.g. PUSH0 from Shanghai/Cancun).
    // Some L2s, older chains, and some tooling don't support newer opcodes
    // yet — "london" (Aug 2021) is safe almost everywhere a deploy-and-go
    // launchpad token would realistically be sent.
    evmVersion: 'london',
    optimizer: { enabled: true, runs: 200 },
    outputSelection: {
      '*': { '*': ['abi', 'evm.bytecode.object'] },
    },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));

const errors = (output.errors || []).filter((e) => e.severity === 'error');
if (errors.length > 0) {
  for (const e of errors) console.error(e.formattedMessage || e.message);
  process.exit(1);
}
for (const warning of (output.errors || []).filter((e) => e.severity === 'warning')) {
  console.warn(warning.formattedMessage || warning.message);
}

const contract = output.contracts['NexorumToken.sol']['NexorumToken'];
if (!contract) {
  console.error('Compilation succeeded but NexorumToken artifact was not found in output.');
  process.exit(1);
}

const artifact = {
  contractName: 'NexorumToken',
  compiler: `solc ${solc.version()}`,
  abi: contract.abi,
  bytecode: '0x' + contract.evm.bytecode.object,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(artifact, null, 2) + '\n');

console.log(`✓ Compiled NexorumToken.sol → ${path.relative(root, outPath)}`);
console.log(`  compiler: ${artifact.compiler}`);
console.log(`  bytecode: ${artifact.bytecode.length / 2 - 1} bytes`);

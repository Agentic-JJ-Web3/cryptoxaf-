const { TronWeb } = require('tronweb');
const { ethers } = require('ethers');
const { CHAINS } = require('../config/chains');
const { AddressInvalidError, AddressBlockedError, AddressVerificationUnavailableError } = require('./errors');

const TRON_SHAPE = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
const EVM_SHAPE = /^0x[a-fA-F0-9]{40}$/;

// Without this, a slow or rate-limited public RPC hangs on Node's default
// socket timeout (tens of seconds) before the fail-closed error even
// fires — a terrible customer wait for what should be a fast rejection.
const RPC_TIMEOUT_MS = 8000;

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('RPC call timed out')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

let tronWeb;
function getTronWeb() {
  if (!tronWeb) tronWeb = new TronWeb({ fullHost: CHAINS.TRON.rpcUrl });
  return tronWeb;
}

let bscProvider;
function getBscProvider() {
  if (!bscProvider) bscProvider = new ethers.JsonRpcProvider(CHAINS.BSC.rpcUrl);
  return bscProvider;
}

// Shape only, no network call — chain is detected from the address, never
// selected by the user. Messages mirror the client-side hint on the swap
// screen so server and client never disagree about why an address failed.
function detectChainAndShapeError(address) {
  const trimmed = (address || '').trim();
  if (!trimmed) {
    return { chain: null, error: 'Enter a wallet address' };
  }
  if (TRON_SHAPE.test(trimmed)) return { chain: 'TRON', error: null };
  if (EVM_SHAPE.test(trimmed)) return { chain: 'BSC', error: null };
  if (trimmed.startsWith('T')) {
    return { chain: null, error: `Tron addresses are 34 characters. This one is ${trimmed.length}.` };
  }
  if (/^0x/i.test(trimmed)) {
    return { chain: null, error: `BSC and other EVM addresses need 40 hex characters after 0x. This one has ${trimmed.length - 2}.` };
  }
  return { chain: null, error: 'Not a Tron or BSC address. Tron starts with T, BSC starts with 0x.' };
}

function headTail(address) {
  return { head: address.slice(0, 6), tail: address.slice(-6) };
}

function isKnownUsdtContract(chain, address) {
  const known = CHAINS[chain].usdtContractAddress;
  return chain === 'BSC' ? address.toLowerCase() === known.toLowerCase() : address === known;
}

// Anything but "not a contract" is a reject: a wrong allow here is an
// unrecoverable send, so an RPC failure must fail closed, not fail open.
async function isDeployedContract(chain, address) {
  try {
    if (chain === 'TRON') {
      const info = await withTimeout(getTronWeb().trx.getContract(address), RPC_TIMEOUT_MS);
      return !!info?.bytecode;
    }
    const code = await withTimeout(getBscProvider().getCode(address), RPC_TIMEOUT_MS);
    return code !== '0x';
  } catch {
    throw new AddressVerificationUnavailableError();
  }
}

// Full server-side validation: shape, checksum, known-contract blocklist,
// then a live check that the address isn't itself a deployed contract.
// Client-side checks are UX, not security — this is what actually gates
// order creation. Returns the canonical (checksummed, for EVM) address so
// storage and every later display are consistent regardless of how the
// customer's wallet happened to paste it.
async function validateDestinationAddress(address) {
  const trimmed = (address || '').trim();
  const { chain, error } = detectChainAndShapeError(trimmed);
  if (!chain) {
    throw new AddressInvalidError(error);
  }

  const checksumOk = chain === 'TRON' ? getTronWeb().isAddress(trimmed) : ethers.isAddress(trimmed);
  if (!checksumOk) {
    throw new AddressInvalidError("That address fails its checksum. Check it and try again.");
  }

  const normalizedAddress = chain === 'BSC' ? ethers.getAddress(trimmed) : trimmed;

  if (isKnownUsdtContract(chain, normalizedAddress)) {
    throw new AddressBlockedError(
      'That is the USDT contract address itself, not a wallet. Funds sent there are unrecoverable.',
    );
  }

  if (await isDeployedContract(chain, normalizedAddress)) {
    throw new AddressBlockedError('That address is a contract, not a wallet. Sending here may be unrecoverable.');
  }

  return { chain, normalizedAddress, ...headTail(normalizedAddress) };
}

module.exports = { detectChainAndShapeError, validateDestinationAddress, headTail };

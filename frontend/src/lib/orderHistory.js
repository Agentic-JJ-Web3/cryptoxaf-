// Stored on this device only — there is no account, so nothing here is
// ever sent to the server. Clearing browser data or switching phones
// clears this list, and that's by design (see docs/Order History.dc.html).
const ORDERS_KEY = 'cryptoxaf.orderHistory';
const ADDRESSES_KEY = 'cryptoxaf.savedAddresses';
const MAX_ORDERS = 50;
const MAX_ADDRESSES = 5;

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    // Private-browsing storage denial, corrupted JSON, etc. — degrade to
    // "no history" rather than throwing and breaking the page.
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full/denied — the swap still works, it just won't be
    // remembered on this device.
  }
}

function getOrderHistory() {
  return readJson(ORDERS_KEY, []);
}

// Called both right after creation and whenever a status refresh finds a
// newer state, so entries stay up to date without a dedicated sync step.
function saveOrderToHistory({ reference, xafAmount, chain, status, createdAt }) {
  const existing = getOrderHistory().filter((o) => o.reference !== reference);
  const updated = [{ reference, xafAmount, chain, status, createdAt }, ...existing].slice(0, MAX_ORDERS);
  writeJson(ORDERS_KEY, updated);
}

function getSavedAddresses() {
  return readJson(ADDRESSES_KEY, []);
}

function saveAddressToHistory({ chain, address }) {
  const existing = getSavedAddresses().filter((a) => a.address !== address);
  const updated = [{ chain, address }, ...existing].slice(0, MAX_ADDRESSES);
  writeJson(ADDRESSES_KEY, updated);
}

function clearHistory() {
  try {
    localStorage.removeItem(ORDERS_KEY);
    localStorage.removeItem(ADDRESSES_KEY);
  } catch {
    // Nothing to do if storage access itself is denied.
  }
}

export { getOrderHistory, saveOrderToHistory, getSavedAddresses, saveAddressToHistory, clearHistory };

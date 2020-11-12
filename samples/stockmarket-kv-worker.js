/**
 * Listener for Incoming Requests
 */
addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

/**
 * Listener for Scheduled Events
 */
addEventListener("scheduled", (event) => {
  event.waitUntil(refreshCache(event));
});

/**
 * Appends key to value
 */
async function updateMarketWatchKeys(symbol) {
  const keys = await MARKETWATCH_SYMBOLS.get("KEYS");
  const updatedKeys = keys + symbol + ",";
  await MARKETWATCH_SYMBOLS.put("KEYS", updatedKeys);
};

/**
 * If KEYS isn't set yet, initialize it
 */
async function initMarketWatchKeys() {
  const keys = await MARKETWATCH_SYMBOLS.get("KEYS");
  if (keys === null) {
    await MARKETWATCH_SYMBOLS.put("KEYS", "");
  }
};

/**
 * Work-around for .keys()
 * @param {} KVObject
 */
async function getMarketWatchKeys() {
  const keys = await MARKETWATCH_SYMBOLS.get("KEYS");
  if (keys === null) {
    await MARKETWATCH_SYMBOLS.put("KEYS", "");
    return [];
  }
  const keysToArray = keys.split(",");
  keysToArray.pop(); // removes last entry
  return keysToArray;
};

async function getCache(key, value) {
  await MARKETWATCH_SYMBOLS.put(key, value);
};

async function getCache(key) {
  const value = MARKETWATCH_SYMBOLS.get(key);
  return value;
};

async function getYahooStockInfo(symbol) {
  const baseURL = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=`;
  try {
    const summaryProfile = await fetch(`${baseURL}summaryProfile`);
    const summaryProfileJSON = await summaryProfile.json();
    const data = summaryProfileJSON.quoteSummary.result[0].summaryProfile;
    return data;
  } catch (err) {
    throw new Error(400);
  }
};

/**
 * Refreshes Cache Data with the Scheduler
 * @param {*} event
 */
async function refreshCache(event) {
  const KVKeys = await getMarketWatchKeys();
  for (let i = 0; i < KVKeys.length; i++) {
    const symbol = KVKeys[i];
    try {
      const data = await getYahooStockInfo(symbol);
      await setCache(symbol, data);
      return;
    } catch (e) {}
  }
}

/**
 * Handles POST requests
 * @param {} request 
 */
async function handlePostRequest(request) {
  try {
    let body = await request.json();
    const symbol = body.symbol;

    if (!symbol) {
      return new Response(null, {
        status: 400,
        statusText: `Provide symbol on request body`,
      });
    }
    await initMarketWatchKeys();
    // Reads cached value from KV
    const value = await getCache(symbol);
    let res;
    if (value === null) {
      const data = await getYahooStockInfo(symbol);
      await setCache(symbol, JSON.stringify(data));
      await updateMarketWatchKeys(symbol);
      res = JSON.stringify(data);
    } else {
      res = JSON.stringify(value);
    }
    return new Response(res, { status: 200 });
  } catch (err) {
    return new Response(null, { status: 400 });
  }
}

/**
 * Fallback handler for other request methods
 * @param {} request 
 */
async function handleDefaultRequest(request) {
  return new Response(`Request data from symbol (@Body) using POST`);
}

/**
 * Handles Requests
 * @param {Request} request
 */
async function handleRequest(request) {
  switch (request.method) {
    case "POST":
      return await handlePostRequest(request);
      break;
    default:
      return await handleDefaultRequest(request);
      break;
  }
}

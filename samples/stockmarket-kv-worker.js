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

async function setCache(key, value) {
  await MARKETWATCH_SYMBOLS.put(key, value);
};

async function getCache(key) {
  const value = MARKETWATCH_SYMBOLS.get(key);
  return value;
};

/**
 * 
 * @param {*} uri 
 * @param {*} dataPath - string with data path to retrieve (eg, "a.b.etc") 
 */
async function fetchData(uri, dataPath) {
  try {
    const data = await fetch(uri);
    const dataJSON = await data.json();
    // Attempts to retrieve data from a given path
    if (dataPath) {
      return dataPath.split(".").reduce((acc, curr, i) => {
        if (acc[curr]) return acc[curr];
        return acc;
      }, dataJSON);
    }
    return dataJSON;
  } catch (err) {
    throw new Error(400);
  }
}

async function getYahooStockInfo(symbol) {
  const baseURL = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=`;
  // summaryProfile = summaryProfileJSON.quoteSummary.result[0].summaryProfile
  try {

    // rate limit 5 calls/sec
  const summaryProfile = await fetchData(`${baseURL}summaryProfile`, "quoteSummary.result.0.summaryProfile");
  // const summaryDetailRes = await fetchData(`${baseURL}summaryDetail`);


  // const summaryDetail = await fetch(`${baseURL}summaryDetail`);
  // const summaryDetailJSON = await summaryDetail.json();

  // const esgScores = await fetch(`${baseURL}esgScores`);
  // const price = await fetch(`${baseURL}price`);
  // const incomeStatementHistory = await fetch(
  //   `${baseURL}incomeStatementHistory`
  // );
  // setTimeout(() => {}, 1000);
  // const assetProfile = await fetch(`${baseURL}assetProfile`);
  // const incomeStatementHistoryQuarterly = await fetch(
  //   `${baseURL}incomeStatementHistoryQuarterly`
  // );
  // const balanceSheetHistory = await fetch(`${baseURL}balanceSheetHistory`);
  // const balanceSheetHistoryQuarterly = await fetch(
  //   `${baseURL}balanceSheetHistoryQuarterly`
  // );
  // const cashflowStatementHistory = await fetch(
  //   `${baseURL}cashflowStatementHistory`
  // );
  // setTimeout(() => {}, 1000);
  // const defaultKeyStatistics = await fetch(
  //   `${baseURL}defaultKeyStatistics`
  // );
  // const financialData = await fetch(`${baseURL}financialData`);
  // const calendarEvents = await fetch(`${baseURL}calendarEvents`);
  // const secFilings = await fetch(`${baseURL}secFilings`);
  // const recommendationTrend = await fetch(`${baseURL}recommendationTrend`);
  // setTimeout(() => {}, 1000);
  // const upgradeDowngradeHistory = await fetch(
  //   `${baseURL}upgradeDowngradeHistory`
  // );
  // const institutionOwnership = await fetch(
  //   `${baseURL}institutionOwnership`
  // );
  // const fundOwnership = await fetch(`${baseURL}fundOwnership`);
  // const majorDirectHolders = await fetch(`${baseURL}majorDirectHolders`);
  // const majorHoldersBreakdown = await fetch(
  //   `${baseURL}majorHoldersBreakdown`
  // );
  // setTimeout(() => {}, 1000);
  // const insiderTransactions = await fetch(`${baseURL}insiderTransactions`);
  // const insiderHolders = await fetch(`${baseURL}insiderHolders`);
  // const netSharePurchaseActivity = await fetch(
  //   `${baseURL}netSharePurchaseActivity`
  // );
  // const earnings = await fetch(`${baseURL}earnings`);
  // const earningsHistory = await fetch(`${baseURL}earningsHistory`);
  // setTimeout(() => {}, 1000);
  // const earningsTrend = await fetch(`${baseURL}earningsTrend`);
  // const industryTrend = await fetch(`${baseURL}industryTrend`);
  // const indexTrend = await fetch(`${baseURL}indexTrend`);
  // const sectorTrend = await fetch(`${baseURL}sectorTrend`);
  // const cashflowStatementHistoryQuarterly = await fetch(
  //   `${baseURL}cashflowStatementHistoryQuarterly`
  // );

  //   const summaryProfile = await fetch(`${baseURL}summaryProfile`);
  //   const summaryProfileJSON = await summaryProfile.json();
  //   const data = summaryProfileJSON.quoteSummary.result[0].summaryProfile;
    return summaryProfile;
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
    return new Response(err, { status: 400 });
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
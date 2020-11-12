/**
 * @author João Tiago <jtiagodev@gmail.com>
 * Allows you to retrieve detailed information on any financial symbol available at Yahoo Finance, leveraging KV for caching data
 * 1. The data aggregation retrieved consists on several service calls
 * 2. Response is cached for subsequent requests
 * 3. At 24:00 UTC all records stored in KV are refreshed with up-to-date data
 * 4. You can skip cached data with skipCache flag
 */

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

function delay(miliseconds = 1000) {
    setTimeout(() => {}, miliseconds);
}

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
  try {
  const modulesToFetch = ["summaryProfile", "summaryDetail", "esgScores", "price", "assetProfile", "incomeStatementHistoryQuarterly", "balanceSheetHistory", "balanceSheetHistoryQuarterly", "cashflowStatementHistory", "defaultKeyStatistics", "financialData", "calendarEvents", "secFilings", "recommendationTrend", "upgradeDowngradeHistory", "institutionOwnership", "fundOwnership", "majorDirectHolders", "majorHoldersBreakdown", "insiderTransactions", "insiderHolders", "netSharePurchaseActivity", "earnings", "earningsHistory", "earningsTrend", "industryTrend", "indexTrend", "sectorTrend", "cashflowStatementHistoryQuarterly"];
  let stockInfo = {};
  for(let i = 0; i < modulesToFetch.length; i++) {
      const dataPath = `quoteSummary.result.0.${modulesToFetch[i]}`;
      const uri = `${baseURL}${modulesToFetch[i]}`;
      if (i % 5 === 0) delay(1000); // rate limit 5 calls/sec
      const data = await fetchData(uri, dataPath);
      stockInfo[modulesToFetch[i]] = data;
  }
    return stockInfo;
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
    const skipCache = body.skipCache;

    if (!symbol) {
      return new Response(null, {
        status: 400,
        statusText: `Provide symbol on request body`,
      });
    }
    await initMarketWatchKeys();
    
    let res;
    if (!skipCache) {
      const value = await getCache(symbol);
      if (value === null) {
        const data = await getYahooStockInfo(symbol);
        await setCache(symbol, JSON.stringify(data));
        await updateMarketWatchKeys(symbol);
        res = JSON.stringify(data);
      } else {
        res = JSON.stringify(value);
      }
    } else {
      const data = await getYahooStockInfo(symbol);
      await setCache(symbol, JSON.stringify(data));
      await updateMarketWatchKeys(symbol);
      res = JSON.stringify(data);
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

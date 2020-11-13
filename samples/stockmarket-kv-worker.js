/**
 * @author João Tiago <jtiagodev@gmail.com>
 * https://marketswatch.jtiagodev.workers.dev/stockinfo
 * Allows you to retrieve detailed information on any financial symbol available at Yahoo Finance, leveraging KV for caching data
 * 1. The data aggregation retrieved consists on several service calls
 * 2. Response is cached for subsequent requests
 * 3. At 24:00 UTC all records stored in KV are refreshed with up-to-date data
 * 4. You can skip cached data with skipCache flag
 * 
 * https://marketswatch.jtiagodev.workers.dev/stocksupres
 * Allows you to retrieve resistances and supports information on any financial symbol available at Yahoo Finance
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
 * Routes Configuration
 */
const routes = {
  "/stockinfo": (request) => handleInfoRequests(request),
  "/stocksupres": (request) => handleSupResRequests(request),
};

/**
 * Appends key to value
 */
async function updateMarketWatchKeys(symbol) {
  const keys = await MARKETWATCH_SYMBOLS.get("KEYS");
  const updatedKeys = keys + symbol + ",";
  await MARKETWATCH_SYMBOLS.put("KEYS", updatedKeys);
}

/**
 * If KEYS isn't set yet, initialize it
 */
async function initMarketWatchKeys() {
  const keys = await MARKETWATCH_SYMBOLS.get("KEYS");
  if (keys === null) {
    await MARKETWATCH_SYMBOLS.put("KEYS", "");
  }
}

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
}

async function setCache(key, value) {
  await MARKETWATCH_SYMBOLS.put(key, value);
}

async function getCache(key) {
  const value = MARKETWATCH_SYMBOLS.get(key);
  return value;
}

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

async function getYahooStockLastDay(symbol) {
  const uri = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?symbol=${symbol}&interval=1d`;
  const dataPaths = {
    timestamp: "chart.result.0.timestamp.0",
    low: "chart.result.0.indicators.quote.0.low.0",
    high: "chart.result.0.indicators.quote.0.high.0",
    open: "chart.result.0.indicators.quote.0.open.0",
    close: "chart.result.0.indicators.quote.0.close.0",
    volume: "chart.result.0.indicators.quote.0.volume.0",
  };
  try {
    const data = await fetchData(uri);
    let result = {};
    Object.entries(dataPaths).forEach((entry) => {
      const [key, value] = entry;
      const pathData = value.split(".").reduce((acc, curr, i) => {
        if (acc[curr]) return acc[curr];
        return acc;
      }, data);
      result[key] = pathData;
    });
    return result;
  } catch (err) {
    throw new Error(400);
  }
}

async function getYahooStockInfo(symbol) {
  const baseURL = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=`;
  try {
    const modulesToFetch = [
      "summaryProfile",
      "summaryDetail",
      "esgScores",
      "price",
      "assetProfile",
      "incomeStatementHistoryQuarterly",
      "balanceSheetHistory",
      "balanceSheetHistoryQuarterly",
      "cashflowStatementHistory",
      "defaultKeyStatistics",
      "financialData",
      "calendarEvents",
      "secFilings",
      "recommendationTrend",
      "upgradeDowngradeHistory",
      "institutionOwnership",
      "fundOwnership",
      "majorDirectHolders",
      "majorHoldersBreakdown",
      "insiderTransactions",
      "insiderHolders",
      "netSharePurchaseActivity",
      "earnings",
      "earningsHistory",
      "earningsTrend",
      "industryTrend",
      "indexTrend",
      "sectorTrend",
      "cashflowStatementHistoryQuarterly",
    ];
    let stockInfo = {};
    for (let i = 0; i < modulesToFetch.length; i++) {
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
}

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
async function handleInfoPostRequest(request) {
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

function computeSupRes(data) {
  const { open, low, high, close } = data;
  const p = (open + high + low + close) / 4;
  return {
    p,
    thirdRes: p * (high - low),
    secondRes: p + (high - low),
    firstRes: p * 2 - low,
    firstSup: p * 2 - high,
    secondSup: p - (high - low),
    thirdSup: p - 2 * (high - low),
  };
}

/**
 * Fallback handler for other request methods
 * @param {} request
 */
async function handleInfoDefaultRequest(request) {
  return new Response(`Request data from symbol (@Body) using POST`);
}

async function supResController(symbol) {
  try {
    if (!symbol) {
      return new Response(null, {
        status: 400,
        statusText: `Symbol not provided`,
      });
    }
  
    let res = {};
    const data = await getYahooStockLastDay(symbol);
    const computedSupRes = computeSupRes(data);
    res = { ...data, ...computedSupRes };
    return new Response(JSON.stringify(res), { status: 200 });
  } catch (err) {
    throw new Error(400);
  } 
}

async function handleSupResPostRequests(request) {
  try {
    let body = await request.json();
    const symbol = body.symbol;

    return await supResController(symbol);
  } catch (err) {
    return new Response(err, { status: 400 });
  }
}

async function handleSupResGetRequests(request) {
  try {
    let params = new URL(request.url).searchParams;
    let symbol = params.get("symbol");

    return await supResController(symbol);
  } catch (err) {
    return new Response(err, { status: 400 });
  }
}

async function handleSupResRequests(request) {
  switch (request.method) {
    case "POST":
      return await handleSupResPostRequests(request);
    case "GET":
      return await handleSupResGetRequests(request);
    default:
      return new Response(`Request Sup Res from symbol (@Body) using POST`);
  }
}

async function handleInfoRequests(request) {
  switch (request.method) {
    case "POST":
      return await handleInfoPostRequest(request);
    default:
      return await handleInfoDefaultRequest(request);
  }
}

/**
 * Handles Requests
 * @param {Request} request
 */
async function handleRequest(request) {
  const url = new URL(request.url);
  if (url.pathname in routes) {
    return await routes[url.pathname](request);
  }
  return new Response(`Services available POST|GET /stockinfo & POST|GET /stocksupres`);
}
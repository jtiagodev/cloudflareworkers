addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request))
  })
  
  addEventListener('scheduled', event => {
    event.waitUntil(refreshCache(event))
  })
  
  async function refreshCache(event) {
    const keys = await MARKETWATCH_SYMBOLS.get("KEYS");
    const keysToArray = keys.split(",");
    for(let i = 0; i < keysToArray.length - 1; i++) { // ignore last entry
        const baseURL = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=`;
        const summaryProfile = await fetch(`${baseURL}summaryProfile`);
        const summaryProfileJSON = await summaryProfile.json();
              if (summaryProfileJSON.quoteSummary && summaryProfileJSON.quoteSummary.result && summaryProfileJSON.quoteSummary.result[0] && summaryProfileJSON.quoteSummary.result[0].summaryProfile) {
                                  await MARKETWATCH_SYMBOLS.put(symbol, JSON.stringify(data)); // refreshes our data using our scheduler (weekdays 24:00)
              }
      }
  }
  
  /**
   * 
   * @param {Request} request
   */
  async function handleRequest(request) {
    // Process POST
    if(request.method == 'POST'){
        try {
          let body = await request.json();
          const symbol = body.symbol;
  
          if (!symbol) {
             return new Response(null, { status: 400, statusText: `Provide symbol on request body` });
          }
          // If KEYS isn't set yet, initialize it
          const keys = await MARKETWATCH_SYMBOLS.get("KEYS");
          if (keys === null) {
            await MARKETWATCH_SYMBOLS.put("KEYS", "");
          }
          // Reads cached value from KV
          const value = await MARKETWATCH_SYMBOLS.get(symbol);
          if (value === null) {
              // get infos from service - rate limit 5 calls/sec
              const baseURL = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=`;
              const summaryProfile = await fetch(`${baseURL}summaryProfile`);
              const summaryProfileJSON = await summaryProfile.json();
              if (summaryProfileJSON.quoteSummary.error) {
                  const { code, description } = summaryProfileJSON.quoteSummary.error;
                  return new Response(null, { status: 400, statusText: description });
              } else {
                  // Stores (JSON) value on KV
                  const data = summaryProfileJSON.quoteSummary.result[0].summaryProfile;
                  await MARKETWATCH_SYMBOLS.put(symbol, JSON.stringify(data));
                  const keys = await MARKETWATCH_SYMBOLS.get("KEYS");
                  const updatedKeys = keys + symbol + ",";
                  await MARKETWATCH_SYMBOLS.put("KEYS", updatedKeys);
                  return new Response(JSON.stringify(data), {status: 200})
              }
          } else {
            return new Response(JSON.stringify(value), { status: 200 })
          }
        } catch (err) {
          return new Response(null, {status: 500, statusText: err.message });
        }
    }
    return new Response(`Request data from symbol (@Body) using POST`)
  }
  
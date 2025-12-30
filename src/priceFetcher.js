// Price Fetcher - Multiple Exchange APIs
// CoinGecko, Kraken, Coinbase, Bybit, CryptoCompare
// No API keys required for basic usage

// Symbol mappings for each exchange
const SYMBOLS = {
  CoinGecko: { BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana' },
  Kraken: { BTC: 'XBTUSD', ETH: 'ETHUSD', SOL: 'SOLUSD' },
  Coinbase: { BTC: 'BTC-USD', ETH: 'ETH-USD', SOL: 'SOL-USD' },
  Bybit: { BTC: 'BTCUSDT', ETH: 'ETHUSDT', SOL: 'SOLUSDT' },
};

/**
 * 1. CoinGecko API
 */
async function fetchFromCoinGecko(symbol) {
  const id = SYMBOLS.CoinGecko[symbol];
  if (!id) return null;

  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd&include_24hr_vol=true&include_24hr_change=true`
    );
    if (!response.ok) return null;
    
    const data = await response.json();
    const coin = data[id];
    if (!coin) return null;
    
    console.log(`   ✓ CoinGecko: ${symbol} = $${coin.usd}`);
    return {
      symbol,
      price: coin.usd,
      open: coin.usd / (1 + (coin.usd_24h_change || 0) / 100),
      high: coin.usd * 1.01,
      low: coin.usd * 0.99,
      volume: coin.usd_24h_vol || 0,
      change: coin.usd_24h_change || 0,
      source: 'CoinGecko',
    };
  } catch (e) {
    console.log(`   ✗ CoinGecko failed: ${e.message}`);
    return null;
  }
}

/**
 * 2. Kraken API
 */
async function fetchFromKraken(symbol) {
  const pair = SYMBOLS.Kraken[symbol];
  if (!pair) return null;

  try {
    const response = await fetch(`https://api.kraken.com/0/public/Ticker?pair=${pair}`);
    if (!response.ok) return null;
    
    const data = await response.json();
    if (data.error?.length > 0) return null;
    
    const ticker = Object.values(data.result)[0];
    if (!ticker) return null;
    
    const price = parseFloat(ticker.c[0]);
    const open = parseFloat(ticker.o);
    
    console.log(`   ✓ Kraken: ${symbol} = $${price}`);
    return {
      symbol,
      price,
      open,
      high: parseFloat(ticker.h[1]),
      low: parseFloat(ticker.l[1]),
      volume: parseFloat(ticker.v[1]),
      change: ((price - open) / open) * 100,
      source: 'Kraken',
    };
  } catch (e) {
    console.log(`   ✗ Kraken failed: ${e.message}`);
    return null;
  }
}

/**
 * 3. Coinbase API
 */
async function fetchFromCoinbase(symbol) {
  const pair = SYMBOLS.Coinbase[symbol];
  if (!pair) return null;

  try {
    // Get current price
    const priceRes = await fetch(`https://api.coinbase.com/v2/prices/${pair}/spot`);
    if (!priceRes.ok) return null;
    
    const priceData = await priceRes.json();
    const price = parseFloat(priceData.data.amount);
    
    // Get 24h stats
    const statsRes = await fetch(`https://api.exchange.coinbase.com/products/${pair}/stats`);
    let open = price, high = price, low = price, volume = 0;
    
    if (statsRes.ok) {
      const stats = await statsRes.json();
      open = parseFloat(stats.open) || price;
      high = parseFloat(stats.high) || price;
      low = parseFloat(stats.low) || price;
      volume = parseFloat(stats.volume) || 0;
    }
    
    console.log(`   ✓ Coinbase: ${symbol} = $${price}`);
    return {
      symbol,
      price,
      open,
      high,
      low,
      volume,
      change: ((price - open) / open) * 100,
      source: 'Coinbase',
    };
  } catch (e) {
    console.log(`   ✗ Coinbase failed: ${e.message}`);
    return null;
  }
}

/**
 * 4. Bybit API
 */
async function fetchFromBybit(symbol) {
  const pair = SYMBOLS.Bybit[symbol];
  if (!pair) return null;

  try {
    const response = await fetch(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${pair}`);
    if (!response.ok) return null;
    
    const data = await response.json();
    if (data.retCode !== 0) return null;
    
    const ticker = data.result?.list?.[0];
    if (!ticker) return null;
    
    const price = parseFloat(ticker.lastPrice);
    const open = parseFloat(ticker.prevPrice24h);
    
    console.log(`   ✓ Bybit: ${symbol} = $${price}`);
    return {
      symbol,
      price,
      open,
      high: parseFloat(ticker.highPrice24h),
      low: parseFloat(ticker.lowPrice24h),
      volume: parseFloat(ticker.volume24h),
      change: parseFloat(ticker.price24hPcnt) * 100,
      source: 'Bybit',
    };
  } catch (e) {
    console.log(`   ✗ Bybit failed: ${e.message}`);
    return null;
  }
}

/**
 * 5. CryptoCompare API
 */
async function fetchFromCryptoCompare(symbol) {
  try {
    const response = await fetch(
      `https://min-api.cryptocompare.com/data/pricemultifull?fsyms=${symbol}&tsyms=USD`
    );
    if (!response.ok) return null;
    
    const data = await response.json();
    const raw = data.RAW?.[symbol]?.USD;
    if (!raw) return null;
    
    console.log(`   ✓ CryptoCompare: ${symbol} = $${raw.PRICE}`);
    return {
      symbol,
      price: raw.PRICE,
      open: raw.OPEN24HOUR,
      high: raw.HIGH24HOUR,
      low: raw.LOW24HOUR,
      volume: raw.VOLUME24HOUR,
      change: raw.CHANGEPCT24HOUR,
      source: 'CryptoCompare',
    };
  } catch (e) {
    console.log(`   ✗ CryptoCompare failed: ${e.message}`);
    return null;
  }
}

/**
 * Fetch price with fallback through all exchanges
 */
export async function fetchPrice(symbol) {
  // Try each exchange in order
  const fetchers = [
    fetchFromCoinGecko,
    fetchFromKraken,
    fetchFromCoinbase,
    fetchFromBybit,
    fetchFromCryptoCompare,
  ];

  for (const fetcher of fetchers) {
    const data = await fetcher(symbol);
    if (data) return data;
    await new Promise(r => setTimeout(r, 100)); // Small delay between attempts
  }

  // All failed - throw error
  throw new Error(`All APIs failed for ${symbol} - no price data available`);
}

/**
 * Fetch prices for all symbols
 */
export async function fetchAllPrices() {
  const symbols = ['BTC', 'ETH', 'SOL'];
  const prices = {};

  for (const symbol of symbols) {
    prices[symbol] = await fetchPrice(symbol);
    await new Promise(r => setTimeout(r, 200));
  }

  return prices;
}

/**
 * Fetch OHLC/Klines from Kraken
 */
async function fetchOHLCFromKraken(symbol, interval = 15) {
  const pair = SYMBOLS.Kraken[symbol];
  if (!pair) return null;

  try {
    const response = await fetch(
      `https://api.kraken.com/0/public/OHLC?pair=${pair}&interval=${interval}`
    );
    if (!response.ok) return null;
    
    const data = await response.json();
    if (data.error?.length > 0) return null;
    
    const ohlc = Object.values(data.result).find(Array.isArray);
    if (!ohlc) return null;
    
    return ohlc.map((k) => ({
      openTime: k[0] * 1000,
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[6]),
      closeTime: k[0] * 1000 + interval * 60000,
      trades: parseInt(k[7]) || 0,
    }));
  } catch (e) {
    return null;
  }
}

/**
 * Fetch OHLC from CryptoCompare
 */
async function fetchOHLCFromCryptoCompare(symbol, interval = 15) {
  try {
    // CryptoCompare uses: histominute, histohour, histoday
    let endpoint = 'histominute';
    let limit = 100;
    
    if (interval >= 60) {
      endpoint = 'histohour';
      limit = Math.min(100, Math.ceil(100 * 15 / 60));
    }
    if (interval >= 1440) {
      endpoint = 'histoday';
      limit = 30;
    }

    const response = await fetch(
      `https://min-api.cryptocompare.com/data/v2/${endpoint}?fsym=${symbol}&tsym=USD&limit=${limit}`
    );
    if (!response.ok) return null;
    
    const data = await response.json();
    if (data.Response !== 'Success') return null;
    
    return data.Data.Data.map((k) => ({
      openTime: k.time * 1000,
      open: k.open,
      high: k.high,
      low: k.low,
      close: k.close,
      volume: k.volumefrom,
      closeTime: (k.time + interval * 60) * 1000,
      trades: 0,
    }));
  } catch (e) {
    return null;
  }
}

/**
 * Fetch klines with fallback
 */
export async function fetchKlines(symbol, interval = '15m', limit = 100) {
  const intervalMap = { '15m': 15, '1h': 60, '4h': 240, 'daily': 1440 };
  const mins = intervalMap[interval] || 15;

  // Try Kraken first
  let data = await fetchOHLCFromKraken(symbol, mins);
  
  // Try CryptoCompare as fallback
  if (!data || data.length < 10) {
    data = await fetchOHLCFromCryptoCompare(symbol, mins);
  }

  // Return data or throw error
  if (data && data.length >= 10) {
    return data.slice(-limit);
  }

  // No data available - throw error
  throw new Error(`No kline data available for ${symbol}`);
}

/**
 * Estimate order flow from price action
 */
export async function fetchOrderBook(symbol, limit = 20) {
  const priceData = await fetchPrice(symbol);
  const change = priceData.change || 0;

  // Map -10% to +10% change to 0.3 to 0.7 imbalance
  const imbalance = Math.max(0.3, Math.min(0.7, 0.5 + change / 20));

  return {
    bids: [],
    asks: [],
    bidVolume: 100 * imbalance,
    askVolume: 100 * (1 - imbalance),
    imbalance,
    source: 'estimated',
  };
}

export default {
  fetchPrice,
  fetchAllPrices,
  fetchKlines,
  fetchOrderBook,
};

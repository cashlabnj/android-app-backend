// Price Fetcher - Gets live prices from Binance
// Uses public API (no key required)

const BINANCE_API = 'https://api.binance.com/api/v3';

// Map our symbols to Binance symbols
const SYMBOL_MAP = {
  'BTC': 'BTCUSDT',
  'ETH': 'ETHUSDT',
  'SOL': 'SOLUSDT',
};

/**
 * Fetch current price for a symbol
 */
export async function fetchPrice(symbol) {
  const binanceSymbol = SYMBOL_MAP[symbol];
  if (!binanceSymbol) {
    throw new Error(`Unknown symbol: ${symbol}`);
  }

  try {
    const response = await fetch(`${BINANCE_API}/ticker/24hr?symbol=${binanceSymbol}`);
    const data = await response.json();

    return {
      symbol,
      price: parseFloat(data.lastPrice),
      open: parseFloat(data.openPrice),
      high: parseFloat(data.highPrice),
      low: parseFloat(data.lowPrice),
      volume: parseFloat(data.volume),
      change: parseFloat(data.priceChangePercent),
    };
  } catch (error) {
    console.error(`Error fetching price for ${symbol}:`, error.message);
    throw error;
  }
}

/**
 * Fetch prices for all supported symbols
 */
export async function fetchAllPrices() {
  const symbols = Object.keys(SYMBOL_MAP);
  const prices = {};

  await Promise.all(
    symbols.map(async (symbol) => {
      try {
        prices[symbol] = await fetchPrice(symbol);
      } catch (error) {
        console.error(`Failed to fetch ${symbol}:`, error.message);
      }
    })
  );

  return prices;
}

/**
 * Fetch klines (candlestick data) for technical analysis
 */
export async function fetchKlines(symbol, interval = '15m', limit = 100) {
  const binanceSymbol = SYMBOL_MAP[symbol];
  if (!binanceSymbol) {
    throw new Error(`Unknown symbol: ${symbol}`);
  }

  try {
    const response = await fetch(
      `${BINANCE_API}/klines?symbol=${binanceSymbol}&interval=${interval}&limit=${limit}`
    );
    const data = await response.json();

    // Parse klines into objects
    return data.map((k) => ({
      openTime: k[0],
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
      closeTime: k[6],
      quoteVolume: parseFloat(k[7]),
      trades: k[8],
      buyVolume: parseFloat(k[9]),
      buyQuoteVolume: parseFloat(k[10]),
    }));
  } catch (error) {
    console.error(`Error fetching klines for ${symbol}:`, error.message);
    throw error;
  }
}

/**
 * Fetch order book depth
 */
export async function fetchOrderBook(symbol, limit = 20) {
  const binanceSymbol = SYMBOL_MAP[symbol];
  if (!binanceSymbol) {
    throw new Error(`Unknown symbol: ${symbol}`);
  }

  try {
    const response = await fetch(
      `${BINANCE_API}/depth?symbol=${binanceSymbol}&limit=${limit}`
    );
    const data = await response.json();

    // Calculate order flow imbalance
    const bidVolume = data.bids.reduce((sum, [, qty]) => sum + parseFloat(qty), 0);
    const askVolume = data.asks.reduce((sum, [, qty]) => sum + parseFloat(qty), 0);
    const imbalance = bidVolume / (bidVolume + askVolume);

    return {
      bids: data.bids.map(([price, qty]) => ({ price: parseFloat(price), qty: parseFloat(qty) })),
      asks: data.asks.map(([price, qty]) => ({ price: parseFloat(price), qty: parseFloat(qty) })),
      bidVolume,
      askVolume,
      imbalance, // > 0.5 = more buyers, < 0.5 = more sellers
    };
  } catch (error) {
    console.error(`Error fetching order book for ${symbol}:`, error.message);
    throw error;
  }
}

export default {
  fetchPrice,
  fetchAllPrices,
  fetchKlines,
  fetchOrderBook,
};

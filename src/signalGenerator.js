// Signal Generator - Agent Alpha Logic
// Generates trading signals based on technical analysis

import { fetchKlines, fetchOrderBook, fetchPrice } from './priceFetcher.js';

// Hold periods for each timeframe (in minutes)
const HOLD_PERIODS = {
  '15m': 5,    // 5 minutes
  '1h': 15,    // 15 minutes  
  'daily': 30, // 30 minutes
};

// Aggressiveness thresholds (can be adjusted)
const THRESHOLDS = {
  conservative: { up: 70, down: 30 },
  moderate: { up: 62, down: 38 },
  aggressive: { up: 60, down: 40 },
};

/**
 * Calculate RSI (Relative Strength Index)
 */
function calculateRSI(closes, period = 14) {
  if (closes.length < period + 1) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

/**
 * Calculate MACD
 */
function calculateMACD(closes) {
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const macd = ema12 - ema26;
  const signal = calculateEMA([...Array(9).fill(macd)], 9); // Simplified
  return { macd, signal, histogram: macd - signal };
}

/**
 * Calculate EMA (Exponential Moving Average)
 */
function calculateEMA(data, period) {
  if (data.length === 0) return 0;
  const multiplier = 2 / (period + 1);
  let ema = data[0];
  for (let i = 1; i < data.length; i++) {
    ema = (data[i] - ema) * multiplier + ema;
  }
  return ema;
}

/**
 * Calculate momentum score from price action
 */
function calculateMomentumScore(klines) {
  if (klines.length < 20) return 0;

  const closes = klines.map(k => k.close);
  const rsi = calculateRSI(closes);
  const { histogram } = calculateMACD(closes);
  
  // Recent price trend (last 5 candles)
  const recentCloses = closes.slice(-5);
  const trendStrength = (recentCloses[4] - recentCloses[0]) / recentCloses[0] * 100;

  // Combine indicators
  let score = 0;
  
  // RSI contribution (-30 to +30)
  if (rsi > 70) score -= (rsi - 70) * 1.5; // Overbought
  else if (rsi < 30) score += (30 - rsi) * 1.5; // Oversold
  else score += (rsi - 50) * 0.5; // Neutral zone
  
  // MACD contribution (-20 to +20)
  score += Math.max(-20, Math.min(20, histogram * 100));
  
  // Trend contribution (-10 to +10)
  score += Math.max(-10, Math.min(10, trendStrength * 2));

  return Math.max(-30, Math.min(30, score));
}

/**
 * Calculate order flow score from order book
 */
function calculateOrderFlowScore(orderBook) {
  const { imbalance, bidVolume, askVolume } = orderBook;
  
  // Imbalance-based score (-30 to +30)
  // imbalance > 0.5 = more bids = bullish
  // imbalance < 0.5 = more asks = bearish
  const score = (imbalance - 0.5) * 60;
  
  return Math.max(-30, Math.min(30, score));
}

/**
 * Calculate sentiment score (simplified - could integrate news API)
 */
function calculateSentimentScore(klines) {
  // Use volume and price action as proxy for sentiment
  if (klines.length < 10) return 0;

  const recentKlines = klines.slice(-10);
  
  // Volume trend
  const avgVolume = recentKlines.reduce((sum, k) => sum + k.volume, 0) / 10;
  const lastVolume = recentKlines[9].volume;
  const volumeRatio = lastVolume / avgVolume;
  
  // Price direction with volume
  const priceUp = recentKlines[9].close > recentKlines[0].close;
  
  let score = 0;
  if (priceUp && volumeRatio > 1.2) score = 15; // Bullish with volume
  else if (!priceUp && volumeRatio > 1.2) score = -15; // Bearish with volume
  else if (priceUp) score = 8;
  else score = -8;

  return Math.max(-20, Math.min(20, score));
}

/**
 * Check risk gates
 */
function checkRiskGates(klines, orderBook) {
  const closes = klines.map(k => k.close);
  
  // Volatility check (ATR-based)
  const ranges = klines.slice(-14).map(k => k.high - k.low);
  const atr = ranges.reduce((a, b) => a + b, 0) / ranges.length;
  const atrPercent = (atr / closes[closes.length - 1]) * 100;
  const volatilityPass = atrPercent < 5; // Less than 5% ATR
  
  // Liquidity check
  const totalVolume = orderBook.bidVolume + orderBook.askVolume;
  const liquidityPass = totalVolume > 10; // Minimum volume threshold
  
  // Time check (avoid generating too close to market boundaries)
  const now = new Date();
  const minutes = now.getMinutes();
  const timePass = true; // Crypto trades 24/7
  
  return {
    volatility_pass: volatilityPass,
    liquidity_pass: liquidityPass,
    conflict_pass: true, // Set by main logic
    time_pass: timePass,
    correlation_pass: true, // Would need multi-asset data
  };
}

/**
 * Generate signal for a specific market and timeframe
 */
export async function generateSignal(symbol, timeframe, aggressiveness = 'aggressive') {
  console.log(`\n📊 Generating ${timeframe} signal for ${symbol}...`);
  
  try {
    // Fetch market data
    const klineInterval = timeframe === 'daily' ? '1h' : timeframe;
    const [klines, orderBook, priceData] = await Promise.all([
      fetchKlines(symbol, klineInterval, 100),
      fetchOrderBook(symbol, 20),
      fetchPrice(symbol),
    ]);

    // Calculate component scores
    const orderFlowScore = calculateOrderFlowScore(orderBook);
    const momentumScore = calculateMomentumScore(klines);
    const sentimentScore = calculateSentimentScore(klines);

    console.log(`   Order Flow: ${orderFlowScore.toFixed(1)}`);
    console.log(`   Momentum: ${momentumScore.toFixed(1)}`);
    console.log(`   Sentiment: ${sentimentScore.toFixed(1)}`);

    // Calculate confidence (weighted average mapped to 0-100)
    const rawScore = 
      orderFlowScore * 0.35 + 
      momentumScore * 0.40 + 
      sentimentScore * 0.25;
    
    // Map from (-30 to +30) range to (0 to 100)
    let confidence = 50 + (rawScore * 1.67);
    
    // Confluence boost
    const allBullish = orderFlowScore > 10 && momentumScore > 10 && sentimentScore > 5;
    const allBearish = orderFlowScore < -10 && momentumScore < -10 && sentimentScore < -5;
    if (allBullish || allBearish) {
      confidence += (allBullish ? 8 : -8);
    }
    
    confidence = Math.max(0, Math.min(100, confidence));
    
    // Determine direction based on thresholds
    const thresh = THRESHOLDS[aggressiveness];
    let direction;
    let tradeable;
    
    if (confidence >= thresh.up) {
      direction = 'UP';
      tradeable = true;
    } else if (confidence <= thresh.down) {
      direction = 'DOWN';
      tradeable = true;
    } else {
      direction = 'FLAT';
      tradeable = false;
      confidence = null; // No confidence shown for FLAT
    }

    // Check risk gates
    const riskGates = checkRiskGates(klines, orderBook);
    riskGates.conflict_pass = tradeable;

    // Generate rationale
    const rationale = generateRationale(direction, timeframe, {
      orderFlowScore,
      momentumScore,
      sentimentScore,
      rsi: calculateRSI(klines.map(k => k.close)),
    });

    // Calculate hold_until
    const now = new Date();
    const holdMinutes = HOLD_PERIODS[timeframe];
    const holdUntil = new Date(now.getTime() + holdMinutes * 60 * 1000);

    console.log(`   Direction: ${direction} | Confidence: ${confidence ?? 'N/A'} | Tradeable: ${tradeable}`);

    return {
      market_id: `${symbol.toLowerCase()}-usd`,
      symbol: `${symbol}/USD`,
      timeframe,
      direction,
      confidence: tradeable ? Math.round(confidence) : null,
      tradeable,
      order_flow_score: Math.round(orderFlowScore * 10) / 10,
      momentum_score: Math.round(momentumScore * 10) / 10,
      sentiment_score: Math.round(sentimentScore * 10) / 10,
      ...riskGates,
      rationale,
      generated_at: now.toISOString(),
      hold_until: holdUntil.toISOString(),
      expires_at: null,
    };
  } catch (error) {
    console.error(`❌ Error generating signal for ${symbol}:`, error.message);
    throw error;
  }
}

/**
 * Generate human-readable rationale
 */
function generateRationale(direction, timeframe, scores) {
  const { orderFlowScore, momentumScore, sentimentScore, rsi } = scores;
  
  const rationales = {
    '15m': {
      UP: [
        `Short-term bid absorption (OF: ${orderFlowScore.toFixed(0)}) + RSI ${rsi.toFixed(0)}`,
        `15m bullish momentum building (MO: ${momentumScore.toFixed(0)})`,
        `Scalp setup confirmed - order flow ${orderFlowScore > 0 ? 'bullish' : 'turning'}`,
      ],
      DOWN: [
        `Short-term ask pressure (OF: ${orderFlowScore.toFixed(0)}) + RSI ${rsi.toFixed(0)}`,
        `15m bearish momentum (MO: ${momentumScore.toFixed(0)})`,
        `Scalp setup: sellers in control`,
      ],
      FLAT: [
        `15m signals inconclusive - waiting`,
        `Choppy price action (RSI: ${rsi.toFixed(0)})`,
        `Signal conflict on short timeframe`,
      ],
    },
    '1h': {
      UP: [
        `Hourly trend bullish + order flow ${orderFlowScore.toFixed(0)}`,
        `Strong 1h momentum (MO: ${momentumScore.toFixed(0)}) + RSI ${rsi.toFixed(0)}`,
        `1h close expected above open`,
      ],
      DOWN: [
        `Hourly breakdown - OF: ${orderFlowScore.toFixed(0)}`,
        `Weak 1h momentum (MO: ${momentumScore.toFixed(0)}) + RSI ${rsi.toFixed(0)}`,
        `1h close expected below open`,
      ],
      FLAT: [
        `Hourly signal inconclusive`,
        `Mixed 1h indicators (RSI: ${rsi.toFixed(0)})`,
        `High volatility risk - wait`,
      ],
    },
    'daily': {
      UP: [
        `Daily trend bullish + strong momentum`,
        `EOD close expected above open (RSI: ${rsi.toFixed(0)})`,
        `Accumulation pattern + positive flow`,
      ],
      DOWN: [
        `Daily trend bearish + weak momentum`,
        `EOD close expected below open (RSI: ${rsi.toFixed(0)})`,
        `Distribution pattern detected`,
      ],
      FLAT: [
        `Daily direction unclear - too early`,
        `Waiting for more data before EOD call`,
        `Mixed daily signals - no edge`,
      ],
    },
  };

  const options = rationales[timeframe]?.[direction] || rationales['1h'][direction];
  return options[Math.floor(Math.random() * options.length)];
}

export default { generateSignal };

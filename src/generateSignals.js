// Generate Signals and Push to Supabase
// Usage: node src/generateSignals.js [timeframe]
// Timeframes: 15m, 1h, daily, all

import { supabase } from './supabase.js';
import { generateSignal } from './signalGenerator.js';
import { fetchPrice } from './priceFetcher.js';

const MARKETS = ['BTC', 'ETH', 'SOL'];
const TIMEFRAMES = ['15m', '1h', 'daily'];

/**
 * Update market prices in Supabase
 */
async function updateMarketPrices() {
  console.log('\n💰 Updating market prices...');
  
  for (const symbol of MARKETS) {
    try {
      const priceData = await fetchPrice(symbol);
      
      const { error } = await supabase
        .from('markets')
        .update({
          current_price: priceData.price,
          open_price: priceData.open,
          high_24h: priceData.high,
          low_24h: priceData.low,
          volume_24h: priceData.volume,
          price_updated_at: new Date().toISOString(),
        })
        .eq('id', `${symbol.toLowerCase()}-usd`);

      if (error) {
        console.error(`   ❌ Failed to update ${symbol}:`, error.message);
      } else {
        console.log(`   ✅ ${symbol}: $${priceData.price.toLocaleString()}`);
      }
    } catch (error) {
      console.error(`   ❌ Error fetching ${symbol}:`, error.message);
    }
  }
}

/**
 * Check if we should generate a new signal
 * (only if the previous signal's hold_until has passed)
 */
async function shouldGenerateSignal(marketId, timeframe) {
  const { data: existing } = await supabase
    .from('signals')
    .select('hold_until')
    .eq('market_id', marketId)
    .eq('timeframe', timeframe)
    .order('generated_at', { ascending: false })
    .limit(1)
    .single();

  if (!existing) return true; // No existing signal
  
  const holdUntil = new Date(existing.hold_until);
  return new Date() > holdUntil; // Generate if hold period has passed
}

/**
 * Generate and push signal for a specific market/timeframe
 */
async function generateAndPushSignal(symbol, timeframe) {
  const marketId = `${symbol.toLowerCase()}-usd`;
  
  // Check if we should generate a new signal
  const shouldGenerate = await shouldGenerateSignal(marketId, timeframe);
  if (!shouldGenerate) {
    console.log(`   ⏭️  ${symbol} ${timeframe}: Signal still valid, skipping`);
    return null;
  }

  try {
    // Generate the signal
    const signal = await generateSignal(symbol, timeframe, 'aggressive');
    
    // Insert into Supabase
    const { data, error } = await supabase
      .from('signals')
      .insert(signal)
      .select()
      .single();

    if (error) {
      console.error(`   ❌ Failed to insert ${symbol} ${timeframe}:`, error.message);
      return null;
    }

    console.log(`   ✅ ${symbol} ${timeframe}: ${signal.direction} (${signal.confidence ?? 'FLAT'})`);
    return data;
  } catch (error) {
    console.error(`   ❌ Error generating ${symbol} ${timeframe}:`, error.message);
    return null;
  }
}

/**
 * Generate signals for all markets for a specific timeframe
 */
async function generateSignalsForTimeframe(timeframe) {
  console.log(`\n🎯 Generating ${timeframe} signals...`);
  
  const results = [];
  for (const symbol of MARKETS) {
    const result = await generateAndPushSignal(symbol, timeframe);
    if (result) results.push(result);
  }
  
  return results;
}

/**
 * Generate signals for all timeframes
 */
async function generateAllSignals() {
  console.log('\n🚀 Generating all signals...');
  
  // Update prices first
  await updateMarketPrices();
  
  // Generate for each timeframe
  for (const timeframe of TIMEFRAMES) {
    await generateSignalsForTimeframe(timeframe);
  }
  
  console.log('\n✅ All signals generated!');
}

/**
 * Main entry point
 */
async function main() {
  const arg = process.argv[2] || 'all';
  
  console.log('═══════════════════════════════════════════');
  console.log('  POLYMARKET PREDICTOR - Signal Generator');
  console.log('═══════════════════════════════════════════');
  console.log(`  Time: ${new Date().toISOString()}`);
  console.log(`  Mode: ${arg}`);
  console.log('═══════════════════════════════════════════');

  // Update prices first
  await updateMarketPrices();

  if (arg === 'all') {
    await generateAllSignals();
  } else if (TIMEFRAMES.includes(arg)) {
    await generateSignalsForTimeframe(arg);
  } else {
    console.error(`❌ Unknown timeframe: ${arg}`);
    console.log('   Valid options: 15m, 1h, daily, all');
    process.exit(1);
  }

  console.log('\n🏁 Done!\n');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

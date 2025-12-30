// Main Server - Runs signal generation on schedule
// This keeps running and generates signals at the right intervals

import cron from 'node-cron';
import { supabase } from './supabase.js';
import { generateSignal } from './signalGenerator.js';
import { fetchPrice } from './priceFetcher.js';

const MARKETS = ['BTC', 'ETH', 'SOL'];

console.log('═══════════════════════════════════════════════════');
console.log('  POLYMARKET PREDICTOR - Signal Backend Service');
console.log('═══════════════════════════════════════════════════');
console.log(`  Started: ${new Date().toISOString()}`);
console.log('═══════════════════════════════════════════════════');

/**
 * Update market prices
 */
async function updatePrices() {
  console.log(`\n[${new Date().toISOString()}] 💰 Updating prices...`);
  
  for (const symbol of MARKETS) {
    try {
      const priceData = await fetchPrice(symbol);
      
      await supabase
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

      console.log(`   ${symbol}: $${priceData.price.toLocaleString()}`);
    } catch (error) {
      console.error(`   ❌ ${symbol}: ${error.message}`);
    }
  }
}

/**
 * Check if signal needs regeneration
 */
async function needsRegeneration(marketId, timeframe) {
  const { data } = await supabase
    .from('signals')
    .select('hold_until')
    .eq('market_id', marketId)
    .eq('timeframe', timeframe)
    .order('generated_at', { ascending: false })
    .limit(1)
    .single();

  if (!data) return true;
  return new Date() > new Date(data.hold_until);
}

/**
 * Generate signals for a timeframe
 */
async function generateSignals(timeframe) {
  console.log(`\n[${new Date().toISOString()}] 🎯 Checking ${timeframe} signals...`);
  
  for (const symbol of MARKETS) {
    const marketId = `${symbol.toLowerCase()}-usd`;
    
    if (!(await needsRegeneration(marketId, timeframe))) {
      console.log(`   ⏭️  ${symbol}: Still valid`);
      continue;
    }

    try {
      const signal = await generateSignal(symbol, timeframe, 'aggressive');
      
      const { error } = await supabase
        .from('signals')
        .insert(signal);

      if (error) {
        console.error(`   ❌ ${symbol}: ${error.message}`);
      } else {
        console.log(`   ✅ ${symbol}: ${signal.direction} (${signal.confidence ?? 'FLAT'})`);
      }
    } catch (error) {
      console.error(`   ❌ ${symbol}: ${error.message}`);
    }
  }
}

// ═══════════════════════════════════════════════════
// CRON SCHEDULES
// ═══════════════════════════════════════════════════

// Update prices every 30 seconds
cron.schedule('*/30 * * * * *', () => {
  updatePrices();
});

// Check 15m signals every minute (generates if hold_until passed)
cron.schedule('* * * * *', () => {
  generateSignals('15m');
});

// Check 1h signals every 5 minutes
cron.schedule('*/5 * * * *', () => {
  generateSignals('1h');
});

// Check daily signals every 15 minutes
cron.schedule('*/15 * * * *', () => {
  generateSignals('daily');
});

// ═══════════════════════════════════════════════════
// STARTUP
// ═══════════════════════════════════════════════════

console.log('\n📅 Scheduled jobs:');
console.log('   • Prices: Every 30 seconds');
console.log('   • 15m signals: Every minute (if needed)');
console.log('   • 1h signals: Every 5 minutes (if needed)');
console.log('   • Daily signals: Every 15 minutes (if needed)');
console.log('\n🟢 Service running. Press Ctrl+C to stop.\n');

// Initial run
(async () => {
  await updatePrices();
  await generateSignals('15m');
  await generateSignals('1h');
  await generateSignals('daily');
})();

// Keep process alive
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down...');
  process.exit(0);
});

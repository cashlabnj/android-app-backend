# Polymarket Predictor - Backend Service

This service generates trading signals and pushes them to Supabase in real-time.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy the example env file and add your Supabase service key:

```bash
cp .env.example .env
```

Edit `.env` and add your **service_role key** (NOT the anon key):
- Go to Supabase Dashboard → Settings → API
- Copy the `service_role` key (keep this secret!)

```env
SUPABASE_URL=https://sedwlppmhjefffeymdk.supabase.co
SUPABASE_SERVICE_KEY=eyJ...your-service-role-key...
```

### 3. Run the service

**Option A: Continuous service (recommended)**

```bash
npm start
```

This runs continuously and:
- Updates prices every 30 seconds
- Generates 15m signals every minute (if needed)
- Generates 1h signals every 5 minutes (if needed)
- Generates daily signals every 15 minutes (if needed)

**Option B: One-time generation**

```bash
npm run generate:all    # Generate all signals once
npm run generate:15m    # Generate only 15m signals
npm run generate:1h     # Generate only 1h signals
npm run generate:daily  # Generate only daily signals
```

## How It Works

### Signal Generation

1. **Fetch market data** from Binance (prices, order book, candles)
2. **Calculate scores:**
   - Order Flow Score (from order book imbalance)
   - Momentum Score (RSI, MACD, trend)
   - Sentiment Score (volume + price action)
3. **Determine direction:**
   - Confidence ≥ 60% → UP
   - Confidence ≤ 40% → DOWN
   - Otherwise → FLAT (no trade)
4. **Push to Supabase** → App receives real-time update

### Hold Periods

Signals don't regenerate until their hold period expires:

| Timeframe | Hold Period | Check Frequency |
|-----------|-------------|-----------------|
| 15m       | 5 minutes   | Every minute    |
| 1h        | 15 minutes  | Every 5 minutes |
| Daily     | 30 minutes  | Every 15 minutes|

This ensures signals are stable and don't flip-flop.

## Deployment Options

### Option 1: Railway (Recommended - Free Tier)

1. Push code to GitHub
2. Connect Railway to your repo
3. Add environment variables
4. Deploy!

### Option 2: DigitalOcean ($6/month)

```bash
# On your droplet
git clone your-repo
cd polymarket-backend
npm install
cp .env.example .env
# Edit .env with your keys

# Run with PM2 (keeps it running)
npm install -g pm2
pm2 start src/index.js --name polymarket-signals
pm2 save
pm2 startup
```

### Option 3: Run Locally

Just run `npm start` on your computer. Signals will generate as long as it's running.

## Files

```
src/
├── index.js           # Main server with cron scheduling
├── generateSignals.js # One-time signal generation script
├── signalGenerator.js # Agent Alpha logic
├── priceFetcher.js    # Binance API integration
└── supabase.js        # Supabase admin client
```

## Testing

Generate a single signal batch:

```bash
npm run generate:all
```

Check Supabase:
- Go to Table Editor → signals
- You should see new rows with generated signals

Check your app:
- Signals should appear in real-time!

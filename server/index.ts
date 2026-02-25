import express from 'express';
import cors from 'cors';
import YahooFinance from 'yahoo-finance2';
import { db, portfoliosCollection } from './db';
import { FieldValue } from 'firebase-admin/firestore';

const yahooFinance = new YahooFinance({ 
  suppressNotices: ['yahooSurvey', 'ripHistorical'] 
});

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// ─── Yahoo Finance Routes (unchanged) ──────────────────────────────────────

app.get('/api/historical/:ticker', async (req: express.Request, res: express.Response) => {
  try {
    const { ticker } = req.params;
    const { months = '12', ytd } = req.query;
    
    const endDate = new Date();
    let startDate: Date;
    
    if (ytd === 'true') {
      startDate = new Date(endDate.getFullYear(), 0, 1);
    } else {
      startDate = new Date();
      startDate.setMonth(startDate.getMonth() - parseInt(months as string));
    }

    const result = await yahooFinance.chart(ticker.toUpperCase(), {
      period1: startDate.toISOString().split('T')[0],
      period2: endDate.toISOString().split('T')[0],
      interval: '1d'
    }) as any;

    const quotes = result.quotes || [];
    const data = quotes.map((item: any) => ({
      date: new Date(item.date).toISOString().split('T')[0],
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      adjClose: item.adjclose || item.close,
      volume: item.volume
    }));

    res.json({ ticker: ticker.toUpperCase(), data });
  } catch (error: any) {
    console.error(`Error fetching ${req.params.ticker}:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/quote/:ticker', async (req: express.Request, res: express.Response) => {
  try {
    const { ticker } = req.params;
    const quote = await yahooFinance.quote(ticker.toUpperCase()) as any;
    
    res.json({
      ticker: quote.symbol,
      name: quote.shortName || quote.longName,
      price: quote.regularMarketPrice,
      change: quote.regularMarketChange,
      changePercent: quote.regularMarketChangePercent,
      marketCap: quote.marketCap,
      volume: quote.regularMarketVolume
    });
  } catch (error: any) {
    console.error(`Error fetching quote for ${req.params.ticker}:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/search/:query', async (req: express.Request, res: express.Response) => {
  try {
    const { query } = req.params;
    const results = await yahooFinance.search(query) as any;
    
    const quotes = results.quotes
      .filter((q: any) => q.quoteType === 'EQUITY' || q.quoteType === 'ETF')
      .slice(0, 10)
      .map((q: any) => ({
        ticker: q.symbol,
        name: q.shortname || q.longname || q.symbol,
        type: q.quoteType,
        exchange: q.exchange
      }));
    
    res.json({ results: quotes });
  } catch (error: any) {
    console.error(`Error searching for ${req.params.query}:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// ─── Portfolio CRUD (Firebase Firestore) ────────────────────────────────────

app.get('/api/portfolios', async (req: express.Request, res: express.Response) => {
  try {
    const snapshot = await portfoliosCollection.orderBy('updatedAt', 'asc').get();
    const allPortfolios = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      // Convert Firestore Timestamps to ISO strings for JSON response
      createdAt: doc.data().createdAt?.toDate?.() ?? doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.() ?? doc.data().updatedAt,
    }));
    res.json(allPortfolios);
  } catch (error: any) {
    console.error('Error fetching portfolios:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/portfolios/:id', async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const doc = await portfoliosCollection.doc(id).get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }
    
    const data = doc.data()!;
    res.json({
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate?.() ?? data.createdAt,
      updatedAt: data.updatedAt?.toDate?.() ?? data.updatedAt,
    });
  } catch (error: any) {
    console.error('Error fetching portfolio:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/portfolios', async (req: express.Request, res: express.Response) => {
  try {
    const { name, assets } = req.body;
    if (!name || !assets) {
      return res.status(400).json({ error: 'Name and assets are required' });
    }
    
    const now = new Date();
    const docRef = await portfoliosCollection.add({
      name,
      assets,
      createdAt: now,
      updatedAt: now,
    });
    
    const newDoc = await docRef.get();
    const data = newDoc.data()!;
    
    res.status(201).json({
      id: newDoc.id,
      ...data,
      createdAt: data.createdAt?.toDate?.() ?? data.createdAt,
      updatedAt: data.updatedAt?.toDate?.() ?? data.updatedAt,
    });
  } catch (error: any) {
    console.error('Error creating portfolio:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/portfolios/:id', async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const { name, assets } = req.body;
    
    const docRef = portfoliosCollection.doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }
    
    const now = new Date();
    await docRef.update({
      name,
      assets,
      updatedAt: now,
    });
    
    const updated = await docRef.get();
    const data = updated.data()!;
    
    res.json({
      id: updated.id,
      ...data,
      createdAt: data.createdAt?.toDate?.() ?? data.createdAt,
      updatedAt: data.updatedAt?.toDate?.() ?? data.updatedAt,
    });
  } catch (error: any) {
    console.error('Error updating portfolio:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/portfolios/:id', async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const docRef = portfoliosCollection.doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }
    
    await docRef.delete();
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting portfolio:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ─── Health Check ───────────────────────────────────────────────────────────

app.get('/api/health', (req: express.Request, res: express.Response) => {
  res.json({ status: 'ok' });
});

// ─── Economic Cycle (unchanged) ────────────────────────────────────────────

type EconomicPhase = 'recovery' | 'expansion' | 'slowdown' | 'recession';

interface FREDSeriesResponse {
  observations: Array<{
    date: string;
    value: string;
  }>;
}

async function fetchFREDSeries(seriesId: string, apiKey: string, limit: number = 1): Promise<number | null> {
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=${limit}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const data = await response.json() as FREDSeriesResponse;
    if (data.observations && data.observations.length > 0) {
      const value = data.observations[0].value;
      return value === '.' ? null : parseFloat(value);
    }
    return null;
  } catch (error) {
    console.error(`Error fetching FRED series ${seriesId}:`, error);
    return null;
  }
}

async function fetchFREDSeriesHistory(seriesId: string, apiKey: string, months: number = 7): Promise<number[]> {
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=${months}`;
    const response = await fetch(url);
    if (!response.ok) return [];
    
    const data = await response.json() as FREDSeriesResponse;
    if (data.observations && data.observations.length > 0) {
      return data.observations
        .map(obs => obs.value === '.' ? null : parseFloat(obs.value))
        .filter((v): v is number => v !== null);
    }
    return [];
  } catch (error) {
    console.error(`Error fetching FRED series history ${seriesId}:`, error);
    return [];
  }
}

function calculate6MonthAnnualizedChange(history: number[]): number | null {
  if (history.length < 7) return null;
  const current = history[0];
  const sixMonthsAgo = history[6];
  if (current === 0 || sixMonthsAgo === 0) return null;
  const sixMonthChange = (current / sixMonthsAgo) - 1;
  return sixMonthChange * 2 * 100;
}

async function fetchUnemploymentChange(apiKey: string): Promise<number | null> {
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=UNRATE&api_key=${apiKey}&file_type=json&sort_order=desc&limit=2`;
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const data = await response.json() as FREDSeriesResponse;
    if (data.observations && data.observations.length >= 2) {
      const current = data.observations[0].value;
      const previous = data.observations[1].value;
      if (current === '.' || previous === '.') return null;
      return parseFloat(current) - parseFloat(previous);
    }
    return null;
  } catch (error) {
    console.error('Error fetching unemployment change:', error);
    return null;
  }
}

interface EconomicIndicators {
  recessionIndicator: number | null;
  leiAbsolute: number | null;
  leiChange: number | null;
  ceiAbsolute: number | null;
  ceiChange: number | null;
  unemploymentChange: number | null;
  gdpGrowth: number | null;
}

function determinePhase(indicators: EconomicIndicators): { phase: EconomicPhase; confidence: 'high' | 'medium' | 'low'; score: number; breakdown: Record<string, number> } {
  const { recessionIndicator, leiAbsolute, leiChange, ceiAbsolute, ceiChange, unemploymentChange, gdpGrowth } = indicators;
  
  if (recessionIndicator === 1) {
    return { phase: 'recession', confidence: 'high', score: -10, breakdown: { recessionIndicator: -10 } };
  }
  
  let score = 0;
  let dataPoints = 0;
  const breakdown: Record<string, number> = {};
  
  if (leiAbsolute !== null) {
    dataPoints++;
    let pts = 0;
    if (leiAbsolute > 101) pts = 2;
    else if (leiAbsolute > 100) pts = 1;
    else if (leiAbsolute > 99) pts = -1;
    else pts = -2;
    score += pts;
    breakdown.leiAbsolute = pts;
  }
  
  if (leiChange !== null) {
    dataPoints++;
    let pts = 0;
    if (leiChange > 2) pts = 2;
    else if (leiChange > 0) pts = 1;
    else if (leiChange > -2) pts = -1;
    else pts = -2;
    score += pts;
    breakdown.leiChange = pts;
  }
  
  if (ceiAbsolute !== null) {
    dataPoints++;
    let pts = 0;
    if (ceiAbsolute > 101) pts = 2;
    else if (ceiAbsolute > 100) pts = 1;
    else if (ceiAbsolute > 99) pts = -1;
    else pts = -2;
    score += pts;
    breakdown.ceiAbsolute = pts;
  }
  
  if (ceiChange !== null) {
    dataPoints++;
    let pts = 0;
    if (ceiChange > 3) pts = 2;
    else if (ceiChange > 1) pts = 1;
    else if (ceiChange > -1) pts = -1;
    else pts = -2;
    score += pts;
    breakdown.ceiChange = pts;
  }
  
  if (gdpGrowth !== null) {
    dataPoints++;
    let pts = 0;
    if (gdpGrowth > 3) pts = 2;
    else if (gdpGrowth > 2) pts = 1;
    else if (gdpGrowth > 0) pts = 0;
    else pts = -2;
    score += pts;
    breakdown.gdpGrowth = pts;
  }
  
  if (unemploymentChange !== null) {
    dataPoints++;
    let pts = 0;
    if (unemploymentChange < -0.2) pts = 2;
    else if (unemploymentChange < 0) pts = 1;
    else if (unemploymentChange < 0.3) pts = -1;
    else pts = -2;
    score += pts;
    breakdown.unemploymentChange = pts;
  }
  
  const confidence = dataPoints >= 5 ? 'high' : dataPoints >= 3 ? 'medium' : 'low';
  
  if (score >= 5) return { phase: 'expansion', confidence, score, breakdown };
  if (score >= 1) return { phase: 'recovery', confidence, score, breakdown };
  if (score >= -3) return { phase: 'slowdown', confidence, score, breakdown };
  return { phase: 'recession', confidence, score, breakdown };
}

app.get('/api/economic-cycle', async (req: express.Request, res: express.Response) => {
  try {
    const apiKey = process.env.FRED_API_KEY;
    
    if (!apiKey) {
      return res.status(503).json({
        error: 'FRED_API_KEY not configured',
        message: 'Economic cycle data requires a FRED API key. Get a free key at https://fred.stlouisfed.org/docs/api/api_key.html'
      });
    }
    
    const [
      recessionIndicator,
      leiHistory,
      ceiHistory,
      unemploymentRate,
      gdpGrowth,
      unemploymentChange
    ] = await Promise.all([
      fetchFREDSeries('USREC', apiKey),
      fetchFREDSeriesHistory('USALOLITONOSTSAM', apiKey, 7),
      fetchFREDSeriesHistory('USPHCI', apiKey, 7),
      fetchFREDSeries('UNRATE', apiKey),
      fetchFREDSeries('A191RL1Q225SBEA', apiKey),
      fetchUnemploymentChange(apiKey)
    ]);
    
    const leiAbsolute = leiHistory.length > 0 ? leiHistory[0] : null;
    const leiChange = calculate6MonthAnnualizedChange(leiHistory);
    const ceiAbsolute = ceiHistory.length > 0 ? ceiHistory[0] : null;
    const ceiChange = calculate6MonthAnnualizedChange(ceiHistory);
    
    const { phase, confidence, score, breakdown } = determinePhase({
      recessionIndicator,
      leiAbsolute,
      leiChange,
      ceiAbsolute,
      ceiChange,
      unemploymentChange,
      gdpGrowth
    });
    
    const phaseStartDates: Record<EconomicPhase, string> = {
      recovery: '2025-06-01',
      expansion: '2024-11-01',
      slowdown: '2025-03-01',
      recession: '2025-05-01'
    };
    
    const phaseStartDate = new Date(phaseStartDates[phase]);
    const today = new Date();
    const daysInPhase = Math.floor((today.getTime() - phaseStartDate.getTime()) / (1000 * 60 * 60 * 24));
    
    res.json({
      currentPhase: phase,
      daysInPhase: Math.max(0, daysInPhase),
      phaseStartDate: phaseStartDates[phase],
      indicators: {
        recessionIndicator: recessionIndicator ?? 0,
        recessionProbability: recessionIndicator === 1 ? 100 : 15,
        leiAbsolute: leiAbsolute ?? 100,
        leiChange: leiChange ?? 0,
        ceiAbsolute: ceiAbsolute ?? 100,
        ceiChange: ceiChange ?? 0,
        unemploymentRate: unemploymentRate ?? 4.2,
        gdpGrowth: gdpGrowth ?? 2.0,
        lastUpdated: new Date().toISOString()
      },
      score,
      breakdown,
      confidence,
      source: 'fred'
    });
  } catch (error: any) {
    console.error('Error fetching economic cycle:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Yahoo Finance API server running on port ${PORT}`);
});

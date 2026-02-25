const ALPHA_VANTAGE_KEY = process.env.ALPHA_VANTAGE_API_KEY;

interface StockQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
}

interface HistoricalData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const cache: Map<string, { data: any; timestamp: number }> = new Map();
const CACHE_DURATION = 5 * 60 * 1000;

const getCached = <T>(key: string): T | null => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data as T;
  }
  return null;
};

const setCache = (key: string, data: any) => {
  cache.set(key, { data, timestamp: Date.now() });
};

export const isApiKeyConfigured = (): boolean => {
  return !!ALPHA_VANTAGE_KEY;
};

export const getStockQuote = async (symbol: string): Promise<StockQuote | null> => {
  if (!ALPHA_VANTAGE_KEY) {
    console.warn('Alpha Vantage API key not configured');
    return null;
  }

  const cacheKey = `quote_${symbol}`;
  const cached = getCached<StockQuote>(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(
      `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_KEY}`
    );
    const data = await response.json();

    if (data['Global Quote']) {
      const quote = data['Global Quote'];
      const result: StockQuote = {
        symbol: quote['01. symbol'],
        price: parseFloat(quote['05. price']),
        change: parseFloat(quote['09. change']),
        changePercent: parseFloat(quote['10. change percent'].replace('%', '')),
        volume: parseInt(quote['06. volume']),
      };
      setCache(cacheKey, result);
      return result;
    }
    return null;
  } catch (error) {
    console.error('Failed to fetch stock quote:', error);
    return null;
  }
};

export const getHistoricalData = async (
  symbol: string,
  months: number = 12
): Promise<HistoricalData[]> => {
  if (!ALPHA_VANTAGE_KEY) {
    console.warn('Alpha Vantage API key not configured');
    return [];
  }

  const cacheKey = `history_${symbol}_${months}`;
  const cached = getCached<HistoricalData[]>(cacheKey);
  if (cached) return cached;

  try {
    const outputSize = months > 12 ? 'full' : 'compact';
    const response = await fetch(
      `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${symbol}&outputsize=${outputSize}&apikey=${ALPHA_VANTAGE_KEY}`
    );
    const data = await response.json();

    if (data['Time Series (Daily)']) {
      const timeSeries = data['Time Series (Daily)'];
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - months);

      const result: HistoricalData[] = Object.entries(timeSeries)
        .map(([date, values]: [string, any]) => ({
          date,
          open: parseFloat(values['1. open']),
          high: parseFloat(values['2. high']),
          low: parseFloat(values['3. low']),
          close: parseFloat(values['5. adjusted close']),
          volume: parseInt(values['6. volume']),
        }))
        .filter(item => new Date(item.date) >= cutoffDate)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      setCache(cacheKey, result);
      return result;
    }
    return [];
  } catch (error) {
    console.error('Failed to fetch historical data:', error);
    return [];
  }
};

export const getMultipleHistoricalData = async (
  symbols: string[],
  months: number = 12
): Promise<Record<string, HistoricalData[]>> => {
  const results: Record<string, HistoricalData[]> = {};
  
  for (const symbol of symbols) {
    const data = await getHistoricalData(symbol, months);
    results[symbol] = data;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  
  return results;
};

export const calculateReturnsFromHistorical = (data: HistoricalData[]): number => {
  if (data.length < 2) return 0;
  const startPrice = data[0].close;
  const endPrice = data[data.length - 1].close;
  return (endPrice - startPrice) / startPrice;
};

export const calculateVolatilityFromHistorical = (data: HistoricalData[]): number => {
  if (data.length < 2) return 0;
  
  const returns: number[] = [];
  for (let i = 1; i < data.length; i++) {
    const prevClose = data[i - 1].close;
    const currClose = data[i].close;
    returns.push((currClose - prevClose) / prevClose);
  }
  
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
  return Math.sqrt(variance) * Math.sqrt(252);
};

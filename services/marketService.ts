
import { BacktestResult, PortfolioItem, DCAConfig, SavedPortfolio } from '../types';

const API_BASE = '/api';

export type ReturnType = 'total' | 'price';
export type RebalanceFrequency = 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUALLY' | 'ANNUALLY' | 'NONE';

export interface RebalanceConfig {
  enabled: boolean;
  frequency: RebalanceFrequency;
}

async function fetchSavedPortfolio(portfolioId: number): Promise<SavedPortfolio | null> {
  try {
    const response = await fetch(`${API_BASE}/portfolios/${portfolioId}`);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('Error fetching saved portfolio:', error);
    return null;
  }
}

async function expandPortfolioAssets(portfolio: PortfolioItem[], depth: number = 0): Promise<PortfolioItem[]> {
  if (depth > 5) {
    return [];
  }
  
  const expandedAssets: PortfolioItem[] = [];
  
  for (const asset of portfolio) {
    if (asset.isPortfolio && asset.portfolioId) {
      const savedPortfolio = await fetchSavedPortfolio(asset.portfolioId);
      if (savedPortfolio && savedPortfolio.assets) {
        const nestedExpanded = await expandPortfolioAssets(savedPortfolio.assets, depth + 1);
        for (const subAsset of nestedExpanded) {
          const combinedWeight = (asset.weight / 100) * subAsset.weight;
          const existingIdx = expandedAssets.findIndex(a => a.ticker === subAsset.ticker);
          if (existingIdx >= 0) {
            expandedAssets[existingIdx].weight += combinedWeight;
          } else {
            expandedAssets.push({ ...subAsset, weight: combinedWeight });
          }
        }
      }
    } else {
      const existingIdx = expandedAssets.findIndex(a => a.ticker === asset.ticker);
      if (existingIdx >= 0) {
        expandedAssets[existingIdx].weight += asset.weight;
      } else {
        expandedAssets.push({ ...asset });
      }
    }
  }
  
  return expandedAssets;
}

async function getBenchmarkAssets(benchmarkTicker: string): Promise<PortfolioItem[] | null> {
  if (benchmarkTicker.startsWith('PORT_')) {
    const portfolioId = parseInt(benchmarkTicker.replace('PORT_', ''));
    const savedPortfolio = await fetchSavedPortfolio(portfolioId);
    if (savedPortfolio && savedPortfolio.assets) {
      return await expandPortfolioAssets(savedPortfolio.assets);
    }
    return null;
  }
  return null;
}

interface HistoricalDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjClose: number;
  volume: number;
}

interface HistoricalResponse {
  ticker: string;
  data: HistoricalDataPoint[];
}

const calculateCorrelation = (returns1: number[], returns2: number[]) => {
  const n = returns1.length;
  if (n !== returns2.length || n === 0) return 0;
  
  const mean1 = returns1.reduce((a, b) => a + b, 0) / n;
  const mean2 = returns2.reduce((a, b) => a + b, 0) / n;
  
  let num = 0;
  let den1 = 0;
  let den2 = 0;
  
  for (let i = 0; i < n; i++) {
    const d1 = returns1[i] - mean1;
    const d2 = returns2[i] - mean2;
    num += d1 * d2;
    den1 += d1 * d1;
    den2 += d2 * d2;
  }
  
  if (den1 === 0 || den2 === 0) return 0;
  return num / Math.sqrt(den1 * den2);
};

const calculateVolatility = (values: number[]) => {
  const returns = [];
  for (let i = 1; i < values.length; i++) {
    returns.push((values[i] - values[i - 1]) / values[i - 1]);
  }
  if (returns.length === 0) return 0;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
  return Math.sqrt(variance) * Math.sqrt(252);
};

const calculateMaxDrawdownDetails = (values: number[], dates: string[]) => {
  let peak = -Infinity;
  let peakIndex = 0;
  let maxDd = 0;
  let startIdx = 0;
  let endIdx = 0;

  for (let i = 0; i < values.length; i++) {
    if (values[i] > peak) {
      peak = values[i];
      peakIndex = i;
    }
    const dd = (peak - values[i]) / peak;
    if (dd > maxDd) {
      maxDd = dd;
      startIdx = peakIndex;
      endIdx = i;
    }
  }

  const startDateStr = dates[startIdx];
  const endDateStr = dates[endIdx];
  let days = 0;
  
  if (startDateStr && endDateStr) {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  }

  return {
    maxDrawdown: maxDd,
    start: startDateStr,
    end: endDateStr,
    days: days
  };
};

const calculateCAGR = (start: number, end: number, days: number) => {
  if (start === 0) return 0;
  const years = days / 252;
  return Math.pow((end / start), (1 / years)) - 1;
};

async function fetchHistoricalData(ticker: string, months: number, ytd: boolean = false): Promise<HistoricalResponse | null> {
  try {
    const url = ytd 
      ? `${API_BASE}/historical/${ticker}?ytd=true`
      : `${API_BASE}/historical/${ticker}?months=${months}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ${ticker}`);
    return await response.json();
  } catch (error) {
    console.error(`Error fetching ${ticker}:`, error);
    return null;
  }
}

async function fetchRiskFreeRate(): Promise<number> {
  try {
    const response = await fetch(`${API_BASE}/quote/^TNX`);
    if (!response.ok) return 0.04;
    const data = await response.json();
    return (data.price || 4) / 100;
  } catch (error) {
    console.error('Error fetching risk-free rate:', error);
    return 0.04;
  }
}

function alignPriceData(
  allData: Record<string, HistoricalDataPoint[]>,
  benchmarkData: HistoricalDataPoint[],
  returnType: ReturnType = 'total'
): { dates: string[]; alignedPrices: Record<string, number[]>; benchmarkPrices: number[] } {
  const benchmarkDates = new Set(benchmarkData.map(d => d.date));
  const commonDates = Array.from(benchmarkDates).sort();
  
  const alignedPrices: Record<string, number[]> = {};
  const benchmarkPrices: number[] = [];
  const validDates: string[] = [];

  const priceField = returnType === 'total' ? 'adjClose' : 'close';
  
  const benchmarkByDate = new Map(benchmarkData.map(d => [d.date, d[priceField]]));
  const assetsByDate: Record<string, Map<string, number>> = {};
  
  for (const ticker in allData) {
    assetsByDate[ticker] = new Map(allData[ticker].map(d => [d.date, d[priceField]]));
    alignedPrices[ticker] = [];
  }

  for (const date of commonDates) {
    let allAssetsHaveData = true;
    for (const ticker in allData) {
      if (!assetsByDate[ticker].has(date)) {
        allAssetsHaveData = false;
        break;
      }
    }
    
    if (allAssetsHaveData && benchmarkByDate.has(date)) {
      validDates.push(date);
      benchmarkPrices.push(benchmarkByDate.get(date)!);
      for (const ticker in allData) {
        alignedPrices[ticker].push(assetsByDate[ticker].get(date)!);
      }
    }
  }

  return { dates: validDates, alignedPrices, benchmarkPrices };
}

export const runBacktest = async (
  portfolio: PortfolioItem[], 
  months: number = 12, 
  benchmarkTicker: string = 'SPY',
  dcaConfig: DCAConfig = { enabled: false, amount: 0, frequency: 'MONTHLY' },
  returnType: ReturnType = 'total',
  isYtd: boolean = false,
  rebalanceConfig: RebalanceConfig = { enabled: false, frequency: 'QUARTERLY' }
): Promise<BacktestResult> => {
  const initialCapital = 10000;
  
  const expandedPortfolio = await expandPortfolioAssets(portfolio);
  
  const benchmarkAssets = await getBenchmarkAssets(benchmarkTicker);
  const isPortfolioBenchmark = benchmarkAssets !== null;
  
  const fetchPromises = expandedPortfolio.map(asset => fetchHistoricalData(asset.ticker, months, isYtd));
  
  if (isPortfolioBenchmark && benchmarkAssets) {
    benchmarkAssets.forEach(asset => {
      if (!expandedPortfolio.some(p => p.ticker === asset.ticker)) {
        fetchPromises.push(fetchHistoricalData(asset.ticker, months, isYtd));
      }
    });
  } else {
    fetchPromises.push(fetchHistoricalData(benchmarkTicker, months, isYtd));
  }
  
  const results = await Promise.all(fetchPromises);
  
  const assetData: Record<string, HistoricalDataPoint[]> = {};
  const failedTickers: string[] = [];
  
  let resultIdx = 0;
  expandedPortfolio.forEach((asset) => {
    const result = results[resultIdx++];
    if (result && result.data.length > 0) {
      assetData[asset.ticker] = result.data;
    } else {
      failedTickers.push(asset.ticker);
    }
  });

  if (failedTickers.length > 0) {
    throw new Error(`Failed to fetch data for: ${failedTickers.join(', ')}`);
  }

  let benchmarkData: HistoricalDataPoint[];
  let benchmarkWeights: Record<string, number> = {};
  
  if (isPortfolioBenchmark && benchmarkAssets) {
    benchmarkAssets.forEach(asset => {
      benchmarkWeights[asset.ticker] = asset.weight / 100;
      if (!assetData[asset.ticker]) {
        const result = results[resultIdx++];
        if (result && result.data.length > 0) {
          assetData[asset.ticker] = result.data;
        }
      }
    });
    const firstBenchmarkTicker = benchmarkAssets[0].ticker;
    benchmarkData = assetData[firstBenchmarkTicker] || [];
  } else {
    const benchmarkResult = results[results.length - 1];
    if (!benchmarkResult || benchmarkResult.data.length === 0) {
      throw new Error(`Failed to fetch benchmark data for ${benchmarkTicker}`);
    }
    benchmarkData = benchmarkResult.data;
  }

  const { dates, alignedPrices, benchmarkPrices } = alignPriceData(assetData, benchmarkData, returnType);
  
  if (dates.length === 0) {
    throw new Error('No overlapping dates found between assets');
  }

  const assetDailyReturns: Record<string, number[]> = {};
  for (const ticker in alignedPrices) {
    const prices = alignedPrices[ticker];
    assetDailyReturns[ticker] = [];
    for (let i = 1; i < prices.length; i++) {
      const prev = prices[i-1] === 0 ? 0.01 : prices[i-1];
      assetDailyReturns[ticker].push((prices[i] - prev) / prev);
    }
  }

  const portfolioValues: number[] = [];
  const benchmarkValues: number[] = [];
  
  const shares: Record<string, number> = {};
  expandedPortfolio.forEach(asset => {
    if (alignedPrices[asset.ticker]) {
      const allocAmt = initialCapital * (asset.weight / 100);
      shares[asset.ticker] = allocAmt / alignedPrices[asset.ticker][0];
    }
  });
  
  const benchmarkShares: Record<string, number> = {};
  if (isPortfolioBenchmark && benchmarkAssets) {
    benchmarkAssets.forEach(asset => {
      if (alignedPrices[asset.ticker]) {
        const allocAmt = initialCapital * (asset.weight / 100);
        benchmarkShares[asset.ticker] = allocAmt / alignedPrices[asset.ticker][0];
      }
    });
  } else {
    benchmarkShares['__single__'] = initialCapital / benchmarkPrices[0];
  }
  
  let totalInvested = initialCapital;

  const freqMap: Record<string, number> = {
    'WEEKLY': 5,
    'BI_WEEKLY': 10,
    'MONTHLY': 21,
    'QUARTERLY': 63,
    'SEMI_ANNUALLY': 126,
    'ANNUALLY': 252
  };
  const dcaInterval = dcaConfig.enabled ? freqMap[dcaConfig.frequency] : Infinity;
  const rebalanceInterval = rebalanceConfig.enabled ? freqMap[rebalanceConfig.frequency] : Infinity;

  for (let i = 0; i < dates.length; i++) {
    if (rebalanceConfig.enabled && i > 0 && i % rebalanceInterval === 0) {
      let currentTotal = 0;
      expandedPortfolio.forEach(asset => {
        if (alignedPrices[asset.ticker]) {
          currentTotal += shares[asset.ticker] * alignedPrices[asset.ticker][i];
        }
      });
      
      expandedPortfolio.forEach(asset => {
        if (alignedPrices[asset.ticker]) {
          const targetValue = currentTotal * (asset.weight / 100);
          shares[asset.ticker] = targetValue / alignedPrices[asset.ticker][i];
        }
      });
    }
    
    if (dcaConfig.enabled && i > 0 && i % dcaInterval === 0) {
      const deposit = dcaConfig.amount;
      totalInvested += deposit;

      expandedPortfolio.forEach(asset => {
        if (alignedPrices[asset.ticker]) {
          const amountToBuy = deposit * (asset.weight / 100);
          const currentPrice = alignedPrices[asset.ticker][i];
          const newShares = amountToBuy / currentPrice;
          shares[asset.ticker] += newShares;
        }
      });

      if (isPortfolioBenchmark && benchmarkAssets) {
        benchmarkAssets.forEach(asset => {
          if (alignedPrices[asset.ticker]) {
            const amountToBuy = deposit * (asset.weight / 100);
            const currentPrice = alignedPrices[asset.ticker][i];
            benchmarkShares[asset.ticker] += amountToBuy / currentPrice;
          }
        });
      } else {
        benchmarkShares['__single__'] += deposit / benchmarkPrices[i];
      }
    }

    let dailyTotal = 0;
    expandedPortfolio.forEach(asset => {
      if (alignedPrices[asset.ticker]) {
        dailyTotal += shares[asset.ticker] * alignedPrices[asset.ticker][i];
      }
    });
    portfolioValues.push(dailyTotal);
    
    let benchmarkDailyTotal = 0;
    if (isPortfolioBenchmark && benchmarkAssets) {
      benchmarkAssets.forEach(asset => {
        if (alignedPrices[asset.ticker]) {
          benchmarkDailyTotal += benchmarkShares[asset.ticker] * alignedPrices[asset.ticker][i];
        }
      });
    } else {
      benchmarkDailyTotal = benchmarkShares['__single__'] * benchmarkPrices[i];
    }
    benchmarkValues.push(benchmarkDailyTotal);
  }

  const finalVal = portfolioValues[portfolioValues.length - 1];
  const bFinalVal = benchmarkValues[benchmarkValues.length - 1];

  const totalReturn = (finalVal - totalInvested) / totalInvested;
  const bTotalReturn = (bFinalVal - totalInvested) / totalInvested;

  const formattedDates = dates.map(d => new Date(d).toLocaleDateString());
  
  const ddDetails = calculateMaxDrawdownDetails(portfolioValues, dates);
  const bDdDetails = calculateMaxDrawdownDetails(benchmarkValues, dates);

  const volatility = calculateVolatility(portfolioValues);
  const bVolatility = calculateVolatility(benchmarkValues);
  
  const riskFreeRate = await fetchRiskFreeRate();
  
  let cagr = 0; 
  let bCagr = 0;

  if (dcaConfig.enabled) {
    cagr = totalReturn / (months / 12);
    bCagr = bTotalReturn / (months / 12);
  } else {
    cagr = calculateCAGR(initialCapital, finalVal, dates.length);
    bCagr = calculateCAGR(initialCapital, bFinalVal, dates.length);
  }
  
  const sharpeRatio = volatility === 0 ? 0 : (cagr - riskFreeRate) / volatility;
  const bSharpeRatio = bVolatility === 0 ? 0 : (bCagr - riskFreeRate) / bVolatility;

  const assetReturns: Record<string, number> = {};
  expandedPortfolio.forEach(asset => {
    if (alignedPrices[asset.ticker]) {
      const prices = alignedPrices[asset.ticker];
      const start = prices[0];
      const end = prices[prices.length - 1];
      assetReturns[asset.ticker] = (end - start) / start;
    }
  });
  
  const correlationMatrix: Record<string, Record<string, number>> = {};
  const tickers = expandedPortfolio.map(p => p.ticker);
  const validTickers = tickers.filter(t => assetDailyReturns[t] && assetDailyReturns[t].length > 0);

  validTickers.forEach(t1 => {
    correlationMatrix[t1] = {};
    validTickers.forEach(t2 => {
      if (t1 === t2) {
        correlationMatrix[t1][t2] = 1;
      } else {
        correlationMatrix[t1][t2] = calculateCorrelation(assetDailyReturns[t1], assetDailyReturns[t2]);
      }
    });
  });
  
  return {
    dates: formattedDates,
    rawDates: dates,
    portfolioValues,
    benchmarkValues,
    assetReturns,
    correlationMatrix,
    benchmarkTicker,
    dataSource: 'real' as const,
    returnType,
    metrics: {
      cagr,
      maxDrawdown: ddDetails.maxDrawdown,
      maxDrawdownStart: ddDetails.start,
      maxDrawdownEnd: ddDetails.end,
      maxDrawdownDays: ddDetails.days,
      volatility,
      sharpeRatio,
      totalReturn,
      finalBalance: finalVal,
      totalInvested
    },
    benchmarkMetrics: {
      cagr: bCagr,
      maxDrawdown: bDdDetails.maxDrawdown,
      volatility: bVolatility,
      sharpeRatio: bSharpeRatio,
      totalReturn: bTotalReturn,
      finalBalance: bFinalVal
    }
  };
};

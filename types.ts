
export interface Asset {
  ticker: string;
  name: string;
  type: 'STOCK' | 'ETF' | 'PORTFOLIO';
  assetClass: string;
  sector?: string;
  price?: number;
  description?: string;
  isPortfolio?: boolean;
  portfolioId?: number;
}

export interface PortfolioItem extends Asset {
  weight: number;
  color: string;
}

export interface DCAConfig {
  enabled: boolean;
  amount: number;
  frequency: 'WEEKLY' | 'BI_WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
}

export interface BacktestResult {
  dates: string[];
  rawDates: string[];
  portfolioValues: number[];
  benchmarkValues: number[];
  assetReturns: Record<string, number>;
  correlationMatrix: Record<string, Record<string, number>>;
  benchmarkTicker: string;
  dataSource: 'simulated' | 'real';
  returnType: 'total' | 'price';
  metrics: {
    cagr: number;
    maxDrawdown: number;
    maxDrawdownStart?: string;
    maxDrawdownEnd?: string;
    maxDrawdownDays?: number;
    volatility: number;
    sharpeRatio: number;
    totalReturn: number;
    finalBalance: number;
    totalInvested: number;
  };
  benchmarkMetrics: {
    cagr: number;
    maxDrawdown: number;
    volatility: number;
    sharpeRatio: number;
    totalReturn: number;
    finalBalance: number;
  };
}

export interface TimeSeriesData {
  date: string;
  value: number;
}

export interface SavedPortfolio {
  id: number;
  name: string;
  assets: PortfolioItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, PieChart, TrendingUp, Plus, Activity, RefreshCw, Save, FolderOpen, Info, FileText, Coins, Wand2, MessageCircle, Send, X, Sparkles, DollarSign, BarChart2, Scale, ChevronDown, Layers } from 'lucide-react';
import { Asset, PortfolioItem, BacktestResult, SavedPortfolio, DCAConfig, ChatMessage } from './types';
import { searchAssets, suggestBenchmark, generatePortfolioInsight, chatAboutPortfolio } from './services/geminiService';
import { runBacktest, ReturnType, RebalanceConfig, RebalanceFrequency } from './services/marketService';
import AssetCard from './components/AssetCard';
import AllocationChart from './components/AllocationChart';
import BacktestChart from './components/BacktestChart';
import CorrelationMatrix from './components/CorrelationMatrix';
import ThemesPage from './components/ThemesPage';

type ActiveTab = 'portfolio' | 'themes';

type EconomicPhase = 'recovery' | 'expansion' | 'slowdown' | 'recession';

interface PhaseInfo {
  name: string;
  description: string;
  causes: string[];
  benefitMost: string[];
  benefitLeast: string[];
  daysInPhase: number;
  lastPeriod?: string;
}

const ECONOMIC_PHASES: Record<EconomicPhase, PhaseInfo> = {
  recovery: {
    name: 'Recovery',
    description: 'The economy is rebounding from a recession. Activity is picking up, credit is expanding, and profits are growing rapidly.',
    causes: [
      'Activity rebounds (GDP, IP, employment, incomes)',
      'Credit begins to grow',
      'Profits grow rapidly',
      'Policy still stimulative',
      'Inventories low, sales improve'
    ],
    benefitMost: ['Technology', 'Consumer Cyclical', 'Industrials', 'Mid Caps', 'Growth Stocks'],
    benefitLeast: ['Communication Services', 'Energy', 'Real Estate', 'Large Caps', 'Income Stocks'],
    daysInPhase: 180
  },
  expansion: {
    name: 'Expansion',
    description: 'The economy is growing at a strong pace with peak profit growth and neutral policy. Sales and inventories reach equilibrium.',
    causes: [
      'Growth peaking',
      'Credit growth strong',
      'Profit growth peak',
      'Policy neutral',
      'Inventories, sales grow, equilibrium reached'
    ],
    benefitMost: ['Healthcare', 'Technology', 'Consumer Cyclical', 'Small Caps', 'Value Stocks'],
    benefitLeast: ['Real Estate', 'Energy', 'Industrials', 'Mid Caps', 'Growth Stocks'],
    daysInPhase: 120,
    lastPeriod: 'November 2024 - March 2025'
  },
  slowdown: {
    name: 'Slowdown',
    description: 'Economic growth is decelerating. Policy becomes contractionary, credit tightens, and earnings come under pressure.',
    causes: [
      'Growth moderating',
      'Credit tightens',
      'Earnings under pressure',
      'Policy contractionary',
      'Inventories grow, sales growth falls'
    ],
    benefitMost: ['Basic Materials', 'Energy', 'Communication Services', 'Small Caps', 'Value Stocks'],
    benefitLeast: ['Consumer Defensive', 'Healthcare', 'Consumer Cyclical', 'Mid Caps', 'Growth Stocks'],
    daysInPhase: 60,
    lastPeriod: 'March 2025 - May 2025'
  },
  recession: {
    name: 'Recession',
    description: 'Economic activity is contracting. Credit dries up, profits decline, but policy begins to ease to stimulate recovery.',
    causes: [
      'Falling activity',
      'Credit dries up',
      'Profits decline',
      'Policy eases',
      'Inventories, sales fall'
    ],
    benefitMost: ['Industrials', 'Healthcare', 'Financial Services', 'Large Caps', 'Growth Stocks'],
    benefitLeast: ['Real Estate', 'Utilities', 'Technology', 'Micro Caps', 'Income Stocks'],
    daysInPhase: 45,
    lastPeriod: 'May 2025 - June 2025'
  }
};

const CLASS_COLORS: Record<string, string> = {
    'US Equity': '#0ea5e9',
    'Intl Equity': '#3b82f6',
    'Emerging Markets': '#8b5cf6',
    'Fixed Income': '#22c55e',
    'Real Estate': '#f97316',
    'Commodities': '#eab308',
    'Crypto': '#f43f5e',
    'Cash/Currency': '#64748b',
    'Other': '#94a3b8'
};

const TIMEFRAMES = [
  { label: 'YTD', months: 0, ytd: true },
  { label: '1Y', months: 12 },
  { label: '3Y', months: 36 },
  { label: '5Y', months: 60 },
  { label: '7Y', months: 84 },
  { label: '10Y', months: 120 },
  { label: '20Y', months: 240 },
  { label: 'MAX', months: 360 },
];

const BENCHMARKS = ['SPY', 'QQQ', 'IWM', 'AGG', 'VT', 'GLD', 'BTC'];

const App = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('portfolio');
  
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Asset[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [activePortfolioId, setActivePortfolioId] = useState<number | null>(null);
  const [savedPortfolios, setSavedPortfolios] = useState<SavedPortfolio[]>([]);
  const [isLoadingPortfolios, setIsLoadingPortfolios] = useState(true);
  
  const [months, setMonths] = useState(12);
  const [isYtd, setIsYtd] = useState(false);
  const [showAddPortfolioDropdown, setShowAddPortfolioDropdown] = useState(false);
  const addPortfolioRef = useRef<HTMLDivElement>(null);
  const [manualAllocation, setManualAllocation] = useState(false);
  const [benchmarkTicker, setBenchmarkTicker] = useState('SPY');
  const [dcaConfig, setDcaConfig] = useState<DCAConfig>({
      enabled: false,
      amount: 500,
      frequency: 'MONTHLY'
  });
  const [rebalanceConfig, setRebalanceConfig] = useState<RebalanceConfig>({
      enabled: false,
      frequency: 'QUARTERLY'
  });
  const [showRebalanceSettings, setShowRebalanceSettings] = useState(false);
  const [returnType, setReturnType] = useState<ReturnType>('total');
  
  const [currentEconomicPhase, setCurrentEconomicPhase] = useState<EconomicPhase | null>(null);
  const [economicCycleDays, setEconomicCycleDays] = useState<number>(0);
  const [economicCycleSource, setEconomicCycleSource] = useState<'live' | 'unavailable'>('unavailable');
  const [showPhaseModal, setShowPhaseModal] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState<EconomicPhase | null>(null);

  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string>("");
  const [isGeneratingInsight, setIsGeneratingInsight] = useState(false);
  
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveMode, setSaveMode] = useState<'OVERWRITE' | 'NEW' | 'INITIAL'>('INITIAL');
  const [portfolioName, setPortfolioName] = useState('');
  
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showDcaSettings, setShowDcaSettings] = useState(false);
  
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const menuRef = useRef<HTMLDivElement>(null);

  const totalWeight = useMemo(() => portfolio.reduce((sum, item) => sum + item.weight, 0), [portfolio]);
  const isValidPortfolio = Math.abs(totalWeight - 100) < 0.1 && portfolio.length > 0;

  const [isBacktesting, setIsBacktesting] = useState(false);
  const [backtestError, setBacktestError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    
    if (isValidPortfolio) {
        setIsBacktesting(true);
        setBacktestError(null);
        
        runBacktest(portfolio, months, benchmarkTicker, dcaConfig, returnType, isYtd, rebalanceConfig)
          .then(result => {
            if (!isCancelled) {
              setBacktestResult(result);
              setIsBacktesting(false);
            }
          })
          .catch(error => {
            if (!isCancelled) {
              console.error('Backtest error:', error);
              setBacktestError(error.message || 'Failed to fetch market data');
              setBacktestResult(null);
              setIsBacktesting(false);
            }
          });
    } else {
        setIsBacktesting(false);
        setBacktestResult(null);
        setBacktestError(null);
    }
    
    return () => {
      isCancelled = true;
    };
  }, [portfolio, months, isValidPortfolio, benchmarkTicker, dcaConfig, returnType, isYtd, rebalanceConfig]);

  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
              setIsMenuOpen(false);
          }
          if (addPortfolioRef.current && !addPortfolioRef.current.contains(event.target as Node)) {
              setShowAddPortfolioDropdown(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    const fetchPortfolios = async () => {
      try {
        const response = await fetch('/api/portfolios');
        if (response.ok) {
          const data = await response.json();
          setSavedPortfolios(data);
        }
      } catch (error) {
        console.error('Error fetching portfolios:', error);
      } finally {
        setIsLoadingPortfolios(false);
      }
    };
    fetchPortfolios();
  }, []);

  useEffect(() => {
    const fetchEconomicCycle = async () => {
      try {
        const response = await fetch('/api/economic-cycle');
        if (response.ok) {
          const data = await response.json();
          if (!data.error) {
            setCurrentEconomicPhase(data.currentPhase as EconomicPhase);
            setEconomicCycleDays(data.daysInPhase);
            setEconomicCycleSource('live');
          } else {
            setEconomicCycleSource('unavailable');
          }
        } else {
          setEconomicCycleSource('unavailable');
        }
      } catch (error) {
        console.error('Error fetching economic cycle:', error);
        setEconomicCycleSource('unavailable');
      }
    };
    fetchEconomicCycle();
    const interval = setInterval(fetchEconomicCycle, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setIsSearching(true);
    setSearchResults([]);
    // const results = await searchAssets(query);
    const results: Asset[] = [    
      {
      "ticker": "NO",
          "name": "Norwegian Air Shuttle ASA",
          "type": "STOCK",
          "sector": "Industrials",
          "assetClass": "Intl Equity"
      },
      {
        "ticker": "AIR",
        "name": "AAR Corp.",
        "type": "STOCK",
        "sector": "Industrials",
        "assetClass": "US Equity"
    }]
    console.log(results)
    setSearchResults(results);
    setIsSearching(false);
  };

  const handleGenerateInsight = async () => {
    if (!isValidPortfolio || isGeneratingInsight) return;
    setIsGeneratingInsight(true);
    setAiAnalysis("");
    
    const metrics = backtestResult ? {
      totalReturn: backtestResult.metrics.totalReturn,
      cagr: backtestResult.metrics.cagr,
      maxDrawdown: backtestResult.metrics.maxDrawdown,
      volatility: backtestResult.metrics.volatility,
      sharpeRatio: backtestResult.metrics.sharpeRatio,
    } : undefined;
    
    const insight = await generatePortfolioInsight(portfolio, metrics);
    setAiAnalysis(insight);
    setIsGeneratingInsight(false);
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || isSendingChat) return;
    
    const userMessage: ChatMessage = {
      role: 'user',
      content: chatInput.trim(),
      timestamp: Date.now()
    };
    
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsSendingChat(true);
    
    const response = await chatAboutPortfolio(userMessage.content, portfolio, aiAnalysis, chatMessages);
    
    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: response,
      timestamp: Date.now()
    };
    
    setChatMessages(prev => [...prev, assistantMessage]);
    setIsSendingChat(false);
  };

  const addToPortfolio = (asset: Asset) => {
    if (portfolio.some(p => p.ticker === asset.ticker)) return;
    
    const color = CLASS_COLORS[asset.assetClass] || CLASS_COLORS['Other'];
    
    let newPortfolio: PortfolioItem[] = [];
    if (portfolio.length === 0) {
      newPortfolio = [{ ...asset, weight: 100, color }];
      setManualAllocation(false);
    } else if (!manualAllocation) {
      const count = portfolio.length + 1;
      const evenWeight = 100 / count;
      newPortfolio = [...portfolio.map(item => ({ ...item, weight: evenWeight })), { ...asset, weight: evenWeight, color }];
    } else {
      const NEW_ASSET_WEIGHT = 1;
      const scalingFactor = (100 - NEW_ASSET_WEIGHT) / 100;
      newPortfolio = portfolio.map(item => ({ ...item, weight: item.weight * scalingFactor }));
      newPortfolio.push({ ...asset, weight: NEW_ASSET_WEIGHT, color });
    }
    setPortfolio(newPortfolio);
    setSearchResults([]);
    setQuery('');
    setAiAnalysis("");
  };

  const addSavedPortfolioAsAsset = (saved: SavedPortfolio) => {
    const portfolioTicker = `PORT_${saved.id}`;
    if (portfolio.some(p => p.ticker === portfolioTicker)) return;
    
    const portfolioAsset: Asset = {
      ticker: portfolioTicker,
      name: saved.name,
      type: 'PORTFOLIO',
      assetClass: 'Other',
      isPortfolio: true,
      portfolioId: saved.id
    };
    
    addToPortfolio(portfolioAsset);
  };

  const updateWeight = (ticker: string, weight: number) => {
    setManualAllocation(true);
    setPortfolio(prev => prev.map(item => item.ticker === ticker ? { ...item, weight: weight } : item));
  };

  const removeAsset = (ticker: string) => {
    setPortfolio(prev => prev.filter(item => item.ticker !== ticker));
    setAiAnalysis("");
  };

  const handleAutoBalance = () => {
    if (portfolio.length === 0) return;
    const evenWeight = 100 / portfolio.length;
    setPortfolio(portfolio.map((item) => ({ ...item, weight: evenWeight })));
    setManualAllocation(false);
  };

  const handleAutoBenchmark = async () => {
      if (portfolio.length === 0) return;
      const suggested = await suggestBenchmark(portfolio);
      setBenchmarkTicker(suggested);
  };

  const initiateSave = () => {
      setShowSaveDialog(true);
      setIsMenuOpen(false);
      
      if (activePortfolioId) {
          setSaveMode('OVERWRITE');
          const current = savedPortfolios.find(p => p.id === activePortfolioId);
          if (current) setPortfolioName(current.name);
      } else {
          setSaveMode('INITIAL');
          setPortfolioName('');
      }
  };

  const savePortfolio = async (forceNew: boolean = false) => {
    if (!portfolioName && !activePortfolioId) return;

    let nameToSave = portfolioName;

    if (!forceNew && activePortfolioId) {
        const existing = savedPortfolios.find(p => p.id === activePortfolioId);
        if (existing) nameToSave = existing.name;
    }

    if (forceNew || !activePortfolioId) {
        if (!portfolioName) return;
        try {
          const response = await fetch('/api/portfolios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: portfolioName, assets: portfolio })
          });
          if (response.ok) {
            const newPortfolio = await response.json();
            setSavedPortfolios(prev => [...prev, newPortfolio]);
            setActivePortfolioId(newPortfolio.id);
          }
        } catch (error) {
          console.error('Error saving portfolio:', error);
        }
    } else {
        try {
          const response = await fetch(`/api/portfolios/${activePortfolioId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: nameToSave, assets: portfolio })
          });
          if (response.ok) {
            const updated = await response.json();
            setSavedPortfolios(prev => prev.map(p => p.id === activePortfolioId ? updated : p));
          }
        } catch (error) {
          console.error('Error updating portfolio:', error);
        }
    }
    
    setShowSaveDialog(false);
  };

  const loadPortfolio = (saved: SavedPortfolio) => {
      const assets = saved.assets || [];
      const assetsWithColors = assets.map(asset => ({
        ...asset,
        color: asset.color || CLASS_COLORS[asset.assetClass] || CLASS_COLORS['Other']
      }));
      setPortfolio(assetsWithColors);
      setActivePortfolioId(saved.id);
      setPortfolioName(saved.name);
      setShowLoadDialog(false);
      setIsMenuOpen(false);
      setAiAnalysis("");
  };

  const createNew = () => {
      setPortfolio([]);
      setActivePortfolioId(null);
      setManualAllocation(false);
      setBacktestResult(null);
      setPortfolioName('');
      setIsMenuOpen(false);
      setAiAnalysis("");
      setChatMessages([]);
  }

  const deletePortfolio = async (id: number) => {
    if (!confirm('Are you sure you want to delete this portfolio?')) return;
    
    try {
      const response = await fetch(`/api/portfolios/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setSavedPortfolios(prev => prev.filter(p => p.id !== id));
        if (activePortfolioId === id) {
          setActivePortfolioId(null);
          setPortfolioName('');
          setPortfolio([]);
        }
      }
    } catch (error) {
      console.error('Error deleting portfolio:', error);
    }
  };

  const MetricCard = ({ title, value, colorClass, tooltip, benchmarkValue, extraInfo, position = 'center' }: any) => {
    const valNum = parseFloat(value.replace(/[%$]/g,''));
    const benchNum = parseFloat(benchmarkValue.replace(/[%$]/g,''));
    const delta = valNum - benchNum;
    const isPositive = delta >= 0;
    
    let isBetter = false;
    if (title === 'Max Drawdown' || title === 'Volatility') {
        if (title === 'Volatility') {
             isBetter = valNum < benchNum;
        } else {
            isBetter = valNum > benchNum;
        }
    } else {
        isBetter = valNum > benchNum;
    }
    
    const tooltipPositionClass = position === 'left' 
      ? 'left-0 translate-x-0' 
      : position === 'right' 
        ? 'right-0 translate-x-0' 
        : 'left-1/2 -translate-x-1/2';
    
    const arrowPositionClass = position === 'left'
      ? 'left-6'
      : position === 'right'
        ? 'right-6'
        : 'left-1/2 -translate-x-1/2';
    
    return (
      <div className="group relative bg-white rounded-lg border border-slate-200 hover:shadow-md transition-all flex flex-col justify-between h-32">
        <div className={`invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 absolute z-50 bottom-full ${tooltipPositionClass} mb-2 w-64 bg-slate-800 text-white text-xs p-3 rounded-lg shadow-xl`}>
            {tooltip}
            <div className={`absolute top-full ${arrowPositionClass} border-4 border-transparent border-t-slate-800`}></div>
        </div>

        <div className="p-4 flex-1">
            <div className="flex justify-between items-start mb-1">
                <div className="text-[10px] text-slate-500 uppercase font-bold flex items-center tracking-wide cursor-help">
                    {title} <Info size={10} className="ml-1 text-slate-400" />
                </div>
            </div>
            
            <div className="flex items-baseline mt-1">
                <div className={`text-xl font-bold tracking-tight ${colorClass}`}>
                {value}
                </div>
                {extraInfo && <span className="ml-1.5 text-[10px] text-slate-400 font-medium">{extraInfo}</span>}
            </div>
        </div>
        
        <div className="bg-slate-50 px-2 py-2 border-t border-slate-100 rounded-b-lg">
            <div className="flex items-center justify-between">
                <div className="flex items-center">
                   <span className="bg-slate-200 rounded px-1 py-0.5 text-slate-600 text-[9px] font-medium mr-1">{benchmarkTicker}</span>
                   <span className="text-[11px] font-semibold text-slate-600">{benchmarkValue}</span>
                </div>
                <div className={`text-[9px] font-bold ${isBetter ? 'text-green-600' : 'text-red-500'} bg-white px-1 py-0.5 rounded shadow-sm border border-slate-100 whitespace-nowrap`}>
                    {isPositive && !title.includes('Drawdown') ? '+' : ''}{delta.toFixed(1)}{title.includes('Ratio') ? '' : '%'}
                </div>
            </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
      
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="h-16 flex items-center justify-between">
            <div className="flex items-center space-x-2 text-brand-600">
              <div className="bg-brand-50 p-1.5 rounded-lg border border-brand-100">
                  <TrendingUp size={24} strokeWidth={2.5} />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">Data Wealth Builder</h1>
            </div>
            
            <div className="flex items-center space-x-4">
               {activeTab === 'portfolio' && (
                 <div className="relative" ref={menuRef}>
                   <button 
                      onClick={() => setIsMenuOpen(!isMenuOpen)}
                      className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md hover:bg-slate-100 text-slate-600 font-medium transition-colors"
                   >
                       <FileText size={18} />
                       <span>Portfolio</span>
                   </button>
                   
                   {isMenuOpen && (
                       <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-xl border border-slate-200 py-1 z-50">
                           <button onClick={createNew} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center">
                               <Plus size={14} className="mr-2 text-slate-400" /> New Portfolio
                           </button>
                           <button onClick={() => { setShowLoadDialog(true); setIsMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center">
                               <FolderOpen size={14} className="mr-2 text-slate-400" /> Open...
                           </button>
                           <div className="h-px bg-slate-100 my-1" />
                           <button disabled={portfolio.length === 0} onClick={initiateSave} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center disabled:opacity-50">
                               <Save size={14} className="mr-2 text-slate-400" /> Save
                           </button>
                       </div>
                   )}
                 </div>
               )}
            </div>
          </div>
          
          <div className="flex space-x-1 -mb-px">
            <button
              onClick={() => setActiveTab('portfolio')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'portfolio'
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <PieChart size={16} />
              Portfolio
            </button>
            <button
              onClick={() => setActiveTab('themes')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'themes'
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Layers size={16} />
              Themes
            </button>
          </div>
        </div>
      </header>

      {showSaveDialog && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[60]">
              <div className="bg-white p-6 rounded-xl shadow-2xl w-96 border border-slate-100">
                  <h3 className="font-bold mb-4 text-lg">Save Portfolio</h3>
                  
                  {saveMode === 'OVERWRITE' ? (
                       <>
                        <p className="text-sm text-slate-700 mb-6">
                            You are editing <span className="font-bold">{portfolioName}</span>. How would you like to save?
                        </p>
                        <div className="flex justify-end space-x-2">
                             <button onClick={() => setShowSaveDialog(false)} className="px-3 py-1.5 text-slate-500 hover:bg-slate-100 rounded-lg text-sm">Cancel</button>
                             <button onClick={() => setSaveMode('NEW')} className="px-4 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 text-sm font-medium">Save as New...</button>
                             <button onClick={() => savePortfolio(false)} className="px-4 py-1.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium shadow-sm">Overwrite</button>
                        </div>
                       </>
                  ) : (
                      <>
                        <p className="text-xs text-slate-500 mb-2">Enter a name for your portfolio.</p>
                        <input 
                            autoFocus
                            className="w-full border border-slate-300 p-2 rounded-lg mb-6 focus:ring-2 focus:ring-brand-500 outline-none" 
                            placeholder="e.g. Retirement 2050"
                            value={portfolioName}
                            onChange={e => setPortfolioName(e.target.value)}
                        />
                        <div className="flex justify-end space-x-2">
                            <button onClick={() => setShowSaveDialog(false)} className="px-3 py-1.5 text-slate-500 hover:bg-slate-100 rounded-lg text-sm">Cancel</button>
                            <button onClick={() => savePortfolio(true)} className="px-4 py-1.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium shadow-sm">Save</button>
                        </div>
                      </>
                  )}
              </div>
          </div>
      )}

      {showLoadDialog && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[60]">
              <div className="bg-white p-6 rounded-xl shadow-2xl w-96 max-h-[500px] overflow-y-auto border border-slate-100">
                  <h3 className="font-bold mb-4 text-lg">Open Portfolio</h3>
                  {savedPortfolios.length === 0 ? (
                      <p className="text-sm text-slate-500 text-center py-4">No saved portfolios found.</p>
                  ) : (
                      <div className="space-y-2">
                          {savedPortfolios.map(p => (
                              <div key={p.id} className="p-3 border border-slate-200 rounded-lg hover:border-brand-500 hover:bg-brand-50 flex justify-between items-center group transition-all">
                                  <div className="cursor-pointer flex-1" onClick={() => loadPortfolio(p)}>
                                      <div className="font-medium text-slate-900">{p.name}</div>
                                      <div className="text-[10px] text-slate-400">{new Date(p.createdAt).toLocaleDateString()}</div>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <span className="text-xs text-slate-500 bg-white px-2 py-1 rounded border border-slate-100 group-hover:border-brand-200">{(p.assets || []).length} assets</span>
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); deletePortfolio(p.id); }}
                                      className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1 rounded transition-colors"
                                      title="Delete portfolio"
                                    >
                                      <X size={16} />
                                    </button>
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}
                  <div className="mt-6 flex justify-end">
                      <button onClick={() => setShowLoadDialog(false)} className="px-3 py-1.5 text-slate-500 hover:bg-slate-100 rounded-lg text-sm">Cancel</button>
                  </div>
              </div>
          </div>
      )}

      {showPhaseModal && selectedPhase && (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-[60]">
              <div className="bg-slate-900 p-6 rounded-xl shadow-2xl w-[500px] max-h-[600px] overflow-y-auto border border-slate-700">
                  <div className="flex items-center justify-between mb-4">
                      <div>
                          <h3 className="font-bold text-lg text-white">{ECONOMIC_PHASES[selectedPhase].name} Phase</h3>
                          <p className="text-xs text-slate-400">Economic Cycle</p>
                      </div>
                      <button onClick={() => setShowPhaseModal(false)} className="text-slate-400 hover:text-white p-1">
                          <X size={20} />
                      </button>
                  </div>
                  
                  <div className={`flex items-center space-x-3 p-3 rounded-lg mb-4 ${
                      selectedPhase === 'recovery' ? 'bg-green-500/10 border border-green-500/30' :
                      selectedPhase === 'expansion' ? 'bg-sky-500/10 border border-sky-500/30' :
                      selectedPhase === 'slowdown' ? 'bg-yellow-500/10 border border-yellow-500/30' :
                      'bg-red-500/10 border border-red-500/30'
                  }`}>
                      <div className="text-2xl">🇺🇸</div>
                      <p className={`text-sm font-medium ${
                          selectedPhase === 'recovery' ? 'text-green-400' :
                          selectedPhase === 'expansion' ? 'text-sky-400' :
                          selectedPhase === 'slowdown' ? 'text-yellow-400' :
                          'text-red-400'
                      }`}>
                          {currentEconomicPhase === selectedPhase ? (
                              <>USA has been in the <span className="underline">{ECONOMIC_PHASES[selectedPhase].name.toLowerCase()}</span> phase for {economicCycleDays} days.</>
                          ) : (
                              <>USA was last in the <span className="underline">{ECONOMIC_PHASES[selectedPhase].name.toLowerCase()}</span> phase from {ECONOMIC_PHASES[selectedPhase].lastPeriod}.</>
                          )}
                      </p>
                  </div>
                  
                  <div className="mb-4">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{ECONOMIC_PHASES[selectedPhase].name} may be a result of:</h4>
                      <div className="grid grid-cols-2 gap-2">
                          {ECONOMIC_PHASES[selectedPhase].causes.map((cause, i) => (
                              <div key={i} className="flex items-start space-x-2 text-slate-300 text-sm">
                                  <span className="text-slate-500 mt-1">•</span>
                                  <span>{cause}</span>
                              </div>
                          ))}
                      </div>
                  </div>
                  
                  <div className="mb-4">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Assets that tend to benefit the most during {ECONOMIC_PHASES[selectedPhase].name.toLowerCase()}:</h4>
                      <div className="flex flex-wrap gap-2">
                          {ECONOMIC_PHASES[selectedPhase].benefitMost.map((asset, i) => (
                              <span key={i} className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-medium">
                                  {asset}
                              </span>
                          ))}
                      </div>
                  </div>
                  
                  <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-2">Assets that tend to benefit the least:</h4>
                      <div className="flex flex-wrap gap-2">
                          {ECONOMIC_PHASES[selectedPhase].benefitLeast.map((asset, i) => (
                              <span key={i} className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs font-medium">
                                  {asset}
                              </span>
                          ))}
                      </div>
                  </div>
                  
                  <p className="text-slate-400 text-sm leading-relaxed">
                      {ECONOMIC_PHASES[selectedPhase].description}
                  </p>
              </div>
          </div>
      )}

      {showChat && (
        <div className="fixed bottom-4 right-4 w-96 h-[500px] bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col z-50 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-gradient-to-r from-brand-600 to-brand-700">
            <div className="flex items-center space-x-2 text-white">
              <MessageCircle size={20} />
              <span className="font-semibold">Portfolio Assistant</span>
            </div>
            <button onClick={() => setShowChat(false)} className="text-white/80 hover:text-white">
              <X size={20} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatMessages.length === 0 && (
              <div className="text-center text-slate-400 text-sm py-8">
                <MessageCircle size={32} className="mx-auto mb-2 opacity-50" />
                <p>Ask questions about your portfolio</p>
                <p className="text-xs mt-1">e.g., "What risks should I consider?"</p>
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-lg text-sm ${
                  msg.role === 'user' 
                    ? 'bg-brand-600 text-white rounded-br-sm' 
                    : 'bg-slate-100 text-slate-700 rounded-bl-sm'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isSendingChat && (
              <div className="flex justify-start">
                <div className="bg-slate-100 p-3 rounded-lg rounded-bl-sm">
                  <Activity size={16} className="animate-spin text-slate-400" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          
          <div className="p-4 border-t border-slate-200">
            <form onSubmit={(e) => { e.preventDefault(); handleSendChat(); }} className="flex space-x-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask about your portfolio..."
                className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                disabled={isSendingChat}
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || isSendingChat}
                className="bg-brand-600 text-white p-2 rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={18} />
              </button>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'themes' ? (
        <ThemesPage onSelectTheme={(theme) => {
          const stocks = theme.stocks;
          const equalWeight = Math.floor(100 / stocks.length);
          const remainder = 100 - (equalWeight * stocks.length);
          
          const newPortfolio = stocks.map((ticker, idx) => ({
            ticker,
            name: ticker,
            weight: equalWeight + (idx === 0 ? remainder : 0),
            assetClass: 'US Equity'
          }));
          
          setPortfolio(newPortfolio);
          setPortfolioName(theme.name);
          setActivePortfolioId(null);
          setBacktestResult(null);
          setAiAnalysis("");
          setActiveTab('portfolio');
        }} />
      ) : (
      <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        <div className="lg:col-span-4 space-y-6">
          
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center">
              Add Assets
            </h2>
            <form onSubmit={handleSearch} className="relative">
              <input
                type="text"
                placeholder="Ticker or ETF name..."
                className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-4 pr-12 py-3 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all placeholder-slate-400 text-slate-900"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button 
                type="submit"
                disabled={isSearching || !query}
                className="absolute right-2 top-2 p-1.5 bg-brand-600 rounded-md text-white hover:bg-brand-500 disabled:opacity-50 transition-colors"
              >
                {isSearching ? <Activity className="animate-spin w-5 h-5" /> : <Search className="w-5 h-5" />}
              </button>
            </form>

            {searchResults.length > 0 && (
              <div className="mt-4 space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                {searchResults.map((result) => (
                  <div key={result.ticker} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-200 cursor-pointer" onClick={() => addToPortfolio(result)}>
                    <div>
                      <div className="flex items-center space-x-2">
                          <span className="font-bold text-sm text-slate-900">{result.ticker}</span>
                          <span className="text-[10px] uppercase bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-medium">{result.assetClass}</span>
                      </div>
                      <div className="text-xs text-slate-500 truncate max-w-[180px]">{result.name}</div>
                    </div>
                    <button className="p-1 bg-brand-50 text-brand-600 rounded hover:bg-brand-100">
                      <Plus size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {savedPortfolios.filter(p => p.id !== activePortfolioId && !portfolio.some(item => item.ticker === `PORT_${p.id}`)).length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100 relative" ref={addPortfolioRef}>
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center">
                    <PieChart size={12} className="mr-1" /> Add Saved Portfolio
                  </h3>
                  <button 
                    onClick={() => setShowAddPortfolioDropdown(!showAddPortfolioDropdown)}
                    className="p-1.5 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors border border-purple-200"
                    title="Add a saved portfolio as an asset"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                
                {showAddPortfolioDropdown && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-xl border border-slate-200 py-1 z-50 max-h-60 overflow-y-auto">
                    {savedPortfolios
                      .filter(p => p.id !== activePortfolioId && !portfolio.some(item => item.ticker === `PORT_${p.id}`))
                      .map(saved => (
                        <div 
                          key={saved.id} 
                          className="px-3 py-2 hover:bg-purple-50 cursor-pointer flex justify-between items-center transition-colors"
                          onClick={() => { addSavedPortfolioAsAsset(saved); setShowAddPortfolioDropdown(false); }}
                        >
                          <div>
                            <div className="font-medium text-sm text-slate-900">{saved.name}</div>
                            <div className="text-[10px] text-slate-400">{(saved.assets || []).length} assets</div>
                          </div>
                          <Plus size={14} className="text-purple-500" />
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-6">
               <div>
                   <div className="flex items-center justify-between mb-2">
                       <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Benchmark</label>
                       <button onClick={handleAutoBenchmark} className="text-[10px] flex items-center text-brand-600 hover:text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-100 transition-colors">
                           <Wand2 size={10} className="mr-1" /> Auto-Suggest
                       </button>
                   </div>
                   <div className="flex space-x-2">
                       <select 
                           value={benchmarkTicker}
                           onChange={(e) => setBenchmarkTicker(e.target.value)}
                           className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-brand-500 focus:border-brand-500 block p-2.5"
                       >
                           <optgroup label="Market Indices">
                             {BENCHMARKS.map(b => <option key={b} value={b}>{b}</option>)}
                           </optgroup>
                           {savedPortfolios.length > 0 && (
                             <optgroup label="Saved Portfolios">
                               {savedPortfolios.map(p => (
                                 <option key={`PORT_${p.id}`} value={`PORT_${p.id}`}>{p.name}</option>
                               ))}
                             </optgroup>
                           )}
                       </select>
                   </div>
               </div>

               <div className="pt-4 border-t border-slate-100">
                   <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowDcaSettings(!showDcaSettings)}>
                       <div className="flex items-center space-x-2">
                           <Coins className="text-brand-500 w-5 h-5" />
                           <span className="font-medium text-slate-700 text-sm">Recurring Investment</span>
                       </div>
                       <div className={`w-10 h-5 bg-slate-200 rounded-full relative transition-colors ${dcaConfig.enabled ? 'bg-brand-500' : ''}`} onClick={(e) => {
                           e.stopPropagation();
                           setDcaConfig({...dcaConfig, enabled: !dcaConfig.enabled});
                       }}>
                           <div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-all ${dcaConfig.enabled ? 'left-6' : 'left-1'}`}></div>
                       </div>
                   </div>

                   {(showDcaSettings || dcaConfig.enabled) && (
                       <div className="mt-4 space-y-3 pl-2 border-l-2 border-slate-100 ml-2">
                           <div>
                               <label className="block text-xs text-slate-500 mb-1">Amount ($)</label>
                               <input 
                                   type="number" 
                                   value={dcaConfig.amount} 
                                   onChange={(e) => setDcaConfig({...dcaConfig, amount: Number(e.target.value)})}
                                   className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-sm" 
                               />
                           </div>
                           <div>
                               <label className="block text-xs text-slate-500 mb-1">Frequency</label>
                               <select 
                                   value={dcaConfig.frequency}
                                   onChange={(e) => setDcaConfig({...dcaConfig, frequency: e.target.value as any})}
                                   className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-sm"
                               >
                                   <option value="WEEKLY">Weekly</option>
                                   <option value="BI_WEEKLY">Bi-Weekly</option>
                                   <option value="MONTHLY">Monthly</option>
                                   <option value="QUARTERLY">Quarterly</option>
                                   <option value="ANNUALLY">Annually</option>
                               </select>
                           </div>
                       </div>
                   )}
               </div>

               <div className="pt-4 border-t border-slate-100">
                   <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowRebalanceSettings(!showRebalanceSettings)}>
                       <div className="flex items-center space-x-2">
                           <Scale className="text-purple-500 w-5 h-5" />
                           <span className="font-medium text-slate-700 text-sm">Rebalancing</span>
                       </div>
                       <div className={`w-10 h-5 bg-slate-200 rounded-full relative transition-colors ${rebalanceConfig.enabled ? 'bg-purple-500' : ''}`} onClick={(e) => {
                           e.stopPropagation();
                           setRebalanceConfig({...rebalanceConfig, enabled: !rebalanceConfig.enabled});
                       }}>
                           <div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-all ${rebalanceConfig.enabled ? 'left-6' : 'left-1'}`}></div>
                       </div>
                   </div>

                   {(showRebalanceSettings || rebalanceConfig.enabled) && (
                       <div className="mt-4 space-y-3 pl-2 border-l-2 border-purple-100 ml-2">
                           <div>
                               <label className="block text-xs text-slate-500 mb-1">Rebalance Frequency</label>
                               <select 
                                   value={rebalanceConfig.frequency}
                                   onChange={(e) => setRebalanceConfig({...rebalanceConfig, frequency: e.target.value as RebalanceFrequency})}
                                   className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-sm"
                               >
                                   <option value="MONTHLY">Monthly</option>
                                   <option value="QUARTERLY">Quarterly</option>
                                   <option value="SEMI_ANNUALLY">Semi-Annually</option>
                                   <option value="ANNUALLY">Annually</option>
                               </select>
                           </div>
                           <p className="text-[10px] text-slate-400">
                               Automatically rebalance your portfolio back to target allocations at the selected interval.
                           </p>
                       </div>
                   )}
               </div>
          </section>

          <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
             <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center">
                Allocation
              </h2>
              {portfolio.length > 0 && (
                 <button onClick={handleAutoBalance} className="text-xs text-slate-500 hover:text-brand-600 flex items-center transition-colors" title="Reset to Equal Weight">
                   <RefreshCw size={12} className="mr-1" /> Reset
                 </button>
              )}
            </div>

            <div className="space-y-1 mb-6">
              {portfolio.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm italic bg-slate-50 rounded-lg border border-dashed border-slate-200">
                  Portfolio is empty.
                </div>
              ) : (
                portfolio.map(item => (
                  <AssetCard 
                    key={item.ticker} 
                    item={item} 
                    returnVal={backtestResult?.assetReturns[item.ticker]}
                    onUpdateWeight={updateWeight} 
                    onRemove={removeAsset}
                  />
                ))
              )}
            </div>

            {portfolio.length > 0 && (
                <>
                    <div className="flex items-center justify-between pt-4 border-t border-slate-100 mb-6">
                    <span className="text-sm font-medium text-slate-500">Total Weight</span>
                    <span className={`text-lg font-bold ${isValidPortfolio ? 'text-slate-900' : 'text-red-500'}`}>
                        {Math.round(totalWeight)}%
                    </span>
                    </div>
                    <AllocationChart items={portfolio} />
                </>
            )}

          </section>

          <section className="bg-slate-900 rounded-xl border border-slate-700 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                    <h3 className="text-white text-xs font-bold uppercase tracking-wider">Economic Cycle</h3>
                    {economicCycleSource === 'live' && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-green-500/20 text-green-400">
                          LIVE
                      </span>
                    )}
                    <div className="group relative">
                        <Info size={12} className="text-slate-400 cursor-help" />
                        <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-slate-700 text-white text-xs p-3 rounded-lg shadow-xl">
                            {economicCycleSource === 'live' 
                              ? 'Economic cycle determined using real-time FRED indicators (GDP, unemployment, leading indicators).'
                              : 'Add a FRED API key in Secrets to enable live economic data updates.'}
                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-700"></div>
                        </div>
                    </div>
                </div>
            </div>
            
            {economicCycleSource === 'unavailable' || !currentEconomicPhase ? (
              <div className="text-center py-6">
                <div className="text-slate-400 text-sm mb-2">Economic cycle data unavailable</div>
                <div className="text-slate-500 text-xs">Add FRED_API_KEY in Secrets to enable live data</div>
              </div>
            ) : (
            <>
            
            <div className="flex items-end justify-center h-16 mb-2">
                <svg viewBox="0 0 400 70" className="w-full h-14">
                    <defs>
                        <linearGradient id="cycleGradientLeft" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
                            <stop offset="25%" stopColor="#0ea5e9" stopOpacity="0.3" />
                            <stop offset="50%" stopColor="#eab308" stopOpacity="0.3" />
                            <stop offset="75%" stopColor="#ef4444" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="#22c55e" stopOpacity="0.3" />
                        </linearGradient>
                    </defs>
                    <path 
                        d="M 0 55 Q 50 55 100 25 Q 150 0 200 25 Q 250 55 300 55 Q 350 55 400 35" 
                        fill="none" 
                        stroke="url(#cycleGradientLeft)" 
                        strokeWidth="3"
                    />
                    <path 
                        d="M 0 55 Q 50 55 100 25 Q 150 0 200 25 Q 250 55 300 55 Q 350 55 400 35" 
                        fill="none" 
                        stroke="white" 
                        strokeWidth="2"
                        strokeOpacity="0.5"
                    />
                    {currentEconomicPhase === 'recovery' && (
                        <circle cx="50" cy="45" r="7" fill="#22c55e" stroke="white" strokeWidth="2" />
                    )}
                    {currentEconomicPhase === 'expansion' && (
                        <circle cx="150" cy="12" r="7" fill="#0ea5e9" stroke="white" strokeWidth="2" />
                    )}
                    {currentEconomicPhase === 'slowdown' && (
                        <circle cx="250" cy="45" r="7" fill="#eab308" stroke="white" strokeWidth="2" />
                    )}
                    {currentEconomicPhase === 'recession' && (
                        <circle cx="350" cy="50" r="7" fill="#ef4444" stroke="white" strokeWidth="2" />
                    )}
                </svg>
            </div>
            
            <div className="grid grid-cols-4 gap-1 text-center">
                {(['recovery', 'expansion', 'slowdown', 'recession'] as EconomicPhase[]).map((phase) => (
                    <button
                        key={phase}
                        onClick={() => { setSelectedPhase(phase); setShowPhaseModal(true); }}
                        className={`py-1.5 px-1 rounded-lg text-[10px] font-medium transition-all ${
                            currentEconomicPhase === phase 
                                ? phase === 'recovery' ? 'bg-green-500/20 text-green-400 ring-1 ring-green-500'
                                : phase === 'expansion' ? 'bg-sky-500/20 text-sky-400 ring-1 ring-sky-500'
                                : phase === 'slowdown' ? 'bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500'
                                : 'bg-red-500/20 text-red-400 ring-1 ring-red-500'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                    >
                        {ECONOMIC_PHASES[phase].name}
                    </button>
                ))}
            </div>
            
            {currentEconomicPhase && (
            <button 
                onClick={() => { setSelectedPhase(currentEconomicPhase); setShowPhaseModal(true); }}
                className="mt-3 w-full text-xs text-brand-400 hover:text-brand-300 flex items-center justify-center"
            >
                Learn about {ECONOMIC_PHASES[currentEconomicPhase].name} <ChevronDown size={14} className="ml-1 rotate-[-90deg]" />
            </button>
            )}
            </>
            )}
          </section>
        </div>

        <div className="lg:col-span-8 space-y-6">
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 min-h-[600px] flex flex-col relative overflow-hidden">
            
            <div className="flex items-center justify-between mb-6 z-10">
                <div className="flex items-center">
                    <div className="p-2 bg-brand-50 text-brand-600 rounded-lg mr-3">
                        <Activity className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">Performance Analysis</h2>
                        <p className="text-xs text-slate-500">
                            {dcaConfig.enabled ? `DCA: $${dcaConfig.amount} / ${dcaConfig.frequency.toLowerCase()}` : `Initial Capital: $10,000`} vs {benchmarkTicker}
                            {backtestResult && (
                              <>
                                <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium ${backtestResult.dataSource === 'real' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                  {backtestResult.dataSource === 'real' ? 'Real Data' : 'Simulated'}
                                </span>
                                <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700">
                                  {returnType === 'total' ? 'Total Return' : 'Price Only'}
                                </span>
                              </>
                            )}
                        </p>
                    </div>
                </div>
                
                <div className="flex flex-col items-end space-y-2">
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        {TIMEFRAMES.map(t => (
                            <button 
                                key={t.label}
                                onClick={() => {
                                  if (t.ytd) {
                                    setIsYtd(true);
                                    setMonths(0);
                                  } else {
                                    setIsYtd(false);
                                    setMonths(t.months);
                                  }
                                }}
                                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${(t.ytd && isYtd) || (!t.ytd && !isYtd && months === t.months) ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center space-x-2">
                        <span className={`text-[10px] font-medium ${returnType === 'price' ? 'text-slate-900' : 'text-slate-400'}`}>Price</span>
                        <button 
                            onClick={() => setReturnType(returnType === 'total' ? 'price' : 'total')}
                            className={`w-9 h-5 rounded-full relative transition-colors ${returnType === 'total' ? 'bg-brand-500' : 'bg-slate-300'}`}
                            title={returnType === 'total' ? 'Total Return (includes dividends)' : 'Price Return (excludes dividends)'}
                        >
                            <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] transition-all shadow-sm ${returnType === 'total' ? 'right-1' : 'left-1'}`}></div>
                        </button>
                        <span className={`text-[10px] font-medium ${returnType === 'total' ? 'text-slate-900' : 'text-slate-400'}`}>Total</span>
                    </div>
                </div>
            </div>
            
            <div className="flex-1 mb-8 z-10 min-h-[300px]">
               {isBacktesting ? (
                 <div className="h-96 flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-lg border border-slate-200">
                   <Activity className="w-8 h-8 animate-spin mb-3 text-brand-500" />
                   <p className="text-sm font-medium">Loading real market data...</p>
                   <p className="text-xs opacity-70">Fetching historical prices from Yahoo Finance</p>
                 </div>
               ) : backtestError ? (
                 <div className="h-96 flex flex-col items-center justify-center text-red-500 bg-red-50 rounded-lg border border-red-200">
                   <p className="text-sm font-medium mb-2">Unable to load market data</p>
                   <p className="text-xs text-red-400 max-w-md text-center">{backtestError}</p>
                 </div>
               ) : (
                 <BacktestChart result={backtestResult} />
               )}
            </div>

            {backtestResult && (
              <div className="grid grid-cols-5 gap-3 mb-6 z-10">
                <MetricCard 
                    title="Total Return" 
                    value={`${(backtestResult.metrics.totalReturn * 100).toFixed(2)}%`} 
                    colorClass={backtestResult.metrics.totalReturn >= 0 ? "text-green-600" : "text-red-600"}
                    tooltip={`Your portfolio ${backtestResult.metrics.totalReturn >= 0 ? 'grew' : 'lost'} ${Math.abs(backtestResult.metrics.totalReturn * 100).toFixed(2)}% over this period. If you invested $10,000, you would now have $${backtestResult.metrics.finalBalance.toLocaleString(undefined, {maximumFractionDigits: 0})}. This is your total profit or loss before accounting for inflation or taxes.`}
                    benchmarkValue={`${(backtestResult.benchmarkMetrics.totalReturn * 100).toFixed(2)}%`}
                    position="left"
                />
                <MetricCard 
                    title="CAGR" 
                    value={`${(backtestResult.metrics.cagr * 100).toFixed(2)}%`} 
                    colorClass="text-slate-900"
                    tooltip={`Your portfolio grew at an average rate of ${(backtestResult.metrics.cagr * 100).toFixed(2)}% per year. Think of it like a savings account interest rate that would give you the same final result. This smooths out the ups and downs to show a steady yearly growth rate.`}
                    benchmarkValue={`${(backtestResult.benchmarkMetrics.cagr * 100).toFixed(2)}%`}
                />
                <MetricCard 
                    title="Max Drawdown" 
                    value={`-${Math.abs(backtestResult.metrics.maxDrawdown * 100).toFixed(2)}%`} 
                    colorClass="text-red-500"
                    extraInfo={backtestResult.metrics.maxDrawdownDays ? `(${backtestResult.metrics.maxDrawdownDays}d)` : ''}
                    tooltip={`At its worst point, your portfolio dropped ${Math.abs(backtestResult.metrics.maxDrawdown * 100).toFixed(2)}% from its highest value. This decline lasted ${backtestResult.metrics.maxDrawdownDays || 0} trading days before recovering. If you had $10,000 at the peak, it would have fallen to about $${(10000 * (1 - backtestResult.metrics.maxDrawdown)).toLocaleString(undefined, {maximumFractionDigits: 0})} at the bottom.`}
                    benchmarkValue={`-${Math.abs(backtestResult.benchmarkMetrics.maxDrawdown * 100).toFixed(2)}%`}
                />
                <MetricCard 
                    title="Sharpe Ratio" 
                    value={`${backtestResult.metrics.sharpeRatio.toFixed(2)}`} 
                    colorClass="text-brand-600"
                    tooltip={`Your Sharpe Ratio of ${backtestResult.metrics.sharpeRatio.toFixed(2)} measures how much return you're getting for the risk you're taking. ${backtestResult.metrics.sharpeRatio >= 1 ? 'A ratio above 1.0 is considered good - your returns are worth the volatility.' : backtestResult.metrics.sharpeRatio >= 0.5 ? 'A ratio between 0.5 and 1.0 is acceptable but not great.' : 'A ratio below 0.5 suggests the returns may not justify the risk.'} Higher is better.`}
                    benchmarkValue={`${backtestResult.benchmarkMetrics.sharpeRatio.toFixed(2)}`}
                />
                 <MetricCard 
                    title="Volatility" 
                    value={`${(backtestResult.metrics.volatility * 100).toFixed(2)}%`} 
                    colorClass="text-slate-700"
                    tooltip={`Your portfolio's value typically swings up or down by about ${(backtestResult.metrics.volatility * 100).toFixed(2)}% per year. ${backtestResult.metrics.volatility < 0.10 ? 'This is relatively stable - expect a fairly smooth ride.' : backtestResult.metrics.volatility < 0.20 ? 'This is moderate volatility - expect some ups and downs.' : 'This is high volatility - expect significant price swings that may be stressful to watch.'} Lower volatility means more predictable, steadier returns.`}
                    benchmarkValue={`${(backtestResult.benchmarkMetrics.volatility * 100).toFixed(2)}%`}
                    position="right"
                />
              </div>
            )}

            {backtestResult && backtestResult.correlationMatrix && (
                <div className="bg-white rounded-lg border border-slate-100 p-4 mb-6 z-10">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Correlation Matrix</h3>
                    <CorrelationMatrix matrix={backtestResult.correlationMatrix} />
                </div>
            )}

            <div className="bg-gradient-to-r from-brand-50 to-white border border-brand-100 rounded-xl p-5 z-10 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Sparkles size={64} className="text-brand-600" />
              </div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-brand-700 text-xs font-bold uppercase flex items-center tracking-wide">
                  <span className="w-1.5 h-1.5 bg-brand-500 rounded-full mr-2"></span>
                  AI Portfolio Insights
                </h3>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleGenerateInsight}
                    disabled={!isValidPortfolio || isGeneratingInsight}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-brand-600 text-white text-xs font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isGeneratingInsight ? (
                      <>
                        <Activity size={14} className="animate-spin" />
                        <span>Generating...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} />
                        <span>Generate Insight</span>
                      </>
                    )}
                  </button>
                  {aiAnalysis && (
                    <button
                      onClick={() => setShowChat(true)}
                      className="flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-brand-200 text-brand-700 text-xs font-medium rounded-lg hover:bg-brand-50 transition-colors"
                    >
                      <MessageCircle size={14} />
                      <span>Ask Questions</span>
                    </button>
                  )}
                </div>
              </div>
              
              {aiAnalysis ? (
                <p className="text-slate-700 text-sm leading-relaxed relative z-10 whitespace-pre-wrap">
                  {aiAnalysis}
                </p>
              ) : (
                <p className="text-slate-400 text-sm italic">
                  {isValidPortfolio 
                    ? "Click 'Generate Insight' to get AI-powered analysis of your portfolio."
                    : "Build a valid portfolio (weights must equal 100%) to generate insights."}
                </p>
              )}
            </div>
            
            {!isValidPortfolio && (
               <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-20 flex flex-col items-center justify-center text-slate-400 p-8">
                 <div className="p-4 bg-white rounded-full shadow-xl mb-4 text-brand-500">
                     <PieChart size={40} strokeWidth={1.5} />
                 </div>
                 <h3 className="text-lg font-bold text-slate-800 mb-2">Build Your Portfolio</h3>
                 <p className="text-center max-w-sm text-slate-500 text-sm">
                    Search for assets on the left and assign weights to reach 100% allocation.
                 </p>
               </div>
            )}
          </section>
        </div>
      </main>
      )}
    </div>
  );
};

export default App;

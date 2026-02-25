import React, { useState, useMemo, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight, TrendingUp, Building2, Cpu, Heart, Zap, Globe, Shield, Leaf, Car, Plane, ShoppingBag, Smartphone, Factory, Coins, Briefcase, ArrowLeft, Activity, Plus, Info } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface Theme {
  id: string;
  name: string;
  companies: number;
  description: string;
  icon: React.ReactNode;
  stocks: string[];
}

interface StockData {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  evidence: string;
  sparklineData: number[];
}

interface ThemePerformance {
  dates: string[];
  values: number[];
  totalReturn: number;
  changePercent: number;
}

const THEMES_DATA: Theme[] = [
  { id: '3d-printing', name: '3D Printing & Additive Manufacturing', companies: 12, description: 'Companies developing 3D printing technology and materials for manufacturing innovation', icon: <Factory size={20} />, stocks: ['DDD', 'SSYS', 'XONE', 'MTLS', 'NNDM', 'MKFG'] },
  { id: '5g', name: '5G Infrastructure', companies: 18, description: 'Companies building 5G networks and equipment for next-generation connectivity', icon: <Smartphone size={20} />, stocks: ['QCOM', 'ERIC', 'NOK', 'KEYS', 'VIAV', 'COMM'] },
  { id: 'accelerated-computing', name: 'Accelerated Computing', companies: 15, description: 'GPU and specialized computing hardware powering AI and high-performance workloads', icon: <Cpu size={20} />, stocks: ['NVDA', 'AMD', 'INTC', 'MRVL', 'AVGO', 'QCOM'] },
  { id: 'advertising', name: 'Advertising', companies: 22, description: 'Digital and traditional advertising platforms driving modern marketing', icon: <TrendingUp size={20} />, stocks: ['GOOGL', 'META', 'TTD', 'MGNI', 'DV', 'PUBM'] },
  { id: 'aerospace-defense', name: 'Aerospace & Defense', companies: 28, description: 'Defense contractors and aerospace manufacturers supporting national security', icon: <Plane size={20} />, stocks: ['LMT', 'RTX', 'NOC', 'BA', 'GD', 'LHX'] },
  { id: 'ai-ml', name: 'Artificial Intelligence & Machine Learning', companies: 45, description: 'Companies at the forefront of AI development, creating intelligent systems that learn and adapt', icon: <Cpu size={20} />, stocks: ['NVDA', 'GOOGL', 'MSFT', 'META', 'PLTR', 'CRM', 'SNOW', 'AI'] },
  { id: 'banking', name: 'Banking Services', companies: 35, description: 'Traditional and digital banking institutions providing financial services', icon: <Building2 size={20} />, stocks: ['JPM', 'BAC', 'WFC', 'C', 'GS', 'MS'] },
  { id: 'banking-tech', name: 'Banking Technology', companies: 20, description: 'Fintech solutions modernizing banking operations', icon: <Coins size={20} />, stocks: ['SQ', 'PYPL', 'FIS', 'FISV', 'GPN', 'JKHY'] },
  { id: 'biotech', name: 'Biotechnology', companies: 52, description: 'Drug development and biotech research advancing human health', icon: <Heart size={20} />, stocks: ['AMGN', 'GILD', 'BIIB', 'REGN', 'VRTX', 'MRNA'] },
  { id: 'capital-markets', name: 'Capital Markets', companies: 25, description: 'Investment banks and trading platforms facilitating capital formation', icon: <TrendingUp size={20} />, stocks: ['GS', 'MS', 'SCHW', 'IBKR', 'RJF', 'SF'] },
  { id: 'car-rental', name: 'Car Rental Integration', companies: 8, description: 'Vehicle rental and mobility services transforming transportation', icon: <Car size={20} />, stocks: ['CAR', 'HTZ', 'UBER', 'LYFT'] },
  { id: 'clean-energy', name: 'Clean Energy', companies: 38, description: 'Renewable energy and clean technology driving sustainable power generation', icon: <Leaf size={20} />, stocks: ['ENPH', 'SEDG', 'FSLR', 'RUN', 'NEE', 'CSIQ'] },
  { id: 'cloud-computing', name: 'Cloud Computing', companies: 30, description: 'Cloud infrastructure and services enabling digital transformation', icon: <Globe size={20} />, stocks: ['AMZN', 'MSFT', 'GOOGL', 'CRM', 'NOW', 'SNOW'] },
  { id: 'cybersecurity', name: 'Cybersecurity', companies: 28, description: 'Security software and services protecting digital assets and privacy', icon: <Shield size={20} />, stocks: ['CRWD', 'PANW', 'ZS', 'FTNT', 'OKTA', 'S'] },
  { id: 'digital-health', name: 'Digital Health Engagement', companies: 34, description: 'Healthcare technology and telemedicine improving patient outcomes', icon: <Heart size={20} />, stocks: ['TDOC', 'VEEV', 'DXCM', 'HIMS', 'DOCS', 'TALK'] },
  { id: 'ecommerce', name: 'E-Commerce', companies: 42, description: 'Online retail and marketplace platforms revolutionizing shopping', icon: <ShoppingBag size={20} />, stocks: ['AMZN', 'SHOP', 'EBAY', 'ETSY', 'MELI', 'W'] },
  { id: 'electric-vehicles', name: 'Electric Vehicles', companies: 25, description: 'EV manufacturers and suppliers driving transportation electrification', icon: <Car size={20} />, stocks: ['TSLA', 'RIVN', 'LCID', 'NIO', 'LI', 'XPEV'] },
  { id: 'energy-storage', name: 'Energy Storage', companies: 15, description: 'Battery technology and storage solutions enabling renewable energy', icon: <Zap size={20} />, stocks: ['ENPH', 'GNRC', 'FLUX', 'QS', 'BE', 'STEM'] },
  { id: 'fintech', name: 'Financial Technology', companies: 48, description: 'Innovative financial services disrupting traditional banking', icon: <Coins size={20} />, stocks: ['SQ', 'PYPL', 'AFRM', 'SOFI', 'COIN', 'HOOD'] },
  { id: 'financial-marketplaces', name: 'Financial Marketplaces', companies: 40, description: 'Lending and financial comparison platforms connecting borrowers and lenders', icon: <Building2 size={20} />, stocks: ['TREE', 'LC', 'UPST', 'OPEN', 'RDFN', 'ZG'] },
  { id: 'gaming', name: 'Gaming & Esports', companies: 22, description: 'Video game publishers and esports platforms entertaining billions', icon: <Smartphone size={20} />, stocks: ['EA', 'ATVI', 'TTWO', 'RBLX', 'U', 'NTES'] },
  { id: 'genomics', name: 'Genomics', companies: 18, description: 'Gene sequencing and therapy advancing personalized medicine', icon: <Heart size={20} />, stocks: ['ILMN', 'CRSP', 'NTLA', 'BEAM', 'EDIT', 'PACB'] },
  { id: 'healthcare-services', name: 'Healthcare Services', companies: 32, description: 'Healthcare providers and services improving patient care', icon: <Heart size={20} />, stocks: ['UNH', 'CVS', 'HCA', 'HUM', 'CI', 'ELV'] },
  { id: 'industrial-automation', name: 'Industrial Automation', companies: 20, description: 'Robotics and automation systems transforming manufacturing', icon: <Factory size={20} />, stocks: ['ROK', 'EMR', 'ABB', 'FANUY', 'HON', 'ETN'] },
  { id: 'infrastructure', name: 'Infrastructure', companies: 28, description: 'Construction and infrastructure development building the future', icon: <Building2 size={20} />, stocks: ['CAT', 'DE', 'VMC', 'MLM', 'PWR', 'BLDR'] },
  { id: 'insurance-tech', name: 'Insurance Technology', companies: 15, description: 'Insurtech and digital insurance modernizing risk management', icon: <Shield size={20} />, stocks: ['LMND', 'ROOT', 'OSCR', 'HIPO', 'INSR', 'ACHR'] },
  { id: 'luxury-goods', name: 'Luxury Goods', companies: 18, description: 'Premium consumer brands delivering exceptional experiences', icon: <ShoppingBag size={20} />, stocks: ['LVMUY', 'RMS.PA', 'TIF', 'TPR', 'CPRI', 'RL'] },
  { id: 'metaverse', name: 'Metaverse', companies: 20, description: 'Virtual worlds and immersive technology creating new digital experiences', icon: <Globe size={20} />, stocks: ['META', 'RBLX', 'U', 'SNAP', 'MTTR', 'PTON'] },
  { id: 'online-travel', name: 'Online Travel', companies: 12, description: 'Travel booking and hospitality tech simplifying trip planning', icon: <Plane size={20} />, stocks: ['BKNG', 'ABNB', 'EXPE', 'TRIP', 'TCOM', 'MMYT'] },
  { id: 'payments', name: 'Payments Processing', companies: 25, description: 'Payment networks and processors enabling global commerce', icon: <Coins size={20} />, stocks: ['V', 'MA', 'PYPL', 'SQ', 'ADYEN', 'GPN'] },
  { id: 'private-equity', name: 'Private Equity', companies: 15, description: 'Alternative asset managers driving value creation', icon: <Briefcase size={20} />, stocks: ['BX', 'KKR', 'APO', 'CG', 'ARES', 'TPG'] },
  { id: 'quantum-computing', name: 'Quantum Computing', companies: 17, description: 'Next-generation computing technology solving impossible problems', icon: <Cpu size={20} />, stocks: ['IBM', 'GOOGL', 'IONQ', 'RGTI', 'QUBT', 'ARQQ'] },
  { id: 'real-estate-tech', name: 'Real Estate Technology', companies: 18, description: 'PropTech and real estate platforms transforming property transactions', icon: <Building2 size={20} />, stocks: ['ZG', 'RDFN', 'OPEN', 'COMP', 'EXPI', 'RMAX'] },
  { id: 'robotics', name: 'Robotics', companies: 16, description: 'Robot manufacturers and automation advancing manufacturing', icon: <Factory size={20} />, stocks: ['ISRG', 'ROK', 'TER', 'IRBT', 'PATH', 'BRKS'] },
  { id: 'saas', name: 'Software as a Service', companies: 55, description: 'Cloud-based software providers delivering enterprise solutions', icon: <Globe size={20} />, stocks: ['CRM', 'NOW', 'WDAY', 'ZM', 'DDOG', 'MDB'] },
  { id: 'semiconductors', name: 'Semiconductors', companies: 35, description: 'Chip designers and manufacturers powering the digital world', icon: <Cpu size={20} />, stocks: ['NVDA', 'AMD', 'INTC', 'TSM', 'ASML', 'AVGO'] },
  { id: 'social-media', name: 'Social Media', companies: 12, description: 'Social networking platforms connecting billions worldwide', icon: <Smartphone size={20} />, stocks: ['META', 'SNAP', 'PINS', 'RDDT', 'TWTR', 'DJT'] },
  { id: 'space', name: 'Space Economy', companies: 14, description: 'Satellite and space technology opening new frontiers', icon: <Globe size={20} />, stocks: ['SPCE', 'RKLB', 'ASTS', 'BKSY', 'LUNR', 'PL'] },
  { id: 'streaming', name: 'Streaming Services', companies: 15, description: 'Video and audio streaming platforms transforming entertainment', icon: <Smartphone size={20} />, stocks: ['NFLX', 'DIS', 'SPOT', 'WBD', 'PARA', 'ROKU'] },
  { id: 'supply-chain', name: 'Supply Chain & Logistics', companies: 22, description: 'Logistics and supply chain tech optimizing global trade', icon: <Factory size={20} />, stocks: ['FDX', 'UPS', 'XPO', 'CHRW', 'EXPD', 'JBHT'] },
  { id: 'telehealth', name: 'Telehealth', companies: 12, description: 'Remote healthcare services expanding access to medical care', icon: <Heart size={20} />, stocks: ['TDOC', 'AMWL', 'HIMS', 'DOCS', 'ACCD', 'TALK'] },
  { id: 'utilities', name: 'Utilities', companies: 30, description: 'Electric and gas utilities providing essential services', icon: <Zap size={20} />, stocks: ['NEE', 'DUK', 'SO', 'D', 'AEP', 'XEL'] },
  { id: 'water', name: 'Water Technology', companies: 14, description: 'Water treatment and infrastructure ensuring clean water access', icon: <Leaf size={20} />, stocks: ['XYL', 'WTS', 'AWK', 'ECL', 'FBIN', 'PNR'] },
];

const FEATURED_THEMES = [
  { id: 'financial-marketplaces', name: 'Financial Marketplaces', companies: 40, image: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&q=80' },
  { id: 'quantum-computing', name: 'Quantum Computing', companies: 17, image: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400&q=80' },
  { id: 'digital-health', name: 'Digital Health Engagement', companies: 34, image: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1f?w=400&q=80' },
  { id: 'ai-ml', name: 'Artificial Intelligence', companies: 45, image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400&q=80' },
  { id: 'clean-energy', name: 'Clean Energy', companies: 38, image: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=400&q=80' },
  { id: 'electric-vehicles', name: 'Electric Vehicles', companies: 25, image: 'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?w=400&q=80' },
];

const STOCK_EVIDENCE: Record<string, string> = {
  'NVDA': 'Drives the artificial intelligence industry by providing the foundational hardware and software platforms, including powerful GPUs, essential for AI development and deployment.',
  'GOOGL': 'Develops and integrates advanced artificial intelligence technologies across its extensive product and service portfolio, driving innovation in areas such as search, cloud computing, and autonomous vehicles.',
  'MSFT': 'Leverages and integrates advanced artificial intelligence across its cloud services, productivity tools, and development platforms, driving innovation and enhancing user experiences.',
  'META': 'Develops and integrates advanced artificial intelligence across its platforms and products to enhance user experiences, power content recommendations, and drive advertising effectiveness.',
  'PLTR': 'Provides AI-powered data analytics platforms that help organizations make complex decisions by integrating and analyzing vast amounts of disparate data sources.',
  'TSLA': 'Pioneers electric vehicle manufacturing and autonomous driving technology, revolutionizing the automotive industry with innovative battery and software solutions.',
  'AMZN': 'Dominates e-commerce and cloud computing while investing heavily in AI, robotics, and logistics infrastructure to enhance customer experience.',
  'AAPL': 'Creates premium consumer electronics and services, integrating advanced AI features across its ecosystem of devices and software platforms.',
  'CRM': 'Leads enterprise cloud software with AI-powered customer relationship management solutions that help businesses connect with their customers.',
  'AMD': 'Designs high-performance computing and graphics processors that compete directly with industry leaders, powering everything from gaming to data centers.',
};

interface ThemesPageProps {
  onSelectTheme?: (theme: Theme) => void;
}

export default function ThemesPage({ onSelectTheme }: ThemesPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLetter, setSelectedLetter] = useState<string | null>('All');
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [selectedTheme, setSelectedTheme] = useState<Theme | null>(null);
  const [stocksData, setStocksData] = useState<Record<string, StockData>>({});
  const [themePerformance, setThemePerformance] = useState<ThemePerformance | null>(null);
  const [isLoadingStocks, setIsLoadingStocks] = useState(false);
  const [performanceTimeframe, setPerformanceTimeframe] = useState<'1M' | '3M' | '6M' | '1Y'>('1M');

  const alphabet = ['All', '0-9', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];

  const filteredThemes = useMemo(() => {
    let themes = THEMES_DATA;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      themes = themes.filter(t => 
        t.name.toLowerCase().includes(query) || 
        t.description.toLowerCase().includes(query) ||
        t.stocks.some(s => s.toLowerCase().includes(query))
      );
    }
    
    if (selectedLetter && selectedLetter !== 'All') {
      if (selectedLetter === '0-9') {
        themes = themes.filter(t => /^[0-9]/.test(t.name));
      } else {
        themes = themes.filter(t => t.name.toUpperCase().startsWith(selectedLetter));
      }
    }
    
    return themes.sort((a, b) => a.name.localeCompare(b.name));
  }, [searchQuery, selectedLetter]);

  const groupedThemes = useMemo(() => {
    const groups: Record<string, Theme[]> = {};
    filteredThemes.forEach(theme => {
      const firstChar = theme.name[0].toUpperCase();
      const key = /[0-9]/.test(firstChar) ? '0-9' : firstChar;
      if (!groups[key]) groups[key] = [];
      groups[key].push(theme);
    });
    return groups;
  }, [filteredThemes]);

  useEffect(() => {
    if (!selectedTheme) return;
    
    const fetchStockData = async () => {
      setIsLoadingStocks(true);
      const data: Record<string, StockData> = {};
      
      const months = performanceTimeframe === '1M' ? 1 : performanceTimeframe === '3M' ? 3 : performanceTimeframe === '6M' ? 6 : 12;
      
      try {
        const response = await fetch(`/api/historical?tickers=${selectedTheme.stocks.join(',')}&months=${months}`);
        if (response.ok) {
          const historicalData = await response.json();
          
          let themeDates: string[] = [];
          let themeValues: number[] = [];
          
          selectedTheme.stocks.forEach((ticker, idx) => {
            const tickerData = historicalData[ticker];
            if (tickerData && tickerData.prices && tickerData.prices.length > 0) {
              const prices = tickerData.prices;
              const dates = tickerData.dates;
              const latestPrice = prices[prices.length - 1];
              const startPrice = prices[0];
              const change = latestPrice - startPrice;
              const changePercent = ((latestPrice - startPrice) / startPrice) * 100;
              
              const sparklineData = prices.filter((_: number, i: number) => i % Math.max(1, Math.floor(prices.length / 20)) === 0);
              
              data[ticker] = {
                ticker,
                name: tickerData.name || ticker,
                price: latestPrice,
                change,
                changePercent,
                evidence: STOCK_EVIDENCE[ticker] || `A key player in the ${selectedTheme.name.toLowerCase()} sector, contributing to innovation and growth in this space.`,
                sparklineData
              };
              
              if (themeDates.length === 0) {
                themeDates = dates;
                themeValues = new Array(dates.length).fill(0);
              }
              
              const weight = 1 / selectedTheme.stocks.length;
              prices.forEach((price: number, i: number) => {
                if (i < themeValues.length) {
                  const normalizedReturn = (price / prices[0] - 1) * weight;
                  themeValues[i] += normalizedReturn;
                }
              });
            }
          });
          
          const normalizedThemeValues = themeValues.map(v => (1 + v) * 100);
          const totalReturn = normalizedThemeValues.length > 0 
            ? ((normalizedThemeValues[normalizedThemeValues.length - 1] - 100) / 100) 
            : 0;
          
          setThemePerformance({
            dates: themeDates,
            values: normalizedThemeValues,
            totalReturn,
            changePercent: totalReturn * 100
          });
        }
      } catch (error) {
        console.error('Error fetching stock data:', error);
      }
      
      setStocksData(data);
      setIsLoadingStocks(false);
    };
    
    fetchStockData();
  }, [selectedTheme, performanceTimeframe]);

  const handlePrevSlide = () => {
    setCarouselIndex(prev => (prev === 0 ? Math.max(0, FEATURED_THEMES.length - 3) : prev - 1));
  };

  const handleNextSlide = () => {
    setCarouselIndex(prev => (prev >= FEATURED_THEMES.length - 3 ? 0 : prev + 1));
  };

  const visibleFeatured = FEATURED_THEMES.slice(carouselIndex, carouselIndex + 3);

  const handleSelectTheme = (theme: Theme) => {
    setSelectedTheme(theme);
    setStocksData({});
    setThemePerformance(null);
    setPerformanceTimeframe('1M');
  };

  const handleAddAllToPortfolio = () => {
    if (selectedTheme && onSelectTheme) {
      onSelectTheme(selectedTheme);
    }
  };

  const sortedStocks = useMemo(() => {
    if (!selectedTheme) return [];
    return selectedTheme.stocks
      .map(ticker => stocksData[ticker])
      .filter(Boolean)
      .sort((a, b) => b.changePercent - a.changePercent);
  }, [selectedTheme, stocksData]);

  const chartData = useMemo(() => {
    if (!themePerformance) return [];
    return themePerformance.dates.map((date, i) => ({
      date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: themePerformance.values[i] - 100
    }));
  }, [themePerformance]);

  if (selectedTheme) {
    return (
      <div className="min-h-screen bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <button 
            onClick={() => setSelectedTheme(null)}
            className="flex items-center text-slate-400 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft size={20} className="mr-2" />
            <span className="text-sm font-medium">INVESTMENT THEMES</span>
          </button>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <div>
              <div className="flex items-start gap-4 mb-4">
                <div className="w-14 h-14 rounded-xl bg-cyan-500/20 flex items-center justify-center text-cyan-400">
                  {selectedTheme.icon}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">{selectedTheme.name}</h1>
                  <p className="text-slate-400 text-sm mt-1">{selectedTheme.description}</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-medium text-slate-400">Theme Performance</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Performance of equal-weighted basket of the top {selectedTheme.stocks.length} companies</p>
                </div>
                <div className="flex bg-slate-700 rounded-lg p-0.5">
                  {(['1M', '3M', '6M', '1Y'] as const).map(tf => (
                    <button
                      key={tf}
                      onClick={() => setPerformanceTimeframe(tf)}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                        performanceTimeframe === tf
                          ? 'bg-slate-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="h-48">
                {isLoadingStocks ? (
                  <div className="h-full flex items-center justify-center">
                    <Activity className="animate-spin text-slate-500" size={24} />
                  </div>
                ) : chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                      <XAxis 
                        dataKey="date" 
                        stroke="#64748b" 
                        tick={{ fill: '#64748b', fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        minTickGap={30}
                      />
                      <YAxis
                        stroke="#64748b"
                        tick={{ fill: '#64748b', fontSize: 10 }}
                        tickFormatter={(val) => `${val.toFixed(1)}%`}
                        tickLine={false}
                        axisLine={false}
                        domain={['auto', 'auto']}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff', borderRadius: '8px' }}
                        formatter={(val: number) => [`${val.toFixed(2)}%`, 'Return']}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke={themePerformance && themePerformance.totalReturn >= 0 ? '#22c55e' : '#ef4444'}
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                    No performance data available
                  </div>
                )}
              </div>
              
              {themePerformance && (
                <div className="flex items-center justify-end mt-2">
                  <span className={`text-lg font-bold ${themePerformance.changePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {themePerformance.changePercent >= 0 ? '+' : ''}{themePerformance.changePercent.toFixed(2)}%
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl overflow-hidden">
            <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-slate-700/50 text-xs font-medium text-slate-400 uppercase tracking-wide">
              <div className="col-span-1">Rank</div>
              <div className="col-span-3">Companies</div>
              <div className="col-span-2">Trend</div>
              <div className="col-span-1">Last</div>
              <div className="col-span-5">Evidence</div>
            </div>
            
            {isLoadingStocks ? (
              <div className="flex items-center justify-center py-16">
                <Activity className="animate-spin text-slate-500 mr-3" size={24} />
                <span className="text-slate-400">Loading stock data...</span>
              </div>
            ) : sortedStocks.length > 0 ? (
              <div className="divide-y divide-slate-700">
                {sortedStocks.map((stock, idx) => (
                  <div key={stock.ticker} className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-slate-700/30 transition-colors items-center">
                    <div className="col-span-1">
                      <span className="text-lg font-bold text-slate-500">{idx + 1}</span>
                    </div>
                    <div className="col-span-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center text-cyan-400 font-bold text-sm">
                          {stock.ticker.substring(0, 2)}
                        </div>
                        <div>
                          <div className="font-semibold text-white">{stock.ticker}</div>
                          <div className="text-xs text-slate-400 truncate max-w-[150px]">{stock.name}</div>
                        </div>
                      </div>
                    </div>
                    <div className="col-span-2">
                      <div className="h-10 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={stock.sparklineData.map((v, i) => ({ i, v }))}>
                            <Line
                              type="monotone"
                              dataKey="v"
                              stroke={stock.changePercent >= 0 ? '#22c55e' : '#ef4444'}
                              strokeWidth={1.5}
                              dot={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className="col-span-1">
                      <div className="text-white font-medium">${stock.price.toFixed(2)}</div>
                    </div>
                    <div className="col-span-5">
                      <p className="text-sm text-slate-300 leading-relaxed line-clamp-2">{stock.evidence}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-16 text-center text-slate-500">
                No stock data available for this theme
              </div>
            )}
          </div>

          <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur border-t border-slate-700 p-4">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div className="text-sm text-slate-400">
                {selectedTheme.stocks.length} stocks in this theme
              </div>
              <button
                onClick={handleAddAllToPortfolio}
                className="flex items-center gap-2 px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-white font-medium rounded-lg transition-colors"
              >
                <Plus size={18} />
                Add All to Portfolio
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="max-w-xl mx-auto mb-8">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Search Investment Themes"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="text-center mb-6">
          <p className="text-slate-400 text-sm">
            Discover investment themes, connections, and products for the top 1,500 US companies
          </p>
        </div>

        <div className="relative mb-10">
          <button 
            onClick={handlePrevSlide}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-10 h-10 bg-slate-800 hover:bg-slate-700 rounded-full flex items-center justify-center transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          
          <div className="grid grid-cols-3 gap-4 px-4">
            {visibleFeatured.map((theme) => (
              <div 
                key={theme.id}
                onClick={() => {
                  const fullTheme = THEMES_DATA.find(t => t.id === theme.id);
                  if (fullTheme) handleSelectTheme(fullTheme);
                }}
                className="relative h-48 rounded-xl overflow-hidden cursor-pointer group"
              >
                <img 
                  src={theme.image} 
                  alt={theme.name}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4">
                  <h3 className="text-lg font-semibold text-white mb-1">{theme.name}</h3>
                  <p className="text-sm text-slate-300">{theme.companies} Companies</p>
                </div>
              </div>
            ))}
          </div>

          <button 
            onClick={handleNextSlide}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-10 h-10 bg-slate-800 hover:bg-slate-700 rounded-full flex items-center justify-center transition-colors"
          >
            <ChevronRight size={24} />
          </button>

          <div className="flex justify-center gap-2 mt-4">
            {Array.from({ length: Math.ceil(FEATURED_THEMES.length / 3) }).map((_, i) => (
              <button
                key={i}
                onClick={() => setCarouselIndex(i * 3)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  Math.floor(carouselIndex / 3) === i ? 'bg-white' : 'bg-slate-600'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="border-t border-slate-700 pt-8">
          <h2 className="text-xl font-semibold text-center mb-6">Investment Themes A-Z</h2>
          
          <div className="flex flex-wrap justify-center gap-1 mb-8">
            {alphabet.map((letter) => (
              <button
                key={letter}
                onClick={() => setSelectedLetter(letter)}
                className={`w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                  selectedLetter === letter 
                    ? 'bg-cyan-500 text-white' 
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {letter}
              </button>
            ))}
          </div>

          <div className="space-y-8">
            {Object.entries(groupedThemes).sort(([a], [b]) => a.localeCompare(b)).map(([letter, themes]: [string, Theme[]]) => (
              <div key={letter}>
                <h3 className="text-lg font-bold text-cyan-400 mb-4 border-b border-slate-700 pb-2">{letter}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {themes.map((theme) => (
                    <button
                      key={theme.id}
                      onClick={() => handleSelectTheme(theme)}
                      className="text-left px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-cyan-400 group-hover:text-cyan-300">
                          {theme.icon}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-white truncate">{theme.name}</div>
                          <div className="text-xs text-slate-400">{theme.companies} companies</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

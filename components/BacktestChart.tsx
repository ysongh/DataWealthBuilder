
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { BacktestResult } from '../types';

interface BacktestChartProps {
  result: BacktestResult | null;
}

interface SegmentedLineProps {
  points: Array<{ x: number; y: number; payload: { isDrawdown: boolean } }>;
  strokeWidth: number;
}

const SegmentedLine: React.FC<SegmentedLineProps> = ({ points, strokeWidth }) => {
  if (!points || points.length < 2) return null;

  const segments: React.ReactElement[] = [];
  
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    const isDrawdown = start.payload.isDrawdown || end.payload.isDrawdown;
    const color = isDrawdown ? '#ef4444' : '#0ea5e9';
    
    segments.push(
      <line
        key={i}
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    );
  }

  return <g>{segments}</g>;
};

const BacktestChart: React.FC<BacktestChartProps> = ({ result }) => {
  if (!result) {
    return (
      <div className="h-96 flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-lg border border-slate-200">
        <p className="mb-2 text-lg font-medium">No backtest data yet</p>
        <p className="text-sm opacity-70">Build a portfolio and click "Run Backtest"</p>
      </div>
    );
  }

  const initialPortfolioVal = result.portfolioValues[0];
  const initialBenchmarkVal = result.benchmarkValues[0];
  
  let runningPeak = initialPortfolioVal;
  
  const chartData = result.dates.map((date, i) => {
    const currentVal = result.portfolioValues[i];
    
    if (currentVal > runningPeak) {
      runningPeak = currentVal;
    }
    
    const drawdownFromPeak = (runningPeak - currentVal) / runningPeak;
    const isBelowStart = currentVal < initialPortfolioVal;
    const isDrawdown = drawdownFromPeak >= 0.10 || isBelowStart;

    return {
      date,
      portfolio: currentVal,
      benchmark: result.benchmarkValues[i],
      isDrawdown,
    };
  });

  return (
    <div className="h-96 w-full bg-white p-4 rounded-lg border border-slate-200 shadow-sm relative">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis 
            dataKey="date" 
            stroke="#64748b" 
            tick={{fill: '#64748b', fontSize: 12}} 
            tickLine={false}
            axisLine={false}
            minTickGap={30}
          />
          <YAxis 
            stroke="#64748b" 
            tick={{fill: '#64748b', fontSize: 12}} 
            tickFormatter={(val) => `$${val.toLocaleString()}`}
            tickLine={false}
            axisLine={false}
            domain={['auto', 'auto']}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a', borderRadius: '8px' }}
            formatter={(val: number, name: string) => {
                const label = name === 'portfolio' ? 'Your Portfolio' : result.benchmarkTicker;
                const startVal = name === 'portfolio' ? initialPortfolioVal : initialBenchmarkVal;
                
                const perf = ((val - startVal) / startVal) * 100;
                const sign = perf >= 0 ? '+' : '';
                const perfString = `(${sign}${perf.toFixed(2)}%)`;
                
                return [
                  <span key="val" className="space-x-2">
                    <span>${val.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    <span className={perf >= 0 ? 'text-green-600' : 'text-red-500'}>{perfString}</span>
                  </span>, 
                  label
                ];
            }}
            labelStyle={{ color: '#64748b', marginBottom: '0.5rem' }}
          />
          <Legend 
            payload={[
              { value: 'Your Portfolio', type: 'line', color: '#0ea5e9' },
              { value: result.benchmarkTicker, type: 'line', color: '#94a3b8' }
            ]}
          />

          <Line 
            type="linear" 
            dataKey="portfolio" 
            name="portfolio" 
            stroke="#0ea5e9" 
            strokeWidth={3} 
            dot={false} 
            activeDot={{ r: 6, fill: '#0ea5e9' }} 
            legendType="none"
            shape={(props: any) => <SegmentedLine points={props.points} strokeWidth={3} />}
          />

          <Line 
            type="linear" 
            dataKey="benchmark" 
            name="benchmark" 
            stroke="#94a3b8" 
            strokeWidth={2} 
            strokeDasharray="5 5" 
            dot={false}
            legendType="none"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default BacktestChart;

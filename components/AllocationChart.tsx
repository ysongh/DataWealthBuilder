
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { PortfolioItem } from '../types';

interface AllocationChartProps {
  items: PortfolioItem[];
}

// Map specific asset classes to brand colors
const CLASS_COLORS: Record<string, string> = {
    'US Equity': '#0ea5e9',         // Brand Blue
    'Intl Equity': '#3b82f6',       // Blue 500
    'Emerging Markets': '#8b5cf6',  // Purple
    'Fixed Income': '#22c55e',      // Green
    'Real Estate': '#f97316',       // Orange
    'Commodities': '#eab308',       // Yellow
    'Crypto': '#f43f5e',            // Red/Pink
    'Cash/Currency': '#64748b',     // Slate
    'Other': '#94a3b8'
};

const AllocationChart: React.FC<AllocationChartProps> = ({ items }) => {
  // Aggregate weights by asset class
  const groupedData = items.reduce((acc, item) => {
    const cls = item.assetClass || 'Other';
    const existing = acc.find(x => x.name === cls);
    if (existing) {
      existing.value += item.weight;
    } else {
      acc.push({ name: cls, value: item.weight });
    }
    return acc;
  }, [] as { name: string; value: number }[]);

  const finalData = groupedData.filter(i => i.value > 0);

  if (items.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-400 border-2 border-dashed border-slate-300 rounded-lg bg-slate-50">
        Add assets to see allocation
      </div>
    );
  }

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={finalData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={5}
            dataKey="value"
          >
            {finalData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={CLASS_COLORS[entry.name] || CLASS_COLORS['Other']} 
                stroke="none" 
              />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value: number) => `${value.toFixed(1)}%`}
            contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a', borderRadius: '8px' }}
            itemStyle={{ color: '#0f172a' }}
          />
          <Legend 
            verticalAlign="bottom" 
            height={36}
            iconType="circle"
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default AllocationChart;

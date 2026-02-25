import React from 'react';
import { PortfolioItem } from '../types';
import { Trash2, TrendingUp, TrendingDown } from 'lucide-react';

interface AssetCardProps {
  item: PortfolioItem;
  returnVal: number | undefined;
  onUpdateWeight: (ticker: string, weight: number) => void;
  onRemove: (ticker: string) => void;
  locked?: boolean;
}

const AssetCard: React.FC<AssetCardProps> = ({ item, returnVal, onUpdateWeight, onRemove, locked }) => {
  const hasReturn = returnVal !== undefined;
  const isPositive = hasReturn && returnVal >= 0;

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm mb-2 group hover:border-brand-300 transition-colors overflow-hidden">
      <div className="flex items-stretch">
        <div 
          className="w-1 flex-shrink-0" 
          style={{ backgroundColor: item.color }} 
        />
        
        <div className="flex-1 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-slate-900 text-sm">{item.ticker}</h3>
                <span className="text-[10px] text-slate-500 uppercase bg-slate-100 px-1.5 py-0.5 rounded whitespace-nowrap">
                  {item.assetClass || item.type}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">{item.name}</p>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              {hasReturn && (
                <div className="flex flex-col items-end">
                  <span className="text-[9px] uppercase text-slate-400 font-semibold tracking-wide">Return</span>
                  <div className={`text-sm font-bold flex items-center ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
                    {isPositive ? <TrendingUp size={12} className="mr-1" /> : <TrendingDown size={12} className="mr-1" />}
                    {(returnVal * 100).toFixed(1)}%
                  </div>
                </div>
              )}

              <div className="flex flex-col items-end">
                <span className="text-[9px] uppercase text-slate-400 font-semibold tracking-wide mb-0.5">Weight</span>
                <div className="flex items-center space-x-1">
                  <input 
                    type="number"
                    min="0"
                    max="100"
                    value={Math.round(item.weight * 10) / 10}
                    onChange={(e) => onUpdateWeight(item.ticker, Number(e.target.value))}
                    disabled={locked}
                    className="w-14 bg-slate-50 border border-slate-300 rounded px-2 py-1 text-right text-sm font-medium text-slate-900 focus:ring-2 focus:ring-brand-500 focus:outline-none transition-all hover:bg-white"
                  />
                  <span className="text-slate-500 text-xs font-medium">%</span>
                </div>
              </div>

              <button 
                onClick={() => onRemove(item.ticker)}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                title="Remove Asset"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssetCard;

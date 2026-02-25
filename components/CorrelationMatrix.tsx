import React from 'react';
import { Shield, AlertTriangle, CheckCircle } from 'lucide-react';

interface CorrelationMatrixProps {
  matrix: Record<string, Record<string, number>>;
}

const calculateDiversificationScore = (matrix: Record<string, Record<string, number>>): { score: number; label: string; color: string } => {
  const tickers = Object.keys(matrix);
  if (tickers.length < 2) {
    return { score: 0, label: 'Add more assets', color: 'text-slate-400' };
  }

  let totalCorrelation = 0;
  let pairCount = 0;

  for (let i = 0; i < tickers.length; i++) {
    for (let j = i + 1; j < tickers.length; j++) {
      const val = matrix[tickers[i]][tickers[j]];
      if (!isNaN(val)) {
        totalCorrelation += val;
        pairCount++;
      }
    }
  }

  if (pairCount === 0) return { score: 0, label: 'Insufficient data', color: 'text-slate-400' };

  const avgCorrelation = totalCorrelation / pairCount;
  const diversificationScore = Math.min(100, Math.max(0, Math.round(((1 - avgCorrelation) / 2) * 100)));

  let label: string;
  let color: string;

  if (diversificationScore >= 70) {
    label = 'Excellent';
    color = 'text-green-600';
  } else if (diversificationScore >= 55) {
    label = 'Good';
    color = 'text-blue-600';
  } else if (diversificationScore >= 40) {
    label = 'Moderate';
    color = 'text-yellow-600';
  } else {
    label = 'Poor';
    color = 'text-red-600';
  }

  return { score: diversificationScore, label, color };
};

const CorrelationMatrix: React.FC<CorrelationMatrixProps> = ({ matrix }) => {
  const tickers = Object.keys(matrix);
  if (tickers.length === 0) return null;

  const { score, label, color } = calculateDiversificationScore(matrix);

  const getColor = (val: number) => {
    if (isNaN(val) || val === undefined) return 'bg-slate-50 text-slate-400';

    if (val > 0) {
      if (val > 0.8) return 'bg-red-600 text-white';
      if (val > 0.6) return 'bg-red-400 text-white';
      if (val > 0.4) return 'bg-red-300 text-red-900';
      if (val > 0.2) return 'bg-red-100 text-red-900';
      return 'bg-slate-50 text-slate-600';
    } else {
      if (val < -0.8) return 'bg-blue-600 text-white';
      if (val < -0.6) return 'bg-blue-400 text-white';
      if (val < -0.4) return 'bg-blue-300 text-blue-900';
      if (val < -0.2) return 'bg-blue-100 text-blue-900';
      return 'bg-slate-50 text-slate-600';
    }
  };

  const ScoreIcon = score >= 50 ? CheckCircle : score >= 30 ? Shield : AlertTriangle;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 p-3 bg-gradient-to-r from-slate-50 to-white rounded-lg border border-slate-200">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${score >= 50 ? 'bg-green-100' : score >= 30 ? 'bg-yellow-100' : 'bg-red-100'}`}>
            <ScoreIcon className={`w-5 h-5 ${color}`} />
          </div>
          <div>
            <div className="text-xs text-slate-500 uppercase font-semibold tracking-wide">Diversification Score</div>
            <div className="flex items-baseline space-x-2">
              <span className={`text-2xl font-bold ${color}`}>{score}</span>
              <span className="text-slate-400 text-sm">/100</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                score >= 70 ? 'bg-green-100 text-green-700' :
                score >= 50 ? 'bg-blue-100 text-blue-700' :
                score >= 30 ? 'bg-yellow-100 text-yellow-700' :
                'bg-red-100 text-red-700'
              }`}>{label}</span>
            </div>
          </div>
        </div>
        <div className="text-xs text-slate-400 max-w-[200px] text-right">
          Lower correlation between assets = higher diversification
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-center border-collapse">
          <thead>
            <tr>
              <th className="p-2 border-b border-r border-slate-100 bg-slate-50"></th>
              {tickers.map(t => (
                <th key={t} className="p-2 font-bold text-slate-600 border-b border-slate-100 bg-slate-50 min-w-[50px]">
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tickers.map(rowTicker => (
              <tr key={rowTicker}>
                <td className="p-2 font-bold text-slate-600 border-r border-slate-100 bg-slate-50 text-left">
                  {rowTicker}
                </td>
                {tickers.map(colTicker => {
                  const val = matrix[rowTicker][colTicker];
                  return (
                    <td key={colTicker} className={`p-2 border border-slate-100 transition-colors ${getColor(val)}`}>
                      {!isNaN(val) ? val.toFixed(2) : '-'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CorrelationMatrix;

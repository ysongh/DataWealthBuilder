export type EconomicPhase = 'recovery' | 'expansion' | 'slowdown' | 'recession';

export interface EconomicIndicators {
  recessionIndicator: number;
  recessionProbability: number;
  leadingIndicator: number;
  unemploymentRate: number;
  gdpGrowth: number;
  lastUpdated: string;
}

export interface EconomicCycleData {
  currentPhase: EconomicPhase;
  daysInPhase: number;
  phaseStartDate: string;
  indicators: EconomicIndicators;
  confidence: 'high' | 'medium' | 'low';
}

export async function fetchEconomicCycle(): Promise<EconomicCycleData | null> {
  try {
    const response = await fetch('/api/economic-cycle');
    if (!response.ok) {
      throw new Error('Failed to fetch economic cycle data');
    }
    const data = await response.json();
    if (data.error) {
      throw new Error(data.error);
    }
    return data;
  } catch (error) {
    console.error('Error fetching economic cycle:', error);
    return null;
  }
}

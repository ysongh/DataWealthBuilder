// shared/schema.ts
// Firebase/Firestore version — replaces Drizzle ORM schema
// Firestore is schemaless, so this defines TypeScript interfaces instead of table definitions.

export interface PortfolioAsset {
  ticker: string;
  name: string;
  weight: number;
  type: string;
  isPortfolio?: boolean;
  portfolioId?: number;
}

export interface Portfolio {
  id: string;              // Firestore document ID (was serial int in Postgres)
  name: string;
  assets: PortfolioAsset[];
  createdAt: Date;
  updatedAt: Date;
}

// For creating a new portfolio (id and timestamps are auto-generated)
export type InsertPortfolio = Pick<Portfolio, 'name' | 'assets'>;

// Firestore collection name
export const PORTFOLIOS_COLLECTION = 'portfolios';
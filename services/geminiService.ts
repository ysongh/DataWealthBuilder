import { GoogleGenAI } from "@google/genai";
import { Asset, PortfolioItem, ChatMessage } from '../types';

const API_KEY = process.env.API_KEY || process.env.GEMINI_API_KEY;

let ai: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
    if (!ai) {
        if (!API_KEY) {
            throw new Error("GEMINI_API_KEY is not configured. Please add it in the Secrets tab.");
        }
        ai = new GoogleGenAI({ apiKey: API_KEY });
    }
    return ai;
}

const MODEL_NAME = 'gemini-2.5-flash';

// Helper to parse JSON from potentially messy model output
const parseJSON = (text: string): any => {
    let cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const startIndex = cleanText.indexOf('[');
    const endIndex = cleanText.lastIndexOf(']');
    // Handle single object response wrapped in [] or just object
    if (startIndex !== -1 && endIndex !== -1) {
        cleanText = cleanText.substring(startIndex, endIndex + 1);
    } else {
        const startObj = cleanText.indexOf('{');
        const endObj = cleanText.lastIndexOf('}');
        if (startObj !== -1 && endObj !== -1) {
             cleanText = cleanText.substring(startObj, endObj + 1);
        }
    }
    return JSON.parse(cleanText);
}

export const searchAssets = async (query: string): Promise<Asset[]> => {
  try {
    const isTicker = /^[A-Za-z]{1,5}$/.test(query.trim());
    
    const client = getAI();
    
    // FAST PATH: If query looks like a ticker, skip Google Search tool for speed.
    if (isTicker) {
        const fastPrompt = `Return a JSON array with exactly one object containing details for the financial asset "${query}". 
        Fields: ticker, name, type (STOCK or ETF), sector, and assetClass.
        
        For 'assetClass', choose strictly from: 'US Equity', 'Intl Equity', 'Emerging Markets', 'Fixed Income', 'Commodities', 'Real Estate', 'Crypto', 'Cash/Currency'.
        
        Example: [{"ticker": "AAPL", "name": "Apple Inc.", "type": "STOCK", "sector": "Technology", "assetClass": "US Equity"}]`;
        
        try {
             const response = await client.models.generateContent({
                model: MODEL_NAME,
                contents: fastPrompt,
             });
             const data = parseJSON(response.text || "[]");
             if (Array.isArray(data) && data.length > 0 && data[0].ticker) {
                 return data as Asset[];
             }
        } catch (e) {
            console.warn("Fast path failed, falling back to search tool", e);
        }
    }

    // SLOW PATH: Use Google Search for broad queries or if fast path failed
    const prompt = `Find 3 to 5 financial assets (Stocks or ETFs) that match the search query: "${query}". 
    Return a list of JSON objects including ticker, name, type (STOCK or ETF), sector, and assetClass.
    
    For 'assetClass', choose strictly from: 'US Equity', 'Intl Equity', 'Emerging Markets', 'Fixed Income', 'Commodities', 'Real Estate', 'Crypto', 'Cash/Currency'.
    
    Ensure the tickers are accurate.
    IMPORTANT: Return ONLY the raw JSON array. Do not use markdown formatting.`;

    const response = await client.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      }
    });

    return parseJSON(response.text || "[]") as Asset[];

  } catch (error) {
    console.error("Gemini search failed:", error);
    return [];
  }
};

export const getMarketContext = async (tickers: string[]): Promise<string> => {
    try {
        const client = getAI();
        const prompt = `Briefly analyze this portfolio mix: ${tickers.join(', ')}. Mention key sector exposures and potential risks in 2 sentences.`;
        const response = await client.models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
        });
        return response.text || "Analysis unavailable.";
    } catch (e) {
        console.error(e);
        return "Could not retrieve market context.";
    }
}

export const suggestBenchmark = async (assets: Asset[]): Promise<string> => {
    try {
        if (assets.length === 0) return 'SPY';
        
        const client = getAI();
        const summary = assets.map(a => `${a.ticker} (${a.assetClass})`).join(', ');
        const prompt = `Given this portfolio: ${summary}.
        Suggest the single best ETF benchmark ticker (e.g. SPY, QQQ, IWM, AGG, VT, GLD, BTC). 
        Return ONLY the ticker string. No markdown, no explanation.`;

        const response = await client.models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
        });
        
        const ticker = response.text?.trim().replace(/\./g, '').split(' ')[0] || 'SPY';
        return ticker.length <= 5 ? ticker : 'SPY';
    } catch (e) {
        return 'SPY';
    }
}

export const generatePortfolioInsight = async (
    portfolio: PortfolioItem[],
    metrics?: {
        totalReturn: number;
        cagr: number;
        maxDrawdown: number;
        volatility: number;
        sharpeRatio: number;
    }
): Promise<string> => {
    try {
        const client = getAI();
        const portfolioSummary = portfolio.map(p => 
            `${p.ticker} (${p.name}, ${p.assetClass}): ${p.weight.toFixed(1)}%`
        ).join('\n');
        
        let metricsInfo = '';
        if (metrics) {
            metricsInfo = `
Performance Metrics:
- Total Return: ${(metrics.totalReturn * 100).toFixed(2)}%
- CAGR: ${(metrics.cagr * 100).toFixed(2)}%
- Max Drawdown: ${(metrics.maxDrawdown * 100).toFixed(2)}%
- Volatility: ${(metrics.volatility * 100).toFixed(2)}%
- Sharpe Ratio: ${metrics.sharpeRatio.toFixed(2)}
`;
        }
        
        const prompt = `You are a portfolio analyst. Analyze this investment portfolio and provide detailed insights:

Portfolio Composition:
${portfolioSummary}

${metricsInfo}

Please provide:
1. A brief overview of the portfolio's diversification strategy
2. Key sector and asset class exposures
3. Potential risks and considerations
4. Suggestions for improvement (if any)

Keep the analysis concise but insightful (3-4 paragraphs).`;

        const response = await client.models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
        });
        return response.text || "Analysis unavailable.";
    } catch (e) {
        console.error(e);
        return "Could not generate portfolio insight. Please try again.";
    }
}

export const chatAboutPortfolio = async (
    userMessage: string,
    portfolio: PortfolioItem[],
    previousInsight: string,
    chatHistory: ChatMessage[]
): Promise<string> => {
    try {
        const client = getAI();
        
        const portfolioSummary = portfolio.map(p => 
            `${p.ticker} (${p.name}, ${p.assetClass}): ${p.weight.toFixed(1)}%`
        ).join('\n');
        
        const historyContext = chatHistory.slice(-6).map(msg => 
            `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
        ).join('\n\n');
        
        const prompt = `You are a helpful portfolio analyst assistant. You're having a conversation about an investment portfolio.

Current Portfolio:
${portfolioSummary}

Previous Insight Generated:
${previousInsight || 'No insight generated yet.'}

Recent Conversation:
${historyContext}

User's Question: ${userMessage}

Provide a helpful, concise response focused on the user's question. Be specific and actionable when possible.`;

        const response = await client.models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
        });
        return response.text || "I couldn't process your question. Please try again.";
    } catch (e) {
        console.error(e);
        return "Sorry, I couldn't process your question. Please try again.";
    }
}
export interface OhlcvData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Indicators {
  ema8: number[];
  ema21: number[];
  ema50: number[];
  rsi14: number[];
  atr14: number[];
  volume: VolumeAnalysis[];
}

export interface VolumeAnalysis {
  ratio: number;
  spike: boolean;
  absorption: boolean;
  avgVolume: number;
}

export interface Gates {
  trendStack: boolean;
  bosDirection: boolean;
  fiftyPercentRetest: boolean;
  volumeSpike: boolean;
}

export type SignalEngineStatus = 'NO_TRADE' | 'SETUP' | 'ENTRY';

export interface ExecutionParams {
  entry: number;
  stopLoss: number;
  tp1: number;
  tp2: number;
  trailingStop: number;
  riskReward: string;
  currentMarketPrice?: number;
  direction?: 'LONG' | 'SHORT';
  positionSize?: number;
  maxRisk?: number;
}

export interface PerformanceMetrics {
  signalsGenerated: number;
  accuracyRate: number;
  avgRR: string;
  tvDeviation: number;
}

export interface BacktestResults {
  setups: any[]; // Define more specific type later
  expectancy: number;
  hitRate: number;
  avgR: number;
  maxDD: number;
  ruleAdherence: number;
  varianceR: number;
}

export interface AppState {
  currentSymbol: string;
  currentTimeframe: string;
  autoCalculation: boolean;
  ohlcvData: OhlcvData[];
  indicators: Indicators;
  gates: Gates;
  signalEngine: 'NO_TRADE' | 'SETUP' | 'ENTRY';
  executionParams: ExecutionParams;
  performance: PerformanceMetrics;
  logs: LogEntry[];
  backtestResults: BacktestResults;
}

export interface LogEntry {
  type: 'info' | 'success' | 'error';
  message: string;
  timestamp: string;
}

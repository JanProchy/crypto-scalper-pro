import { Injectable, signal, WritableSignal } from '@angular/core';
import { AppState, LogEntry } from './interfaces';

const initialState: AppState = {
  currentSymbol: 'SOLUSDT',
  currentTimeframe: '5m',
  autoCalculation: true,
  ohlcvData: [],
  indicators: {
    ema8: [],
    ema21: [],
    ema50: [],
    rsi14: [],
    atr14: [],
    volume: [],
  },
  gates: {
    trendStack: false,
    bosDirection: false,
    fiftyPercentRetest: false,
    volumeSpike: false,
  },
  signalEngine: 'NO_TRADE',
  executionParams: {
    entry: 0,
    stopLoss: 0,
    tp1: 0,
    tp2: 0,
    trailingStop: 0,
    riskReward: '1:2',
  },
  performance: {
    signalsGenerated: 0,
    accuracyRate: 0,
    avgRR: '0:0',
    tvDeviation: 0,
  },
  logs: [],
  backtestResults: {
    setups: [],
    expectancy: 0,
    hitRate: 0,
    avgR: 0,
    maxDD: 0,
    ruleAdherence: 0,
    varianceR: 0,
  },
};

@Injectable({
  providedIn: 'root',
})
export class StateService {
  private readonly state: WritableSignal<AppState> = signal(initialState);

  // Public signals for components to consume
  public readonly currentState = this.state.asReadonly();

  constructor() {}

  // Method to update the state
  updateState(updateFn: (currentState: AppState) => AppState) {
    this.state.update(updateFn);
  }

  // Method to add a log entry
  addLog(type: 'info' | 'success' | 'error', message: string) {
    const newLog: LogEntry = {
      type,
      message,
      timestamp: new Date().toLocaleTimeString(),
    };
    this.state.update((state) => ({
      ...state,
      logs: [...state.logs.slice(-49), newLog], // Keep last 50 logs
    }));
  }

  // Specific state updaters can be added here for convenience
  setCurrentSymbol(symbol: string) {
    this.updateState((state) => ({ ...state, currentSymbol: symbol }));
  }

  setCurrentTimeframe(timeframe: string) {
    this.updateState((state) => ({ ...state, currentTimeframe: timeframe }));
  }

  setOhlcvData(data: any[]) {
    this.updateState((state) => ({ ...state, ohlcvData: data }));
  }

  getCurrentMarketPrice(): number | null {
    const { ohlcvData } = this.state();
    if (ohlcvData.length === 0) return null;
    return ohlcvData[ohlcvData.length - 1].close;
  }
}

import { Injectable, inject } from '@angular/core';
import { StateService } from './state';
import { IndicatorCalculationService } from './indicator-calculation';
import {
  Gates,
  AppState,
  ExecutionParams,
  OhlcvData,
  Indicators,
} from './interfaces';
import { ApiService } from './api';
import { take } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class SignalLogicService {
  private state = inject(StateService);
  private indicatorCalc = inject(IndicatorCalculationService);
  private api = inject(ApiService);

  // Main method to run the full pipeline
  runSignalPipeline() {
    // Snapshot před výpočtem
    const before = this.state.currentState();

    // 1. Calculate Indicators nad aktuálních OHLC
    let indicators: Indicators;
    try {
      indicators = this.indicatorCalc.calculateAllIndicators(before.ohlcvData);
    } catch (e: any) {
      // Pokud není dost dat, nastavíme prázdné struktury a ukončíme (gates zůstanou false)
      indicators = {
        ema8: [],
        ema21: [],
        ema50: [],
        rsi14: [],
        atr14: [],
        volume: [],
      };
      this.state.updateState((s) => ({ ...s, indicators }));
      return; // Nelze validovat dál
    }
    this.state.updateState((s) => ({ ...s, indicators }));

    // Re-snapshot po uložení indikátorů (původní kód používal starý stav => gates vždy false)
    const afterIndicators = this.state.currentState();

    // 2. Validate Gates nad stavem s novými indikátory
    const gates = this.validateGates(afterIndicators);
    this.state.updateState((s) => ({ ...s, gates }));

    // 3. Update Signal Engine Status & Execution Params nad nejnovějším stavem
    this.updateSignalEngine(gates, this.state.currentState());
  }

  fetchDataAndRunPipeline() {
    const { currentSymbol, currentTimeframe, autoCalculation } =
      this.state.currentState();
    this.api
      .fetchBybitData(currentSymbol, currentTimeframe)
      .pipe(take(1))
      .subscribe({
        next: (data) => {
          this.state.setOhlcvData(data);
          this.runSignalPipeline();
        },
        error: (err) => {
          console.error(err);
          // Stop auto-calculation on API error to prevent spamming
          if (autoCalculation) {
            this.state.updateState((s) => ({ ...s, autoCalculation: false }));
          }
        },
      });
  }

  private validateGates(state: AppState): Gates {
    const { indicators, ohlcvData } = state;
    const latest = indicators.ema8.length - 1;
    if (latest < 0)
      return {
        trendStack: false,
        bosDirection: false,
        fiftyPercentRetest: false,
        volumeSpike: false,
      };

    // Gate 1: Trend Stack
    const ema8 = indicators.ema8[latest];
    const ema21 = indicators.ema21[indicators.ema21.length - 1];
    const ema50 = indicators.ema50[indicators.ema50.length - 1];
    const short = ema8 < ema21 && ema21 < ema50;
    const long = ema8 > ema21 && ema21 > ema50;
    const price = this.state.getCurrentMarketPrice();
    let valid: boolean = false;
    if (!price) {
      valid = false;
    } else {
      valid = short ? price < ema8 : long ? price > ema8 : false;
    }

    const trendStack = valid;

    // Gate 2: BOS Direction (simplified)
    const bosData = this.detectBOS(ohlcvData);
    const latestBOS = bosData[bosData.length - 1];
    const bosDirection = latestBOS && (latestBOS.bullish || latestBOS.bearish);

    // Gate 3: 50% Retest
    const retestData = this.detect50PercentRetest(ohlcvData, indicators.atr14);
    const latestRetest = retestData[retestData.length - 1];
    const fiftyPercentRetest = latestRetest && latestRetest.inZone;

    // Gate 4: Volume Spike
    const volumeData = indicators.volume[indicators.volume.length - 1];
    const volumeSpike = volumeData && volumeData.spike && volumeData.absorption;

    return { trendStack, bosDirection, fiftyPercentRetest, volumeSpike };
  }

  private updateSignalEngine(gates: Gates, state: AppState) {
    // Always compute execution parameters so the panel isn't stuck at zeros
    const executionParams = this.calculateExecutionParameters(state);
    const allGatesPassed = Object.values(gates).every((gate) => gate);
    const someGatesPassed =
      !allGatesPassed && Object.values(gates).some((g) => g);
    const signalEngine = allGatesPassed
      ? 'ENTRY'
      : someGatesPassed
      ? 'SETUP'
      : 'NO_TRADE';

    this.state.updateState((s) => ({
      ...s,
      signalEngine,
      executionParams,
    }));
  }

  private calculateExecutionParameters(state: AppState): ExecutionParams {
    const { ohlcvData, indicators } = state;
    const latest = ohlcvData.length - 1;
    if (latest < 0) return state.executionParams;

    const currentPrice = ohlcvData[latest].close;
    const atr =
      indicators.atr14[indicators.atr14.length - 1] || currentPrice * 0.025;
    const ema8 = indicators.ema8[indicators.ema8.length - 1];
    const ema21 = indicators.ema21[indicators.ema21.length - 1];
    const direction = ema8 > ema21 ? 'LONG' : 'SHORT';

    let entry = 0,
      stopLoss = 0,
      tp1 = 0,
      tp2 = 0;

    if (direction === 'LONG') {
      entry = currentPrice + 0.1 * atr;
      stopLoss = currentPrice - 1.0 * atr;
      const riskAmount = entry - stopLoss;
      tp1 = entry + 1.0 * riskAmount;
      tp2 = entry + 2.0 * riskAmount;
    } else {
      entry = currentPrice - 0.1 * atr;
      stopLoss = currentPrice + 1.0 * atr;
      const riskAmount = stopLoss - entry;
      tp1 = entry - 1.0 * riskAmount;
      tp2 = entry - 2.0 * riskAmount;
    }

    const trailingStop = 0.5 * atr;
    const riskAmount = Math.abs(entry - stopLoss);
    const rewardAmount = Math.abs(tp2 - entry);
    const rrRatio = riskAmount > 0 ? rewardAmount / riskAmount : 0;
    const riskReward = `1:${rrRatio.toFixed(1)}`;

    return {
      entry,
      stopLoss,
      tp1,
      tp2,
      trailingStop,
      riskReward,
      currentMarketPrice: currentPrice,
      direction,
    };
  }

  private detectBOS(ohlcvData: OhlcvData[], lookback = 10) {
    // Simplified version for brevity
    if (ohlcvData.length < lookback + 5) return [];
    const bosSignals = [];
    for (let i = lookback; i < ohlcvData.length; i++) {
      const recentData = ohlcvData.slice(i - lookback, i + 1);
      const currentCandle = ohlcvData[i];
      const lastSwingHigh = Math.max(
        ...recentData.slice(0, -1).map((c) => c.high)
      );
      const lastSwingLow = Math.min(
        ...recentData.slice(0, -1).map((c) => c.low)
      );
      bosSignals.push({
        bullish: currentCandle.close > lastSwingHigh,
        bearish: currentCandle.close < lastSwingLow,
      });
    }
    return bosSignals;
  }

  private detect50PercentRetest(ohlcvData: OhlcvData[], atrData: number[]) {
    // Simplified version for brevity
    if (ohlcvData.length < 20 || atrData.length === 0) return [];
    const retestSignals = [];
    for (let i = 10; i < ohlcvData.length; i++) {
      const recentData = ohlcvData.slice(i - 10, i + 1);
      const currentCandle = ohlcvData[i];
      const currentATR = atrData[Math.min(i - 1, atrData.length - 1)];
      const impulseHigh = Math.max(...recentData.map((c) => c.high));
      const impulseLow = Math.min(...recentData.map((c) => c.low));
      const midLevel = (impulseHigh + impulseLow) / 2;
      const tolerance = 0.25 * currentATR;
      retestSignals.push({
        inZone:
          currentCandle.close >= midLevel - tolerance &&
          currentCandle.close <= midLevel + tolerance,
      });
    }
    return retestSignals;
  }
}

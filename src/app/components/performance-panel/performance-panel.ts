import {
  Component,
  inject,
  ViewChild,
  ElementRef,
  AfterViewInit,
  effect,
} from '@angular/core';
import { StateService } from '../../services/state';
import { CommonModule } from '@angular/common';
import { SignalLogicService } from '../../services/signal-logic';

@Component({
  selector: 'app-performance-panel',

  imports: [CommonModule],
  templateUrl: './performance-panel.html',
  styleUrl: './performance-panel.scss',
})
export class PerformancePanel {
  private state = inject(StateService);
  private signalLogic = inject(SignalLogicService);
  currentState = this.state.currentState;
  @ViewChild('backtestLog') backtestLog?: ElementRef<HTMLDivElement>;
  lastSnapshot: any = null;

  constructor() {
    const raw = localStorage.getItem('csp.lastSnapshot');
    if (raw) this.lastSnapshot = JSON.parse(raw);
  }

  // Placeholder methods for future implementation
  captureSnapshot() {
    const snapshot = this.buildSnapshot();
    this.lastSnapshot = snapshot;
    try {
      localStorage.setItem('csp.lastSnapshot', JSON.stringify(snapshot));
    } catch {}
    this.state.addLog('success', `📸 Snapshot captured (${snapshot.meta.id}).`);
  }

  exportSnapshot() {
    const snapshot = this.buildSnapshot();
    this.lastSnapshot = snapshot;
    try {
      localStorage.setItem('csp.lastSnapshot', JSON.stringify(snapshot));
    } catch {}
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `snapshot_${snapshot.meta.symbol}_${snapshot.meta.timeframe}_${snapshot.meta.timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.state.addLog('success', '💾 Snapshot exported as file.');
  }

  importSnapshot(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || !input.files.length) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (!data || !data.state) throw new Error('Invalid snapshot format');
        // Full restoration including symbol/timeframe and raw candles if present
        this.state.updateState((s) => ({
          ...s,
          currentSymbol: data.meta?.symbol || s.currentSymbol,
          currentTimeframe: data.meta?.timeframe || s.currentTimeframe,
          ohlcvData: data.state.ohlcvData || s.ohlcvData,
          executionParams: data.state.executionParams || s.executionParams,
          indicators: data.state.indicators || s.indicators,
          gates: data.state.gates || s.gates,
          signalEngine: data.state.signalEngine || s.signalEngine,
          backtestResults: data.state.backtestResults || s.backtestResults,
        }));
        this.lastSnapshot = data;
        try {
          localStorage.setItem('csp.lastSnapshot', JSON.stringify(data));
        } catch {}
        this.state.addLog(
          'success',
          `📂 Snapshot imported (${data.meta?.id || 'unknown'}).`
        );
        // Re-run pipeline to ensure derived values align with raw OHLC & indicators
        // (Indicators may already exist; if ohlcvData present without indicators we recompute)
        const st = this.currentState();
        if (!st.indicators.ema8.length && st.ohlcvData.length) {
          // compute indicators+pipeline afresh
          this.signalLogic.runSignalPipeline();
        } else {
          // still run to recalc execution params & engine state coherently
          this.signalLogic.runSignalPipeline();
        }
      } catch (e: any) {
        this.state.addLog('error', 'Failed to import snapshot: ' + e.message);
      } finally {
        input.value = '';
      }
    };
    reader.readAsText(file);
  }

  runMiniBacktest() {
    const candles = this.currentState().ohlcvData;
    if (candles.length < 80) {
      this.state.addLog(
        'error',
        'Not enough data (need >=80 candles) for mini backtest.'
      );
      return;
    }

    // Very naive sample: walk last 200 candles (or all) and simulate 20 setups
    const lookback = Math.min(200, candles.length - 1);
    const segment = candles.slice(-lookback);
    const setups: { entry: number; stop: number; tp: number; r: number }[] = [];

    for (let i = 14; i < segment.length - 5 && setups.length < 20; i++) {
      // Simple condition: EMA8 > EMA21 > EMA50 (approx using closes EMA proxy via simple averages)
      // We'll approximate fast/slow using recent closes averages to avoid duplicating indicator service here.
      const recent = segment.slice(i - 14, i + 1).map((c) => c.close);
      const sma = (arr: number[]) =>
        arr.reduce((s, v) => s + v, 0) / arr.length;
      const fast = sma(recent.slice(-5));
      const mid = sma(recent.slice(-8));
      const slow = sma(recent.slice(-13));
      if (!(fast > mid && mid > slow)) continue;
      const entry = segment[i].close;
      const atrLike = Math.max(
        segment[i].high - segment[i].low,
        segment[i].high - segment[i - 1].close,
        segment[i - 1].close - segment[i].low
      );
      const stop = entry - atrLike * 1.0;
      const tp = entry + atrLike * 2.0;
      // Forward walk to see if stop or tp hits first
      let outcomeR = 0;
      for (let f = i + 1; f < segment.length && f < i + 30; f++) {
        // 30 candle horizon
        if (segment[f].low <= stop) {
          outcomeR = -1;
          break;
        }
        if (segment[f].high >= tp) {
          outcomeR = 2;
          break;
        }
      }
      if (outcomeR === 0)
        outcomeR =
          (segment[Math.min(i + 30, segment.length - 1)].close - entry) /
          (entry - stop);
      setups.push({ entry, stop, tp, r: outcomeR });
    }

    if (!setups.length) {
      this.state.addLog('info', 'No qualifying setups found in sample window.');
      return;
    }

    // Metrics
    const wins = setups.filter((s) => s.r > 0).length;
    const hitRate = (wins / setups.length) * 100;
    const avgR = setups.reduce((s, v) => s + v.r, 0) / setups.length;
    const expectancy = avgR; // simplistic
    const maxDD = Math.min(...cumEquity(setups.map((s) => s.r))) * -100; // percent drawdown relative to start
    const varianceR = variance(setups.map((s) => s.r));
    const ruleAdherence = 80 + Math.min(20, wins); // dummy metric

    function cumEquity(rs: number[]) {
      let eq = 0;
      const arr: number[] = [0];
      for (const r of rs) {
        eq += r;
        arr.push(eq);
      }
      return arr;
    }
    function variance(rs: number[]) {
      const m = rs.reduce((s, v) => s + v, 0) / rs.length;
      return rs.reduce((s, v) => s + (v - m) ** 2, 0) / rs.length;
    }

    this.state.updateState((s) => ({
      ...s,
      backtestResults: {
        setups,
        expectancy,
        hitRate,
        avgR,
        maxDD,
        ruleAdherence,
        varianceR,
      },
    }));
    this.state.addLog(
      'success',
      `Mini backtest done: ${setups.length} setups, hitRate ${hitRate.toFixed(
        1
      )}%, avgR ${avgR.toFixed(2)}.`
    );
  }

  generateHistoricalSetups() {
    const st = this.currentState();
    const { ohlcvData, indicators } = st;
    if (ohlcvData.length < 120) {
      this.state.addLog(
        'error',
        'Need at least 120 candles to scan for setups.'
      );
      return;
    }

    const ema8 = indicators.ema8;
    const ema21 = indicators.ema21;
    const ema50 = indicators.ema50;
    const atr14 = indicators.atr14;
    const volume = indicators.volume; // period 20 derived
    const setups: any[] = [];

    // Helper to map candle index -> EMA index (offset = period -1)
    const mapIdx = (i: number, period: number) => i - (period - 1);
    const atrIdx = (i: number) => i - 14; // derived earlier
    const volIdx = (i: number) => i - (20 - 1);

    for (let i = 60; i < ohlcvData.length && setups.length < 100; i++) {
      const i8 = mapIdx(i, 8),
        i21 = mapIdx(i, 21),
        i50 = mapIdx(i, 50);
      if (i8 < 0 || i21 < 0 || i50 < 0) continue;
      if (i8 >= ema8.length || i21 >= ema21.length || i50 >= ema50.length)
        continue;

      const e8 = ema8[i8];
      const e21 = ema21[i21];
      const e50 = ema50[i50];
      const trendStackLong = e8 > e21 && e21 > e50;
      const trendStackShort = e8 < e21 && e21 < e50;
      if (!trendStackLong && !trendStackShort) continue;

      // BOS (lookback 10)
      const lookback = 10;
      if (i - lookback < 0) continue;
      const window = ohlcvData.slice(i - lookback, i);
      const lastSwingHigh = Math.max(...window.map((c) => c.high));
      const lastSwingLow = Math.min(...window.map((c) => c.low));
      const close = ohlcvData[i].close;
      const bosBull = close > lastSwingHigh;
      const bosBear = close < lastSwingLow;
      if (!(bosBull || bosBear)) continue;

      // 50% Retest (reuse logic simplified)
      if (i - 10 < 0) continue;
      const zoneData = ohlcvData.slice(i - 10, i + 1);
      const impulseHigh = Math.max(...zoneData.map((c) => c.high));
      const impulseLow = Math.min(...zoneData.map((c) => c.low));
      const mid = (impulseHigh + impulseLow) / 2;
      const atrIndex = atrIdx(i);
      if (atrIndex < 0 || atrIndex >= atr14.length) continue;
      const atrVal = atr14[atrIndex];
      const tolerance = 0.25 * atrVal;
      const inZone = close >= mid - tolerance && close <= mid + tolerance;
      if (!inZone) continue;

      // Volume Spike
      const vIndex = volIdx(i);
      if (vIndex < 0 || vIndex >= volume.length) continue;
      const volItem = volume[vIndex];
      if (!(volItem.spike && volItem.absorption)) continue;

      // All gates passed -> create setup
      const direction = trendStackLong ? 'LONG' : 'SHORT';
      const candle = ohlcvData[i];
      const entry = candle.close;
      const stop = direction === 'LONG' ? entry - atrVal : entry + atrVal;
      const risk = Math.abs(entry - stop);
      const tp1 = direction === 'LONG' ? entry + risk : entry - risk;
      const tp2 = direction === 'LONG' ? entry + 2 * risk : entry - 2 * risk;
      setups.push({
        time: candle.time,
        direction,
        entry,
        stop,
        tp1,
        tp2,
        atr: atrVal,
        volumeRatio: volItem.ratio,
        ema8: e8,
        ema21: e21,
        ema50: e50,
      });
    }

    if (!setups.length) {
      this.state.addLog('info', 'No historical setups matched criteria.');
      return;
    }

    this.state.updateState((s) => ({
      ...s,
      backtestResults: { ...s.backtestResults, setups },
    }));
    this.state.addLog(
      'success',
      `Generated ${setups.length} historical setups.`
    );
  }

  clearBacktestResults() {
    this.state.updateState((s) => ({
      ...s,
      backtestResults: {
        setups: [],
        expectancy: 0,
        hitRate: 0,
        avgR: 0,
        maxDD: 0,
        ruleAdherence: 0,
        varianceR: 0,
      },
    }));
    this.state.addLog('info', 'Backtest results cleared.');
  }

  trackLog = (_: number, item: any) => item.timestamp + item.message;

  private buildSnapshot() {
    const full = this.currentState();
    const snapshot = {
      meta: {
        id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
        timestamp: new Date().toISOString().replace(/[:]/g, '-'),
        symbol: full.currentSymbol,
        timeframe: full.currentTimeframe,
        engine: full.signalEngine,
      },
      state: {
        ohlcvData: full.ohlcvData,
        executionParams: full.executionParams,
        indicators: full.indicators,
        gates: full.gates,
        backtestResults: full.backtestResults,
        lastLog: full.logs[full.logs.length - 1] || null,
      },
    };
    return snapshot;
  }

  reloadLastSnapshot() {
    try {
      const raw = localStorage.getItem('csp.lastSnapshot');
      if (!raw) {
        this.state.addLog('info', 'No stored snapshot found.');
        return;
      }
      const data = JSON.parse(raw);
      if (!data || !data.state) throw new Error('Invalid snapshot');
      this.state.updateState((s) => ({
        ...s,
        currentSymbol: data.meta?.symbol || s.currentSymbol,
        currentTimeframe: data.meta?.timeframe || s.currentTimeframe,
        ohlcvData: data.state.ohlcvData || s.ohlcvData,
        executionParams: data.state.executionParams || s.executionParams,
        indicators: data.state.indicators || s.indicators,
        gates: data.state.gates || s.gates,
        signalEngine: data.state.signalEngine || s.signalEngine,
        backtestResults: data.state.backtestResults || s.backtestResults,
      }));
      this.lastSnapshot = data;
      this.state.addLog('success', '🔄 Loaded snapshot from storage.');
      // Re-run pipeline to sync derived params
      this.signalLogic.runSignalPipeline();
    } catch (e: any) {
      this.state.addLog('error', 'Failed to load snapshot: ' + e.message);
    }
  }
}

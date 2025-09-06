import { Injectable } from '@angular/core';
import { OhlcvData, Indicators, VolumeAnalysis } from './interfaces';

@Injectable({
  providedIn: 'root',
})
export class IndicatorCalculationService {
  constructor() {}

  calculateAllIndicators(ohlcvData: OhlcvData[]): Indicators {
    if (ohlcvData.length < 50) {
      throw new Error('Insufficient data for indicator calculation');
    }

    const closes = ohlcvData.map((d) => d.close);

    return {
      ema8: this.calculateEMA(closes, 8),
      ema21: this.calculateEMA(closes, 21),
      ema50: this.calculateEMA(closes, 50),
      rsi14: this.calculateRSI(closes, 14),
      atr14: this.calculateATR(ohlcvData, 14),
      volume: this.calculateVolumeAnalysis(ohlcvData, 20),
    };
  }

  private calculateEMA(prices: number[], period: number): number[] {
    if (prices.length < period) return [];
    const ema = [];
    const multiplier = 2 / (period + 1);
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += prices[i];
    }
    ema.push(sum / period);
    for (let i = period; i < prices.length; i++) {
      const emaValue: number =
        prices[i] * multiplier + ema[ema.length - 1] * (1 - multiplier);
      ema.push(emaValue);
    }
    return ema;
  }

  private calculateRSI(prices: number[], period = 14): number[] {
    if (prices.length < period + 1) return [];
    const rsi = [];
    const gains = [];
    const losses = [];
    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }
    if (gains.length < period) return [];
    let avgGain =
      gains.slice(0, period).reduce((sum, gain) => sum + gain, 0) / period;
    let avgLoss =
      losses.slice(0, period).reduce((sum, loss) => sum + loss, 0) / period;
    let rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
    rsi.push(100 - 100 / (1 + rs));
    for (let i = period; i < gains.length; i++) {
      avgGain = (avgGain * (period - 1) + gains[i]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
      rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
      rsi.push(100 - 100 / (1 + rs));
    }
    return rsi;
  }

  private calculateATR(ohlcData: OhlcvData[], period = 14): number[] {
    if (ohlcData.length < period + 1) return [];
    const trueRanges = [];
    for (let i = 1; i < ohlcData.length; i++) {
      const current = ohlcData[i];
      const previous = ohlcData[i - 1];
      const tr1 = current.high - current.low;
      const tr2 = Math.abs(current.high - previous.close);
      const tr3 = Math.abs(current.low - previous.close);
      trueRanges.push(Math.max(tr1, tr2, tr3));
    }
    return this.calculateEMA(trueRanges, period);
  }

  private calculateVolumeAnalysis(
    ohlcData: OhlcvData[],
    period = 20
  ): VolumeAnalysis[] {
    if (ohlcData.length < period) return [];
    const volumeAnalysis: VolumeAnalysis[] = [];
    for (let i = period - 1; i < ohlcData.length; i++) {
      const recentVolumes = ohlcData
        .slice(i - period + 1, i + 1)
        .map((d) => d.volume);
      const currentVolume = ohlcData[i].volume;
      const avgVolume =
        recentVolumes.reduce((sum, vol) => sum + vol, 0) / period;
      const volumeRatio =
        avgVolume === 0 ? Infinity : currentVolume / avgVolume;
      const candle = ohlcData[i];
      const bodySize = Math.abs(candle.close - candle.open);
      const upperWick = candle.high - Math.max(candle.open, candle.close);
      const lowerWick = Math.min(candle.open, candle.close) - candle.low;
      const hasAbsorption = Math.max(upperWick, lowerWick) > bodySize * 0.5;
      volumeAnalysis.push({
        ratio: volumeRatio,
        spike: volumeRatio >= 1.5,
        absorption: hasAbsorption,
        avgVolume: avgVolume,
      });
    }
    return volumeAnalysis;
  }
}

import { Component, inject, computed, signal } from '@angular/core';
import { StateService } from '../../services/state';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-execution-panel',

  imports: [CommonModule, FormsModule],
  templateUrl: './execution-panel.html',
  styleUrl: './execution-panel.scss',
})
export class ExecutionPanel {
  private state = inject(StateService);
  currentState = this.state.currentState;

  accountSize = signal(10000);
  riskPercent = signal(1);

  positionInfo = computed(() => {
    const accountSize = this.accountSize();
    const riskPercent = this.riskPercent();
    const { entry, stopLoss } = this.currentState().executionParams;
    const symbol = this.currentState().currentSymbol;

    const riskAmount = accountSize * (riskPercent / 100);

    if (entry === 0 || stopLoss === 0) {
      return {
        positionSizeCoin: 0,
        positionSizeInUSDT: 0,
        maxRisk: riskAmount,
        symbol: symbol.replace('USDT', ''),
      };
    }

    const riskPerUnit = Math.abs(entry - stopLoss);
    const positionSizeCoin = riskPerUnit > 0 ? riskAmount / riskPerUnit : 0;
    const positionSizeInUSDT = positionSizeCoin * entry;

    return {
      positionSizeCoin,
      positionSizeInUSDT,
      maxRisk: riskAmount,
      symbol: symbol.replace('USDT', ''),
    };
  });

  constructor() {}

  // Helper price formatter similar to original index.html logic
  formatPrice(price: number) {
    if (!price || isNaN(price)) return '$0.0000';
    if (price < 1) return `$${price.toFixed(4)}`;
    if (price < 100) return `$${price.toFixed(2)}`;
    return `$${Math.round(price).toLocaleString()}`;
  }

  // Trend tag derived from EMA stack
  trendTag = computed(() => {
    const s = this.currentState();
    const { ema8, ema21, ema50 } = s.indicators;
    const latest = ema8.length - 1;
    if (latest < 0)
      return {
        status: 'NEUTRAL',
        label: 'Neutrální',
        emoji: '⚠️',
        color: '#f59e0b',
      };
    const e8 = ema8[latest];
    const e21 = ema21[latest];
    const e50 = ema50[latest];
    if (e8 > e21 && e21 > e50) {
      return { status: 'BULL', label: 'Býčí', emoji: '🐂', color: '#22c55e' };
    } else if (e8 < e21 && e21 < e50) {
      return {
        status: 'BEAR',
        label: 'Medvědí',
        emoji: '🐻',
        color: '#ef4444',
      };
    }
    return {
      status: 'NEUTRAL',
      label: 'Neutrální',
      emoji: '⚠️',
      color: '#f59e0b',
    };
  });

  atrValue = computed(() => {
    const s = this.currentState();
    const atr = s.indicators.atr14[s.indicators.atr14.length - 1];
    return atr || 0;
  });

  // Individual text lines (kept simple & reactive)
  signalEntryText = computed(() => {
    const p = this.currentState().executionParams;
    return `Entry: ${this.formatPrice(p.entry)} | Směr: ${
      p.direction || 'NONE'
    } | Market: ${this.formatPrice(p.currentMarketPrice || 0)}`;
  });

  signalSLText = computed(() => {
    const p = this.currentState().executionParams;
    return `SL: ${this.formatPrice(p.stopLoss)} (≈1×ATR14)`;
  });

  signalTPText = computed(() => {
    const p = this.currentState().executionParams;
    return `TP1: ${this.formatPrice(p.tp1)} (1R) | TP2: ${this.formatPrice(
      p.tp2
    )} (2R)`;
  });

  signalTSText = computed(() => {
    const p = this.currentState().executionParams;
    const active = this.currentState().signalEngine === 'ENTRY';
    return `TS: ${this.formatPrice(p.trailingStop)} (0.5×ATR) aktivní: ${
      active ? 'true' : 'false'
    }`;
  });

  signalComment = computed(() => {
    const s = this.currentState();
    const gatesPassed = Object.entries(s.gates)
      .filter(([_, v]) => v)
      .map(([k]) => {
        switch (k) {
          case 'trendStack':
            return 'EMA';
          case 'bosDirection':
            return 'BOS';
          case 'fiftyPercentRetest':
            return '50%';
          case 'volumeSpike':
            return 'Volume';
          default:
            return k;
        }
      });

    let risk: string;
    if (s.signalEngine === 'NO_TRADE') risk = 'Žádné aktivní riziko';
    else if (gatesPassed.length < 4) risk = 'Standardní tržní riziko';
    else risk = 'Kontroluj volatilitu / news';

    if (gatesPassed.length === 0)
      return 'Důvod: Čekání na signál. Riziko: Žádné aktivní riziko.';
    if (gatesPassed.length === 4)
      return `Důvod: Všechny gates splněny (${gatesPassed.join(
        '/'
      )}). Riziko: ${risk}.`;
    return `Důvod: Částečný setup (${gatesPassed.join('/')}). Riziko: ${risk}.`;
  });

  onAccountSizeChange(value: string) {
    this.accountSize.set(Number(value));
  }

  onRiskPercentChange(value: string) {
    this.riskPercent.set(Number(value));
  }

  copyOrdersToClipboard() {
    const p = this.currentState().executionParams;
    const posInfo = this.positionInfo();
    const text = `
--- Crypto Scalper Pro Order ---
Direction: ${p.direction}
Symbol: ${this.currentState().currentSymbol}
Position Size: ${posInfo.positionSizeCoin.toFixed(4)} ${
      posInfo.symbol
    } (${posInfo.positionSizeInUSDT.toFixed(2)} USDT)
Max Risk: $${posInfo.maxRisk.toFixed(2)}

Entry: ${p.entry}
Stop Loss: ${p.stopLoss}
Take Profit 1: ${p.tp1}
Take Profit 2: ${p.tp2}
Trailing Stop: ${p.trailingStop}
---------------------------------
    `;
    navigator.clipboard
      .writeText(text.trim())
      .then(() => {
        this.state.addLog('success', `📋 Orders copied to clipboard.`);
      })
      .catch((err) => {
        this.state.addLog('error', 'Failed to copy orders.');
      });
  }
}

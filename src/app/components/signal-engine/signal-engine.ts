import { Component, inject } from '@angular/core';
import { StateService } from '../../services/state';
import { CommonModule } from '@angular/common';
import { ExecutionPanel } from '../execution-panel/execution-panel';

@Component({
  selector: 'app-signal-engine',

  imports: [CommonModule, ExecutionPanel],
  templateUrl: './signal-engine.html',
  styleUrl: './signal-engine.scss',
})
export class SignalEngine {
  private state = inject(StateService);
  currentState = this.state.currentState;

  getLatestNumericIndicator(
    indicator: 'ema8' | 'ema21' | 'ema50' | 'rsi14' | 'atr14'
  ): number | null {
    const indicatorArray = this.currentState().indicators[indicator];
    if (!indicatorArray || indicatorArray.length === 0) return null;
    return indicatorArray[indicatorArray.length - 1] as number;
  }

  getNumberOfValidGates(): number {
    const gates = this.currentState().gates;
    return Object.values(gates).filter((v) => v).length;
  }

  getNumberOfGates(): number {
    const gates = this.currentState().gates;
    return Object.values(gates).length;
  }

  generateTradingViewAlert() {
    const p = this.currentState().executionParams;
    const alertText = `
{
  "name": "Scalper Pro Alert: ${p.direction} ${
      this.currentState().currentSymbol
    }",
  "symbol": "${this.currentState().currentSymbol}",
  "side": "${p.direction === 'LONG' ? 'buy' : 'sell'}",
  "entry": "${p.entry}",
  "stop_loss": "${p.stopLoss}",
  "take_profit_1": "${p.tp1}",
  "take_profit_2": "${p.tp2}"
}
    `;
    const blob = new Blob([alertText.trim()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TV_Alert_${this.currentState().currentSymbol}_${new Date()
      .toISOString()
      .slice(0, 16)
      .replace('T', '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.state.addLog('success', '📺 TradingView alert JSON file generated.');
  }
}

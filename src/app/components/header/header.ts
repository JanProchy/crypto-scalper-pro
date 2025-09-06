import { Component, OnInit, OnDestroy, inject, effect } from '@angular/core';
import { SignalLogicService } from '../../services/signal-logic';
import { StateService } from '../../services/state';
import { CommonModule } from '@angular/common';
import { AppState } from '../../services/interfaces';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header implements OnInit, OnDestroy {
  private signalLogic = inject(SignalLogicService);
  private state = inject(StateService);

  private autoCalcInterval: any;

  currentState = this.state.currentState;

  constructor() {
    // Effect to react to autoCalculation changes
    effect(() => {
      const autoCalc = this.currentState().autoCalculation;
      if (autoCalc) {
        this.startAutoCalculation();
      } else {
        this.stopAutoCalculation();
      }
    });

    // Persist key parts of state when they change
    effect(() => {
      const { currentSymbol, currentTimeframe, autoCalculation } =
        this.currentState();
      try {
        localStorage.setItem(
          'csp.prefs',
          JSON.stringify({ currentSymbol, currentTimeframe, autoCalculation })
        );
      } catch {}
    });
  }

  ngOnInit() {
    // Hydrate from localStorage if available
    try {
      const raw = localStorage.getItem('csp.prefs');
      if (raw) {
        const prefs = JSON.parse(raw);
        this.state.updateState((s) => ({
          ...s,
          currentSymbol: prefs.currentSymbol || s.currentSymbol,
          currentTimeframe: prefs.currentTimeframe || s.currentTimeframe,
          autoCalculation:
            typeof prefs.autoCalculation === 'boolean'
              ? prefs.autoCalculation
              : s.autoCalculation,
        }));
      }
    } catch {}
    this.signalLogic.fetchDataAndRunPipeline();
  }

  ngOnDestroy() {
    this.stopAutoCalculation();
  }

  onSymbolChange(event: Event) {
    const symbol = (event.target as HTMLSelectElement).value;
    this.state.setCurrentSymbol(symbol);
    this.signalLogic.fetchDataAndRunPipeline();
  }

  onTimeframeChange(event: Event) {
    const timeframe = (event.target as HTMLButtonElement).value;
    this.state.setCurrentTimeframe(timeframe);
    this.signalLogic.fetchDataAndRunPipeline();
  }

  toggleAutoCalc() {
    this.state.updateState((s) => ({
      ...s,
      autoCalculation: !s.autoCalculation,
    }));
  }

  private startAutoCalculation() {
    if (this.autoCalcInterval) return; // Already running
    this.state.addLog('info', '🤖 Auto-calculation started.');
    this.autoCalcInterval = setInterval(() => {
      this.signalLogic.fetchDataAndRunPipeline();
    }, 90_000); // 15 seconds
  }

  private stopAutoCalculation() {
    if (this.autoCalcInterval) {
      clearInterval(this.autoCalcInterval);
      this.autoCalcInterval = null;
      this.state.addLog('info', '⏸️ Auto-calculation stopped.');
    }
  }

  // validateIndicators() {
  //   this.state.addLog('info', 'Validation logic to be implemented.');
  // }

  fetchData() {
    this.signalLogic.fetchDataAndRunPipeline();
  }
}

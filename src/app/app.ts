import { Component, signal } from '@angular/core';
import { Header } from './components/header/header';
import { Chart } from './components/chart/chart';
import { IndicatorsPanel } from './components/indicators-panel/indicators-panel';
import { SignalEngine } from './components/signal-engine/signal-engine';
import { PerformancePanel } from './components/performance-panel/performance-panel';

@Component({
  selector: 'app-root',

  imports: [Header, Chart, IndicatorsPanel, SignalEngine, PerformancePanel],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly title = signal('crypto-scalper-pro-ng');
}

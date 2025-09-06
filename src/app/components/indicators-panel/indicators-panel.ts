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
import { VolumeAnalysis, Indicators } from '../../services/interfaces';

@Component({
  selector: 'app-indicators-panel',

  imports: [CommonModule],
  templateUrl: './indicators-panel.html',
  styleUrl: './indicators-panel.scss',
})
export class IndicatorsPanel {
  state = inject(StateService);
  currentState = this.state.currentState;
  @ViewChild('calcLog') calcLog?: ElementRef<HTMLDivElement>;

  constructor() {
    effect(() => {
      const len = this.currentState().logs.length;
      if (this.calcLog && len) {
        queueMicrotask(() => {
          try {
            const el = this.calcLog!.nativeElement;
            el.scrollTop = el.scrollHeight;
          } catch {}
        });
      }
    });
  }

  getLatestNumericIndicator(
    indicator: 'ema8' | 'ema21' | 'ema50' | 'rsi14' | 'atr14'
  ): number | null {
    const indicatorArray = this.currentState().indicators[indicator];
    if (!indicatorArray || indicatorArray.length === 0) return null;
    return indicatorArray[indicatorArray.length - 1] as number;
  }

  getLatestVolume(): VolumeAnalysis | null {
    const volumeAnalysis = this.currentState().indicators.volume;
    if (!volumeAnalysis || volumeAnalysis.length === 0) return null;
    return volumeAnalysis[volumeAnalysis.length - 1];
  }
}

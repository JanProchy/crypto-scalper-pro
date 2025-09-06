import {
  Component,
  inject,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  effect,
  ChangeDetectorRef,
} from '@angular/core';
import { StateService } from '../../services/state';
import { CommonModule } from '@angular/common';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  LineData,
  CandlestickData,
  UTCTimestamp,
  ColorType,
  HistogramData,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  LogicalRange,
} from 'lightweight-charts';
import { OhlcvData } from '../../services/interfaces';
import { SignalLogicService } from '../../services/signal-logic';

@Component({
  selector: 'app-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chart.html',
  styleUrl: './chart.scss',
})
export class Chart implements AfterViewInit, OnDestroy {
  state = inject(StateService);
  private signalLogic = inject(SignalLogicService);
  private cdr = inject(ChangeDetectorRef);

  @ViewChild('chartContainer') chartContainer!: ElementRef;

  private chart!: IChartApi;
  private candlestickSeries!: ISeriesApi<'Candlestick'>;
  private ema8Series!: ISeriesApi<'Line'>;
  private ema21Series!: ISeriesApi<'Line'>;
  private ema50Series!: ISeriesApi<'Line'>;
  private volumeSeries!: ISeriesApi<'Histogram'>;
  private lastLogicalRange: LogicalRange | null = null;
  private wasAtRightEdge = true;
  private previousDataLength = 0;
  private lastSymbol = '';
  private lastTimeframe = '';

  currentState = this.state.currentState;

  constructor() {
    // Efekt musí PŘEČÍST signál vždy, jinak se nenasubscribuje.
    effect(() => {
      const st = this.currentState(); // tracking dependency
      if (this.chart && st.ohlcvData.length) {
        const symbolChanged =
          st.currentSymbol !== this.lastSymbol ||
          st.currentTimeframe !== this.lastTimeframe;
        this.updateChartData(symbolChanged);
        this.lastSymbol = st.currentSymbol;
        this.lastTimeframe = st.currentTimeframe;
      }
    });
  }

  ngAfterViewInit() {
    this.initializeChart();
    this.cdr.detectChanges(); // Manually trigger change detection
  }

  ngOnDestroy() {
    if (this.chart) {
      this.chart.remove();
    }
  }

  onTimeframeChange(timeframe: string) {
    this.state.setCurrentTimeframe(timeframe);
    this.signalLogic.fetchDataAndRunPipeline();
  }

  private initializeChart() {
    if (!this.chartContainer.nativeElement) return;

    this.chart = createChart(this.chartContainer.nativeElement, {
      width: this.chartContainer.nativeElement.clientWidth,
      height: 400, // Initial height
      layout: {
        background: { type: ColorType.Solid, color: '#131722' },
        textColor: 'rgba(255, 255, 255, 0.9)',
      },
      grid: {
        vertLines: { color: 'rgba(197, 203, 206, 0.1)' },
        horzLines: { color: 'rgba(197, 203, 206, 0.1)' },
      },
      crosshair: {
        mode: 1, // Magnet
      },
      rightPriceScale: {
        borderColor: 'rgba(197, 203, 206, 0.4)',
      },
      timeScale: {
        borderColor: 'rgba(197, 203, 206, 0.4)',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    // V5 API: univerzální addSeries(definition, options)
    this.candlestickSeries = this.chart.addSeries(CandlestickSeries, {
      upColor: '#0354b6ff',
      downColor: '#fff',
      borderDownColor: '#fff',
      borderUpColor: '#0354b6ff',
      wickDownColor: '#fff',
      wickUpColor: '#0354b6ff',
    });

    this.ema8Series = this.chart.addSeries(LineSeries, {
      color: '#22c55e',
      lineWidth: 2,
      crosshairMarkerVisible: false,
    });
    this.ema21Series = this.chart.addSeries(LineSeries, {
      color: '#FF6D00',
      lineWidth: 2,
      crosshairMarkerVisible: false,
    });
    this.ema50Series = this.chart.addSeries(LineSeries, {
      color: '#E91E63',
      lineWidth: 2,
      crosshairMarkerVisible: false,
    });

    this.volumeSeries = this.chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: '', // overlay
    });
    this.chart.priceScale('').applyOptions({
      scaleMargins: {
        top: 0.8, // 80% away from the top
        bottom: 0,
      },
    });

    // Po vytvoření sérií zkusíme hned vykreslit aktuální data (pokud už jsou ve state)
  this.updateChartData(true); // initial fit

    // Handle resize
    new ResizeObserver((entries) => {
      if (
        entries.length === 0 ||
        entries[0].target !== this.chartContainer.nativeElement
      ) {
        return;
      }
      const newRect = entries[0].contentRect;
      this.chart.applyOptions({ width: newRect.width, height: newRect.height });
    }).observe(this.chartContainer.nativeElement);
  }

  private updateChartData(resetViewport = false) {
    const ohlcv = this.currentState().ohlcvData;
    const indicators = this.currentState().indicators;
    if (ohlcv.length === 0) return;

    // Capture current viewport BEFORE updating if not a hard reset
    if (!resetViewport) {
      const ts = this.chart.timeScale();
      const range = ts.getVisibleLogicalRange();
      if (range) {
        this.lastLogicalRange = range;
        const currentRightIndex = range.to;
        const totalRightIndex = this.previousDataLength - 1;
        this.wasAtRightEdge = Math.abs(totalRightIndex - currentRightIndex) < 1; // ~pinned to right
      }
    }

    const oldLength = this.previousDataLength;
    const candleData: CandlestickData[] = ohlcv.map((d) => ({
      time: (d.time / 1000) as UTCTimestamp,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));
    this.candlestickSeries.setData(candleData);

    const mapToLineData = (
      data: number[],
      ohlcvData: OhlcvData[]
    ): LineData[] => {
      const offset = ohlcvData.length - data.length;
      return data.map((value, index) => ({
        time: (ohlcvData[index + offset].time / 1000) as UTCTimestamp,
        value,
      }));
    };

    this.ema8Series.setData(mapToLineData(indicators.ema8, ohlcv));
    this.ema21Series.setData(mapToLineData(indicators.ema21, ohlcv));
    this.ema50Series.setData(mapToLineData(indicators.ema50, ohlcv));

    const volumeData: HistogramData[] = ohlcv.map((d) => {
      const isUp = d.close >= d.open;
      return {
        time: (d.time / 1000) as UTCTimestamp,
        value: d.volume,
        color: isUp ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)',
      };
    });
    this.volumeSeries.setData(volumeData);

    const newLength = ohlcv.length;
    this.previousDataLength = newLength;

    const ts = this.chart.timeScale();
    if (resetViewport || !this.lastLogicalRange) {
      ts.fitContent();
      return;
    }

    // Adjust logical range if data length changed (append scenario)
    if (!resetViewport && oldLength > 0) {
      const delta = newLength - oldLength;
      let from = this.lastLogicalRange.from + delta;
      let to = this.lastLogicalRange.to + delta;
      // If user was at right edge keep anchoring to real time
      if (this.wasAtRightEdge) {
        ts.scrollToRealTime();
      } else {
        // Clamp range within bounds
        const maxRight = newLength - 1;
        const minLeft = 0;
        if (from < minLeft) {
          to += Math.abs(from - minLeft);
          from = minLeft;
        }
        if (to > maxRight) {
          const shift = to - maxRight;
            from -= shift;
            to = maxRight;
        }
        ts.setVisibleLogicalRange({ from, to });
      }
    }
  }
}

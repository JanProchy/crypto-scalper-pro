import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, retry } from 'rxjs/operators';
import { OhlcvData } from './interfaces';
import { StateService } from './state';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private readonly BYBIT_KLINE_URL = 'https://api.bybit.com/v5/market/kline';
  private readonly BYBIT_CONFIG = {
    intervals: {
      '1m': '1',
      '3m': '3',
      '5m': '5',
      '15m': '15',
      '1h': '60',
    } as { [key: string]: string },
    maxRetries: 2,
  };

  constructor(private http: HttpClient, private state: StateService) {}

  fetchBybitData(
    symbol: string,
    timeframe: string,
    limit = 200
  ): Observable<OhlcvData[]> {
    const interval = this.BYBIT_CONFIG.intervals[timeframe] || '5';
    const category = 'linear';
    const url = `${this.BYBIT_KLINE_URL}?category=${category}&symbol=${symbol}&interval=${interval}&limit=${limit}`;

    this.state.addLog(
      'info',
      `📡 Fetching ${symbol} ${timeframe} from Bybit...`
    );

    return this.http.get<any>(url).pipe(
      retry(this.BYBIT_CONFIG.maxRetries),
      map((data) => {
        if (data.retCode !== 0) {
          throw new Error(`Bybit API Error: ${data.retMsg || 'Unknown error'}`);
        }
        if (
          !data.result ||
          !data.result.list ||
          !Array.isArray(data.result.list) ||
          data.result.list.length === 0
        ) {
          throw new Error('Invalid or empty data from Bybit API');
        }

        const ohlcvData = data.result.list
          .map((candle: (string | number)[]) => {
            const [time, open, high, low, close, volume] = candle.map((v) =>
              parseFloat(String(v))
            );
            if ([time, open, high, low, close, volume].some(isNaN)) {
              return null;
            }
            return { time, open, high, low, close, volume };
          })
          .filter((d: OhlcvData | null): d is OhlcvData => d !== null)
          .sort((a: OhlcvData, b: OhlcvData) => a.time - b.time);

        if (ohlcvData.length < 50) {
          throw new Error(
            `Insufficient data: only ${ohlcvData.length} valid candles`
          );
        }

        this.state.addLog(
          'success',
          `✅ Loaded ${ohlcvData.length} candles for ${symbol}`
        );
        return ohlcvData as OhlcvData[];
      }),
      catchError((err) => {
        this.state.addLog('error', `❌ API Error: ${err.message}`);
        return throwError(() => new Error(err.message));
      })
    );
  }
}

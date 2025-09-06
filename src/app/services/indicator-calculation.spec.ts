import { TestBed } from '@angular/core/testing';

import { IndicatorCalculation } from './indicator-calculation';

describe('IndicatorCalculation', () => {
  let service: IndicatorCalculation;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(IndicatorCalculation);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

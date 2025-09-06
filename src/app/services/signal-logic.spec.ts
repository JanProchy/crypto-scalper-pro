import { TestBed } from '@angular/core/testing';

import { SignalLogic } from './signal-logic';

describe('SignalLogic', () => {
  let service: SignalLogic;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SignalLogic);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

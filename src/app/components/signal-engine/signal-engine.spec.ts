import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SignalEngine } from './signal-engine';

describe('SignalEngine', () => {
  let component: SignalEngine;
  let fixture: ComponentFixture<SignalEngine>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SignalEngine]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SignalEngine);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PerformancePanel } from './performance-panel';

describe('PerformancePanel', () => {
  let component: PerformancePanel;
  let fixture: ComponentFixture<PerformancePanel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PerformancePanel]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PerformancePanel);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IndicatorsPanel } from './indicators-panel';

describe('IndicatorsPanel', () => {
  let component: IndicatorsPanel;
  let fixture: ComponentFixture<IndicatorsPanel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IndicatorsPanel]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IndicatorsPanel);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExecutionPanel } from './execution-panel';

describe('ExecutionPanel', () => {
  let component: ExecutionPanel;
  let fixture: ComponentFixture<ExecutionPanel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExecutionPanel]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ExecutionPanel);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

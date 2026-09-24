import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ReportPeriodFilter } from './reports.service';

@Component({
  selector: 'app-report-period-filter',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <form class="report-period-filter" (ngSubmit)="apply()" aria-label="فلترة التقارير حسب الفترة">
      <label>
        الشهر
        <input
          type="number"
          name="reportMonth"
          min="1"
          max="12"
          [(ngModel)]="draftMonth"
          placeholder="اختياري"
        />
      </label>

      <label>
        السنة
        <input
          type="number"
          name="reportYear"
          min="2020"
          [(ngModel)]="draftYear"
          placeholder="اختياري"
        />
      </label>

      <div class="filter-actions">
        <button type="submit">تطبيق الشهر والسنة</button>
        <button type="button" class="ghost-button" (click)="clear()">مسح</button>
      </div>
    </form>
  `,
  styles: `
    :host {
      display: block;
    }

    .report-period-filter {
      display: grid;
      grid-template-columns: repeat(2, minmax(140px, 1fr)) auto;
      gap: 14px;
      align-items: end;
      border: 1px solid #ead7d7;
      border-radius: 18px;
      padding: 16px;
      background: #fbfdfb;
    }

    label {
      display: flex;
      flex-direction: column;
      gap: 7px;
      color: #425149;
      font-weight: 800;
    }

    input {
      width: 100%;
      min-height: 42px;
      box-sizing: border-box;
      border: 1px solid #cbd8d1;
      border-radius: 20px;
      padding: 9px 11px;
      background: #fbfdfb;
      color: #17241f;
      text-align: right;
      font: inherit;
      font-size: 0.9rem;
      font-weight: 800;
    }

    input:focus {
      border-color: #b91c1c;
      outline: 3px solid rgba(185, 28, 28, 0.14);
    }

    .filter-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    button {
      min-height: 42px;
      width: auto;
      margin: 0;
      border: 0;
      border-radius: 20px;
      padding: 0 18px;
      background: linear-gradient(135deg, #b91c1c, #7f1d1d);
      color: #ffffff;
      font: inherit;
      font-weight: 800;
      cursor: pointer;
    }

    .ghost-button {
      border: 1px solid #d7c5c5;
      background: #ffffff;
      color: #7f1d1d;
    }

    @media (max-width: 760px) {
      .report-period-filter {
        grid-template-columns: 1fr;
      }

      .filter-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
      }

      button {
        width: 100%;
      }
    }
  `,
})
export class ReportPeriodFilterComponent {
  @Output() readonly filtersApplied = new EventEmitter<ReportPeriodFilter>();

  draftMonth: number | null = null;
  draftYear: number | null = null;

  @Input() set value(filters: ReportPeriodFilter) {
    this.draftMonth = filters.month;
    this.draftYear = filters.year;
  }

  apply(): void {
    this.filtersApplied.emit({
      month: this.normalizeMonth(this.draftMonth),
      year: this.normalizeYear(this.draftYear),
    });
  }

  clear(): void {
    this.draftMonth = null;
    this.draftYear = null;
    this.filtersApplied.emit({ month: null, year: null });
  }

  private normalizeMonth(month: number | null): number | null {
    const value = Number(month);

    return Number.isInteger(value) && value >= 1 && value <= 12 ? value : null;
  }

  private normalizeYear(year: number | null): number | null {
    const value = Number(year);

    return Number.isInteger(value) && value > 0 ? value : null;
  }
}

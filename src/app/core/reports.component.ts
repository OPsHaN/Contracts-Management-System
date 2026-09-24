import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, WritableSignal, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subject, catchError, finalize, of, switchMap, tap } from 'rxjs';

import { AgingReport, CompanyBalance, CompanyDto, TotalBalance, UpcomingDueCheque } from './api.models';
import { AuthService } from './auth.service';
import { CompaniesService } from './companies.service';
import { ReportPeriodFilterComponent } from './report-period-filter.component';
import { ReportPeriodFilter, ReportsService, extractReportErrorMessage } from './reports.service';

interface SectionError {
  message: string;
  isAccessDenied: boolean;
}

interface CompanyReportQuery {
  companyName: string;
  filters: ReportPeriodFilter;
}

interface TopDebtorsQuery {
  top: number;
  filters: ReportPeriodFilter;
}

interface UpcomingDueQuery {
  days: number;
  filters: ReportPeriodFilter;
}

type ReportTab = 'total' | 'company' | 'aging' | 'debtors' | 'upcoming';

const TOP_DEBTOR_OPTIONS = [5, 10, 20] as const;
const UPCOMING_DAYS_OPTIONS = [7, 14, 30, 60] as const;

/**
 * Financial reports dashboard for a logged-in Pharmacy user.
 *
 * There is no query/state-management library in this project (no
 * TanStack Query, no NgRx) — state here follows the same pattern already
 * used in AppComponent: signals for state, RxJS for the actual HTTP flow.
 * Each of the five sections owns its own trigger Subject piped through
 * switchMap, so a refetch automatically cancels/ignores that section's own
 * stale in-flight request, and one section's failure never touches another
 * section's signals (each has its own loading/error/data signals).
 */
@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, ReportPeriodFilterComponent],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss',
})
export class ReportsComponent {
  private readonly reportsService = inject(ReportsService);
  private readonly companiesService = inject(CompaniesService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly topOptions = TOP_DEBTOR_OPTIONS;
  readonly daysOptions = UPCOMING_DAYS_OPTIONS;
  readonly reportPeriodFilter = signal<ReportPeriodFilter>({ month: null, year: null });
  readonly reportTabs: { key: ReportTab; label: string }[] = [
    { key: 'total', label: 'إجمالي الأرصدة' },
    { key: 'company', label: 'رصيد شركة' },
    { key: 'aging', label: 'أعمار الديون' },
    { key: 'debtors', label: 'أكبر المديونيات' },
    { key: 'upcoming', label: 'الشيكات المستحقة' },
  ];
  readonly activeReportTab = signal<ReportTab>('total');

  // ---- Companies (shared selector source for company-balance & aging) ----
  // Reuses the existing CompaniesService rather than a new/hardcoded list.
  // getCompanies() is paginated with a default pageSize of 10; a page size
  // of 500 is requested here to approximate "all companies" for a select
  // control. If the pharmacy has more than 500 contracted companies this
  // will silently miss some — flagged in the final report as a caveat
  // rather than guessing at a "get all" endpoint that wasn't specified.
  readonly companies = signal<CompanyDto[]>([]);
  readonly companiesLoading = signal(false);
  readonly companyNames = computed(() =>
    Array.from(new Set(this.companies().map((company) => company.name)))
      .filter(Boolean)
      .sort((first, second) => first.localeCompare(second, 'ar')),
  );

  // ---- Total balance ----
  readonly totalBalance = signal<TotalBalance | null>(null);
  readonly totalBalanceLoading = signal(false);
  readonly totalBalanceError = signal<SectionError | null>(null);
  private readonly totalBalanceTrigger$ = new Subject<ReportPeriodFilter>();

  // ---- Company balance (loaded only after a company is selected) ----
  readonly selectedBalanceCompany = signal('');
  readonly companyBalance = signal<CompanyBalance | null>(null);
  readonly companyBalanceLoading = signal(false);
  readonly companyBalanceError = signal<SectionError | null>(null);
  private readonly companyBalanceTrigger$ = new Subject<CompanyReportQuery>();

  // ---- Aging report ----
  readonly agingCompanyFilter = signal('');
  readonly aging = signal<AgingReport | null>(null);
  readonly agingLoading = signal(false);
  readonly agingError = signal<SectionError | null>(null);
  private readonly agingTrigger$ = new Subject<CompanyReportQuery>();

  // ---- Top debtors ----
  readonly topCount = signal<number>(10);
  readonly topDebtors = signal<CompanyBalance[]>([]);
  readonly topDebtorsLoading = signal(false);
  readonly topDebtorsError = signal<SectionError | null>(null);
  private readonly topDebtorsTrigger$ = new Subject<TopDebtorsQuery>();

  // ---- Upcoming due cheques ----
  readonly upcomingDays = signal<number>(7);
  readonly upcomingDue = signal<UpcomingDueCheque[]>([]);
  readonly upcomingLoading = signal(false);
  readonly upcomingError = signal<SectionError | null>(null);
  private readonly upcomingTrigger$ = new Subject<UpcomingDueQuery>();

  readonly totalOutstanding = computed(() => this.aging()?.totalOutstanding ?? null);
  readonly maxDebtorBalance = computed(() =>
    Math.max(...this.topDebtors().map((debtor) => debtor.balance), 0),
  );

  constructor() {
    this.reportPeriodFilter.set(this.readPeriodFilterFromUrl());
    this.activeReportTab.set(this.readReportTabFromUrl());
    this.wireTotalBalance();
    this.wireCompanyBalance();
    this.wireAging();
    this.wireTopDebtors();
    this.wireUpcomingDue();
    this.loadCompanies();

    // Initial independent loads. Company balance is intentionally excluded:
    // per spec it must not fire until the pharmacy selects a company.
    this.refetchReports();

    const handlePopState = () => {
      this.reportPeriodFilter.set(this.readPeriodFilterFromUrl());
      this.activeReportTab.set(this.readReportTabFromUrl());
      this.refetchReports();
    };
    window.addEventListener('popstate', handlePopState);
    this.destroyRef.onDestroy(() => window.removeEventListener('popstate', handlePopState));
  }

  // ---------------- Stream wiring ----------------

  private loadCompanies(): void {
    this.companiesLoading.set(true);
    this.companiesService
      .getCompanies(1, 500)
      .pipe(
        finalize(() => this.companiesLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (page) => this.companies.set(page.items),
        // The company selector is a convenience for two sections, not a
        // report itself: a failure here should not block or hide the
        // report sections above/below it, so it's swallowed rather than
        // surfaced as a blocking section error. The selects simply show
        // no companies, and the user can still use "All companies" for
        // aging or retry by reloading the page.
        error: () => this.companies.set([]),
      });
  }

  private wireTotalBalance(): void {
    this.totalBalanceTrigger$
      .pipe(
        tap(() => {
          this.totalBalanceLoading.set(true);
          this.totalBalanceError.set(null);
        }),
        switchMap((filters) =>
          this.reportsService.getTotalBalance(filters).pipe(
            tap((value) => this.totalBalance.set(value)),
            catchError((error: HttpErrorResponse) => {
              this.handleSectionError(error, this.totalBalanceError);
              return of(null);
            }),
            finalize(() => this.totalBalanceLoading.set(false)),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private wireCompanyBalance(): void {
    this.companyBalanceTrigger$
      .pipe(
        tap(() => {
          this.companyBalanceLoading.set(true);
          this.companyBalanceError.set(null);
        }),
        // switchMap cancels a still-in-flight company-balance request if the
        // pharmacy picks a different company before the first one resolves.
        switchMap((query) =>
          this.reportsService.getCompanyBalance(query.companyName, query.filters).pipe(
            tap((value) => this.companyBalance.set(value)),
            catchError((error: HttpErrorResponse) => {
              this.handleSectionError(error, this.companyBalanceError);
              return of(null);
            }),
            finalize(() => this.companyBalanceLoading.set(false)),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private wireAging(): void {
    this.agingTrigger$
      .pipe(
        tap(() => {
          this.agingLoading.set(true);
          this.agingError.set(null);
        }),
        switchMap((query) =>
          this.reportsService.getAgingReport(query.companyName || undefined, query.filters).pipe(
            tap((value) => this.aging.set(value)),
            catchError((error: HttpErrorResponse) => {
              this.handleSectionError(error, this.agingError);
              return of(null);
            }),
            finalize(() => this.agingLoading.set(false)),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private wireTopDebtors(): void {
    this.topDebtorsTrigger$
      .pipe(
        tap(() => {
          this.topDebtorsLoading.set(true);
          this.topDebtorsError.set(null);
        }),
        switchMap((query) =>
          this.reportsService.getTopDebtors(query.top, query.filters).pipe(
            tap((value) => this.topDebtors.set(value)),
            catchError((error: HttpErrorResponse) => {
              this.handleSectionError(error, this.topDebtorsError);
              return of(null);
            }),
            finalize(() => this.topDebtorsLoading.set(false)),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private wireUpcomingDue(): void {
    this.upcomingTrigger$
      .pipe(
        tap(() => {
          this.upcomingLoading.set(true);
          this.upcomingError.set(null);
        }),
        switchMap((query) =>
          this.reportsService.getUpcomingDue(query.days, query.filters).pipe(
            tap((value) => this.upcomingDue.set(value)),
            catchError((error: HttpErrorResponse) => {
              this.handleSectionError(error, this.upcomingError);
              return of(null);
            }),
            finalize(() => this.upcomingLoading.set(false)),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  /**
   * Shared error handling for every section. A 401 means the token is
   * invalid/expired: end the session via the app's existing logout flow
   * (AuthService.logout — same one the top bar's "تسجيل الخروج" button
   * calls). A 403 is surfaced as an access-denied state scoped to that one
   * section. Anything else becomes a user-facing message. Each section has
   * its own signal, so this never touches a different section's state.
   */
  private handleSectionError(
    error: HttpErrorResponse,
    target: WritableSignal<SectionError | null>,
  ): void {
    if (error.status === 401) {
      this.authService.logout();
      target.set({
        message: 'انتهت صلاحية الجلسة. برجاء تسجيل الدخول مرة أخرى.',
        isAccessDenied: false,
      });
      return;
    }

    if (error.status === 403) {
      target.set({
        message: 'ليس لديك صلاحية للوصول إلى هذا التقرير.',
        isAccessDenied: true,
      });
      return;
    }

    target.set({ message: extractReportErrorMessage(error), isAccessDenied: false });
  }

  // ---------------- User actions ----------------

  retryTotalBalance(): void {
    this.totalBalanceTrigger$.next(this.currentPeriodFilter());
  }

  selectBalanceCompany(companyName: string): void {
    this.selectedBalanceCompany.set(companyName);

    if (!companyName) {
      this.companyBalance.set(null);
      this.companyBalanceError.set(null);
      return;
    }

    this.companyBalanceTrigger$.next({
      companyName,
      filters: this.currentPeriodFilter(),
    });
  }

  clearBalanceCompany(): void {
    this.selectedBalanceCompany.set('');
    this.companyBalance.set(null);
    this.companyBalanceError.set(null);
  }

  retryCompanyBalance(): void {
    const companyName = this.selectedBalanceCompany();

    if (companyName) {
      this.companyBalanceTrigger$.next({
        companyName,
        filters: this.currentPeriodFilter(),
      });
    }
  }

  setAgingCompanyFilter(companyName: string): void {
    this.agingCompanyFilter.set(companyName);
    this.agingTrigger$.next({
      companyName,
      filters: this.currentPeriodFilter(),
    });
  }

  retryAging(): void {
    this.agingTrigger$.next({
      companyName: this.agingCompanyFilter(),
      filters: this.currentPeriodFilter(),
    });
  }

  setTopCount(top: number): void {
    this.topCount.set(top);
    this.topDebtorsTrigger$.next({
      top,
      filters: this.currentPeriodFilter(),
    });
  }

  retryTopDebtors(): void {
    this.topDebtorsTrigger$.next({
      top: this.topCount(),
      filters: this.currentPeriodFilter(),
    });
  }

  setUpcomingDays(days: number): void {
    this.upcomingDays.set(days);
    this.upcomingTrigger$.next({
      days,
      filters: this.currentPeriodFilter(),
    });
  }

  retryUpcomingDue(): void {
    this.upcomingTrigger$.next({
      days: this.upcomingDays(),
      filters: this.currentPeriodFilter(),
    });
  }

  applyReportPeriodFilter(filters: ReportPeriodFilter): void {
    this.reportPeriodFilter.set(filters);
    this.writePeriodFilterToUrl(filters);
    this.refetchReports();
  }

  selectReportTab(tab: ReportTab): void {
    this.activeReportTab.set(tab);
    const url = new URL(window.location.href);

    if (tab === 'total') {
      url.searchParams.delete('reportTab');
    } else {
      url.searchParams.set('reportTab', tab);
    }

    window.history.pushState({}, '', url);
  }

  // ---------------- Display helpers ----------------

  /**
   * Uses the same Egyptian pound suffix as the rest of the app while keeping
   * two decimal places for report values returned as financial decimals.
   */
  formatMoney(value: number): string {
    const formatted = new Intl.NumberFormat('ar-EG-u-nu-arab', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

    return `${formatted} ج.م`;
  }

  formatInteger(value: number): string {
    return new Intl.NumberFormat('ar-EG-u-nu-arab', {
      maximumFractionDigits: 0,
    }).format(value);
  }

  formatArabicDigits(value: string | number): string {
    const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

    return String(value).replace(/\d/g, (digit) => arabicDigits[Number(digit)]);
  }

  formatReportDate(value: string): string {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return '-';
    }

    return new Intl.DateTimeFormat('ar-EG-u-nu-arab', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }

  chequePaidAmount(cheque: UpcomingDueCheque): number {
    return cheque.paidAmount ?? cheque.amount;
  }

  balancePercent(balance: number): number {
    const maxBalance = this.maxDebtorBalance();

    if (!maxBalance) {
      return 0;
    }

    return Math.max(4, Math.round((balance / maxBalance) * 100));
  }

  agingPercent(value: number, total: number): number {
    if (!total) {
      return 0;
    }

    return Math.round((value / total) * 100);
  }

  /**
   * Days remaining until endDate, based on the *local calendar date* on
   * both sides (not elapsed hours): a cheque due "today" always reads 0
   * regardless of what time it currently is. Date's non-UTC getters
   * (getFullYear/getMonth/getDate) already return local values, so no
   * timezone math is needed beyond stripping the time-of-day component.
   */
  daysRemaining(endDate: string): number {
    const end = new Date(endDate);
    const endLocalMidnight = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    const today = new Date();
    const todayLocalMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const msPerDay = 24 * 60 * 60 * 1000;

    return Math.round((endLocalMidnight.getTime() - todayLocalMidnight.getTime()) / msPerDay);
  }

  displayChequeStatus(status: string): string {
    const labels: Record<string, string> = {
      Pending: 'قيد الانتظار',
      PaidInFull: 'مدفوع بالكامل',
      PartiallyPaid: 'مدفوع جزئيًا',
    };

    return labels[status] ?? status;
  }

  private refetchReports(): void {
    const filters = this.currentPeriodFilter();
    this.totalBalanceTrigger$.next(filters);
    this.agingTrigger$.next({
      companyName: this.agingCompanyFilter(),
      filters,
    });
    this.topDebtorsTrigger$.next({
      top: this.topCount(),
      filters,
    });
    this.upcomingTrigger$.next({
      days: this.upcomingDays(),
      filters,
    });

    const companyName = this.selectedBalanceCompany();

    if (companyName) {
      this.companyBalanceTrigger$.next({ companyName, filters });
    }
  }

  private currentPeriodFilter(): ReportPeriodFilter {
    const filters = this.reportPeriodFilter();

    return { month: filters.month, year: filters.year };
  }

  private readPeriodFilterFromUrl(): ReportPeriodFilter {
    const params = new URLSearchParams(window.location.search);
    const month = this.parseMonth(params.get('month'));
    const year = this.parseYear(params.get('year'));

    return { month, year };
  }

  private writePeriodFilterToUrl(filters: ReportPeriodFilter): void {
    const url = new URL(window.location.href);

    if (filters.month) {
      url.searchParams.set('month', String(filters.month));
    } else {
      url.searchParams.delete('month');
    }

    if (filters.year) {
      url.searchParams.set('year', String(filters.year));
    } else {
      url.searchParams.delete('year');
    }

    window.history.pushState({}, '', url);
  }

  private parseMonth(value: string | null): number | null {
    const month = Number(value);

    return Number.isInteger(month) && month >= 1 && month <= 12 ? month : null;
  }

  private parseYear(value: string | null): number | null {
    const year = Number(value);

    return Number.isInteger(year) && year > 0 ? year : null;
  }

  private readReportTabFromUrl(): ReportTab {
    const value = new URLSearchParams(window.location.search).get('reportTab');
    const validTabs: ReportTab[] = ['total', 'company', 'aging', 'debtors', 'upcoming'];

    return validTabs.includes(value as ReportTab) ? (value as ReportTab) : 'total';
  }
}

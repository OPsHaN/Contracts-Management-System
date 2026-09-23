import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, WritableSignal, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subject, catchError, distinctUntilChanged, finalize, of, switchMap, tap } from 'rxjs';

import { AgingReport, CompanyBalance, CompanyDto, TotalBalance, UpcomingDueCheque } from './api.models';
import { AuthService } from './auth.service';
import { CompaniesService } from './companies.service';
import { ReportsService, extractReportErrorMessage } from './reports.service';

interface SectionError {
  message: string;
  isAccessDenied: boolean;
}

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
  imports: [CommonModule, FormsModule],
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
  private readonly totalBalanceTrigger$ = new Subject<void>();

  // ---- Company balance (loaded only after a company is selected) ----
  readonly selectedBalanceCompany = signal('');
  readonly companyBalance = signal<CompanyBalance | null>(null);
  readonly companyBalanceLoading = signal(false);
  readonly companyBalanceError = signal<SectionError | null>(null);
  private readonly companyBalanceTrigger$ = new Subject<string>();

  // ---- Aging report ----
  readonly agingCompanyFilter = signal('');
  readonly aging = signal<AgingReport | null>(null);
  readonly agingLoading = signal(false);
  readonly agingError = signal<SectionError | null>(null);
  private readonly agingTrigger$ = new Subject<string>();

  // ---- Top debtors ----
  readonly topCount = signal<number>(10);
  readonly topDebtors = signal<CompanyBalance[]>([]);
  readonly topDebtorsLoading = signal(false);
  readonly topDebtorsError = signal<SectionError | null>(null);
  private readonly topDebtorsTrigger$ = new Subject<number>();

  // ---- Upcoming due cheques ----
  readonly upcomingDays = signal<number>(7);
  readonly upcomingDue = signal<UpcomingDueCheque[]>([]);
  readonly upcomingLoading = signal(false);
  readonly upcomingError = signal<SectionError | null>(null);
  private readonly upcomingTrigger$ = new Subject<number>();

  readonly totalOutstanding = computed(() => this.aging()?.totalOutstanding ?? null);
  readonly maxDebtorBalance = computed(() =>
    Math.max(...this.topDebtors().map((debtor) => debtor.balance), 0),
  );

  constructor() {
    this.wireTotalBalance();
    this.wireCompanyBalance();
    this.wireAging();
    this.wireTopDebtors();
    this.wireUpcomingDue();
    this.loadCompanies();

    // Initial independent loads. Company balance is intentionally excluded:
    // per spec it must not fire until the pharmacy selects a company.
    this.totalBalanceTrigger$.next();
    this.agingTrigger$.next('');
    this.topDebtorsTrigger$.next(this.topCount());
    this.upcomingTrigger$.next(this.upcomingDays());
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
        switchMap(() =>
          this.reportsService.getTotalBalance().pipe(
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
        switchMap((companyName) =>
          this.reportsService.getCompanyBalance(companyName).pipe(
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
        distinctUntilChanged(),
        tap(() => {
          this.agingLoading.set(true);
          this.agingError.set(null);
        }),
        switchMap((companyName) =>
          this.reportsService.getAgingReport(companyName || undefined).pipe(
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
        distinctUntilChanged(),
        tap(() => {
          this.topDebtorsLoading.set(true);
          this.topDebtorsError.set(null);
        }),
        switchMap((top) =>
          this.reportsService.getTopDebtors(top).pipe(
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
        distinctUntilChanged(),
        tap(() => {
          this.upcomingLoading.set(true);
          this.upcomingError.set(null);
        }),
        switchMap((days) =>
          this.reportsService.getUpcomingDue(days).pipe(
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
    this.totalBalanceTrigger$.next();
  }

  selectBalanceCompany(companyName: string): void {
    this.selectedBalanceCompany.set(companyName);

    if (!companyName) {
      this.companyBalance.set(null);
      this.companyBalanceError.set(null);
      return;
    }

    this.companyBalanceTrigger$.next(companyName);
  }

  clearBalanceCompany(): void {
    this.selectedBalanceCompany.set('');
    this.companyBalance.set(null);
    this.companyBalanceError.set(null);
  }

  retryCompanyBalance(): void {
    const companyName = this.selectedBalanceCompany();

    if (companyName) {
      this.companyBalanceTrigger$.next(companyName);
    }
  }

  setAgingCompanyFilter(companyName: string): void {
    this.agingCompanyFilter.set(companyName);
    this.agingTrigger$.next(companyName);
  }

  retryAging(): void {
    this.agingTrigger$.next(this.agingCompanyFilter());
  }

  setTopCount(top: number): void {
    this.topCount.set(top);
    this.topDebtorsTrigger$.next(top);
  }

  retryTopDebtors(): void {
    this.topDebtorsTrigger$.next(this.topCount());
  }

  setUpcomingDays(days: number): void {
    this.upcomingDays.set(days);
    this.upcomingTrigger$.next(days);
  }

  retryUpcomingDue(): void {
    this.upcomingTrigger$.next(this.upcomingDays());
  }

  // ---------------- Display helpers ----------------

  /**
   * Uses the same Egyptian pound suffix as the rest of the app while keeping
   * two decimal places for report values returned as financial decimals.
   */
  formatMoney(value: number): string {
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

    return `${formatted} ج.م`;
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
}

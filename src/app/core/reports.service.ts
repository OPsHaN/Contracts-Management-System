import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { AgingReport, CompanyBalance, TotalBalance, UpcomingDueCheque } from './api.models';

export interface ReportPeriodFilter {
  month: number | null;
  year: number | null;
}

/**
 * Financial reports endpoints.
 *
 * These live under two different base paths on the API: company balance,
 * total balance, aging and top debtors are all under `/claims/reports`,
 * while upcoming-due cheques stay under `/cheques` (the same endpoint the
 * existing cheques workflow already polls via `getUpcomingDueCheques` in
 * SalesClaimsService — kept separate here rather than reused, since this
 * service exposes it with an explicit `days` parameter the existing method
 * doesn't take).
 *
 * `pharmacyId` is never sent from the frontend on any of these calls: the
 * backend derives it from the authenticated user's token. That token is
 * attached by the app's existing HTTP interceptor (see AuthService.getToken
 * and the interceptor registered in main.ts) — nothing here attaches
 * a token manually, matching CompaniesService and SalesClaimsService.
 */
@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly claimsReportsUrl = `${environment.apiBaseUrl}/claims/reports`;
  private readonly chequesUrl = `${environment.apiBaseUrl}/cheques`;

  constructor(private readonly http: HttpClient) {}

  /**
   * `HttpParams.set` URL-encodes the value when the request is serialized,
   * so `companyName` is transmitted safely without manual
   * `encodeURIComponent` (which would double-encode it).
   */
  getCompanyBalance(companyName: string, filters?: ReportPeriodFilter): Observable<CompanyBalance> {
    const params = this.withPeriodFilters(
      new HttpParams().set('companyName', companyName),
      filters,
    );

    return this.http.get<CompanyBalance>(`${this.claimsReportsUrl}/company-balance`, { params });
  }

  getTotalBalance(filters?: ReportPeriodFilter): Observable<TotalBalance> {
    const params = this.withPeriodFilters(new HttpParams(), filters);

    return this.http.get<TotalBalance>(`${this.claimsReportsUrl}/total-balance`, { params });
  }

  getAgingReport(companyName?: string, filters?: ReportPeriodFilter): Observable<AgingReport> {
    let params = new HttpParams();

    if (companyName) {
      params = params.set('companyName', companyName);
    }

    params = this.withPeriodFilters(params, filters);

    return this.http.get<AgingReport>(`${this.claimsReportsUrl}/aging`, { params });
  }

  getTopDebtors(top = 10, filters?: ReportPeriodFilter): Observable<CompanyBalance[]> {
    const params = this.withPeriodFilters(new HttpParams().set('top', top), filters);

    return this.http.get<CompanyBalance[]>(`${this.claimsReportsUrl}/top-debtors`, { params });
  }

  getUpcomingDue(days = 7, filters?: ReportPeriodFilter): Observable<UpcomingDueCheque[]> {
    const params = this.withPeriodFilters(new HttpParams().set('days', days), filters);

    return this.http.get<UpcomingDueCheque[]>(`${this.chequesUrl}/upcoming-due`, { params });
  }

  private withPeriodFilters(params: HttpParams, filters?: ReportPeriodFilter): HttpParams {
    let nextParams = params;

    if (filters?.month) {
      nextParams = nextParams.set('month', filters.month);
    }

    if (filters?.year) {
      nextParams = nextParams.set('year', filters.year);
    }

    return nextParams;
  }
}

/**
 * Shared error-message extraction for the reports page: prefers the
 * backend's `{ errors: string[] }` validation shape, falls back to a
 * network-level message for status 0 (no connection), and otherwise a
 * generic retry prompt. 401/403 are handled separately by the caller
 * (session expiry / access-denied are states, not just messages).
 */
export function extractReportErrorMessage(error: HttpErrorResponse): string {
  const errors = (error.error as { errors?: unknown } | null)?.errors;

  if (Array.isArray(errors) && errors.length && errors.every((item) => typeof item === 'string')) {
    return errors.join(' ');
  }

  if (error.status === 0) {
    return 'تعذر الاتصال بالخادم. تأكد من اتصالك بالإنترنت.';
  }

  return 'فشل تحميل البيانات. حاول مرة أخرى.';
}

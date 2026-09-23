import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { AgingReport, CompanyBalance, TotalBalance, UpcomingDueCheque } from './api.models';

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
  getCompanyBalance(companyName: string): Observable<CompanyBalance> {
    const params = new HttpParams().set('companyName', companyName);

    return this.http.get<CompanyBalance>(`${this.claimsReportsUrl}/company-balance`, { params });
  }

  getTotalBalance(): Observable<TotalBalance> {
    return this.http.get<TotalBalance>(`${this.claimsReportsUrl}/total-balance`);
  }

  getAgingReport(companyName?: string): Observable<AgingReport> {
    let params = new HttpParams();

    if (companyName) {
      params = params.set('companyName', companyName);
    }

    return this.http.get<AgingReport>(`${this.claimsReportsUrl}/aging`, { params });
  }

  getTopDebtors(top = 10): Observable<CompanyBalance[]> {
    const params = new HttpParams().set('top', top);

    return this.http.get<CompanyBalance[]>(`${this.claimsReportsUrl}/top-debtors`, { params });
  }

  getUpcomingDue(days = 7): Observable<UpcomingDueCheque[]> {
    const params = new HttpParams().set('days', days);

    return this.http.get<UpcomingDueCheque[]>(`${this.chequesUrl}/upcoming-due`, { params });
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

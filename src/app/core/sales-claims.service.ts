import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import {
  ChequeDto,
  ChequePrepareResponse,
  ClaimDifferencesResponse,
  ClaimDto,
  ClaimReviewRequest,
  ClaimReviewResponse,
  ClaimsPivotResponse,
  CompanyInsightsResponse,
  CompanyProfileRow,
  CreateChequesRequest,
  GenerateClaimsRequest,
  PagedResponse,
  SalesBatchStatus,
  SalesBatchUploadResponse,
  UpdateChequeStatusRequest
} from './api.models';

@Injectable({ providedIn: 'root' })
export class SalesClaimsService {
  private readonly apiUrl = environment.apiBaseUrl;

  constructor(private readonly http: HttpClient) {}

  uploadSalesBatch(pharmacyId: string, file: File): Observable<SalesBatchUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<SalesBatchUploadResponse>(
      `${this.apiUrl}/pharmacies/${pharmacyId}/sales-batches`,
      formData
    );
  }

  getSalesBatch(batchId: string): Observable<SalesBatchStatus> {
    return this.http.get<SalesBatchStatus>(`${this.apiUrl}/sales-batches/${batchId}`);
  }

  getClaimsPivot(month: number, year: number): Observable<ClaimsPivotResponse> {
    const params = new HttpParams()
      .set('month', month)
      .set('year', year);

    return this.http.get<ClaimsPivotResponse>(`${this.apiUrl}/claims/pivot`, { params });
  }

  generateClaims(payload: GenerateClaimsRequest): Observable<ClaimDto[]> {
    return this.http.post<ClaimDto[]>(`${this.apiUrl}/claims/generate`, payload);
  }

  getClaims(month?: number | null, year?: number | null): Observable<ClaimDto[]> {
    let params = new HttpParams();

    if (month) {
      params = params.set('month', month);
    }

    if (year) {
      params = params.set('year', year);
    }

    return this.http.get<ClaimDto[]>(`${this.apiUrl}/claims`, { params });
  }

  getCompanyInsights(companyName: string, month: number, year: number): Observable<CompanyInsightsResponse> {
    const params = new HttpParams()
      .set('companyName', companyName)
      .set('month', month)
      .set('year', year);

    return this.http.get<CompanyInsightsResponse>(`${this.apiUrl}/claims/company-insights`, { params });
  }

  getCompanyProfile(
    companyName: string,
    month: number | null,
    year: number | null,
    pageNumber = 1,
    pageSize = 20,
  ): Observable<PagedResponse<CompanyProfileRow>> {
    let params = new HttpParams()
      .set('companyName', companyName)
      .set('pageNumber', pageNumber)
      .set('pageSize', pageSize);

    if (month) {
      params = params.set('month', month);
    }

    if (year) {
      params = params.set('year', year);
    }

    return this.http.get<PagedResponse<CompanyProfileRow>>(`${this.apiUrl}/company-profile`, { params });
  }

  saveClaimReview(claimId: string, payload: ClaimReviewRequest): Observable<ClaimReviewResponse> {
    return this.http.post<ClaimReviewResponse>(`${this.apiUrl}/claims/${claimId}/reviews`, payload);
  }

  updateClaimReview(claimId: string, payload: ClaimReviewRequest): Observable<ClaimReviewResponse> {
    return this.http.put<ClaimReviewResponse>(`${this.apiUrl}/claims/${claimId}/reviews`, payload);
  }

  getClaimReview(claimId: string): Observable<ClaimReviewResponse> {
    return this.http.get<ClaimReviewResponse>(`${this.apiUrl}/claims/${claimId}/reviews`);
  }

  prepareCheque(companyName: string, month: number, year: number): Observable<ChequePrepareResponse> {
    const params = new HttpParams()
      .set('companyName', companyName)
      .set('month', month)
      .set('year', year);

    return this.http.get<ChequePrepareResponse>(`${this.apiUrl}/cheques/prepare`, { params });
  }

  createCheques(claimId: string, payload: CreateChequesRequest): Observable<ChequeDto[]> {
    return this.http.post<ChequeDto[]>(`${this.apiUrl}/cheques/claims/${claimId}`, payload);
  }

  getCheques(companyName?: string, month?: number, year?: number): Observable<ChequeDto[]> {
    let params = new HttpParams();

    if (companyName) {
      params = params.set('companyName', companyName);
    }

    if (month) {
      params = params.set('month', month);
    }

    if (year) {
      params = params.set('year', year);
    }

    return this.http.get<ChequeDto[]>(`${this.apiUrl}/cheques`, { params });
  }

  updateChequeStatus(chequeId: string, payload: UpdateChequeStatusRequest): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/cheques/${chequeId}/status`, payload);
  }

  getUpcomingDueCheques(): Observable<ChequeDto[]> {
    return this.http.get<ChequeDto[]>(`${this.apiUrl}/cheques/upcoming-due`);
  }


  // inside SalesClaimsService
  getClaimDifferences(claimId: string): Observable<ClaimDifferencesResponse> {
    return this.http.get<ClaimDifferencesResponse>(
      `${this.apiUrl}/claims/${claimId}/reviews/differences`,
    );
  }
}

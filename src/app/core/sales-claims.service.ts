import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import {
  ClaimsPivotResponse,
  SalesBatchStatus,
  SalesBatchUploadResponse
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
}

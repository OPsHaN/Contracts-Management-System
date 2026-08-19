import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { CompanyDto, CompanyRequest, PagedResponse } from './api.models';

@Injectable({ providedIn: 'root' })
export class CompaniesService {
  private readonly apiUrl = `${environment.apiBaseUrl}/companies`;

  constructor(private readonly http: HttpClient) {}

  createCompany(payload: CompanyRequest): Observable<CompanyDto> {
    return this.http.post<CompanyDto>(this.apiUrl, payload);
  }

  updateCompany(companyId: string, payload: CompanyRequest): Observable<CompanyDto> {
    return this.http.put<CompanyDto>(`${this.apiUrl}/${companyId}`, payload);
  }

  getCompanies(pageNumber = 1, pageSize = 10): Observable<PagedResponse<CompanyDto>> {
    const params = new HttpParams()
      .set('pageNumber', pageNumber)
      .set('pageSize', pageSize);

    return this.http.get<PagedResponse<CompanyDto>>(this.apiUrl, { params });
  }

  getCompany(companyId: string): Observable<CompanyDto> {
    return this.http.get<CompanyDto>(`${this.apiUrl}/${companyId}`);
  }
}

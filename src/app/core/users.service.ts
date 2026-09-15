import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import {
  CreateReviewerRequest,
  CreateUserRequest,
  ReviewerDto,
  UpdateUserStatusRequest,
  UserDto
} from './api.models';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly apiUrl = `${environment.apiBaseUrl}/users`;

  constructor(private readonly http: HttpClient) {}

  createUser(payload: CreateUserRequest): Observable<UserDto> {
    return this.http.post<UserDto>(this.apiUrl, payload);
  }

  getUsers(): Observable<UserDto[]> {
    return this.http.get<UserDto[]>(this.apiUrl);
  }

  getReviewers(): Observable<ReviewerDto[]> {
    return this.http.get<ReviewerDto[]>(`${this.apiUrl}/reviewers`);
  }

  createReviewer(payload: CreateReviewerRequest): Observable<ReviewerDto> {
    return this.http.post<ReviewerDto>(`${this.apiUrl}/reviewers`, payload);
  }

  updateStatus(userId: string, payload: UpdateUserStatusRequest): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/${userId}/status`, payload);
  }
}

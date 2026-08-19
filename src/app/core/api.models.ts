export type UserRole = 'SuperAdmin' | 'Pharmacy';

export interface ApiErrorResponse {
  errors: string[];
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  userId: string;
  role: UserRole;
  pharmacyName: string | null;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  role: UserRole;
  pharmacyName: string | null;
}

export interface UserDto {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  pharmacyName: string | null;
  createdAt: string;
}

export interface UpdateUserStatusRequest {
  isActive: boolean;
}

export interface CompanyRequest {
  name: string;
  localDiscountPercentage: number;
  importedDiscountPercentage: number;
  taxPercentage: number;
  administrativeExpensesPercentage: number;
  chequeSettlementPeriodInDays: number;
}

export interface CompanyDto extends CompanyRequest {
  id: string;
  createdAt: string;
}

export interface PagedResponse<T> {
  items: T[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export type SalesBatchStatusValue = 'Pending' | 'Processing' | 'Completed' | 'Failed';

export interface SalesBatchUploadResponse {
  batchId: string;
  status: SalesBatchStatusValue;
}

export interface SalesBatchStatus {
  id: string;
  status: SalesBatchStatusValue;
  totalRows: number;
  processedRows: number;
  failedRows: number;
  errorLog: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface ClaimsPivotRow {
  companyName: string;
  amountsByBranch: Record<string, number>;
  total: number;
}

export interface ClaimsPivotResponse {
  branches: string[];
  rows: ClaimsPivotRow[];
}

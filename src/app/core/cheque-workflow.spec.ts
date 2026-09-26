import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { NEVER, of } from 'rxjs';
import { ReportsComponent } from './reports.component';
import { ReportsService } from './reports.service';
import { CompaniesService } from './companies.service';
import { AppComponent } from '../app.component';
import { SalesClaimsService } from './sales-claims.service';
import { ChequeDto, ChequePrepareResponse, CreateChequesRequest, UpdateChequeStatusRequest } from './api.models';

const pending: ChequeDto = {
  id: 'c1', companyName: 'Company', departmentName: null, chequeNumber: null, bankName: null,
  claimMonth: 9, claimYear: 2026, amountBeforeDiscount: 1000, correctAmount: 950, amountDifference: 50,
  taxPercentage: 2, administrativeExpensesPercentage: 1, finalAmount: 921.5,
  actualAmount: null, paymentDifference: null, paymentDifferenceType: null, chequeDate: null,
  startDate: '2026-09-01', endDate: '2026-10-01', settlementDays: 30, status: 'Pending',
  remainingAmount: null, createdAt: '2026-09-01T00:00:00Z',
};
const prepare: ChequePrepareResponse = {
  claimId: 'claim1', companyName: 'Company', amountBeforeDiscount: 1000, correctAmount: 950,
  amountDifference: 50, taxPercentage: 2, administrativeExpensesPercentage: 1,
  finalAmount: 921.5, settlementDays: 30, departments: ['A', 'B', 'C'],
};
const receipt: UpdateChequeStatusRequest = {
  status: 'PaidInFull', actualAmount: 920, chequeDate: '2026-09-25T00:00:00.000Z',
  remainingAmount: null, chequeNumber: 'CH-1001', bankName: 'Bank',
};
// Compile-time guards: only allocations carry amount; receipt fields are not creation inputs.
type Assert<T extends true> = T;
type ResponseHasNoLegacyFields = Assert<Extract<keyof ChequeDto, 'amount' | 'amountAfterDiscount' | 'discountDifference' | 'paidAmount'> extends never ? true : false>;
type PrepareHasNoLegacyFields = Assert<Extract<keyof ChequePrepareResponse, 'amount' | 'amountAfterDiscount' | 'discountDifference' | 'paidAmount'> extends never ? true : false>;
type CreationHasNoReceipt = Assert<Extract<keyof CreateChequesRequest, 'actualAmount' | 'chequeDate'> extends never ? true : false>;

describe('Cheque HTTP contract', () => {
  let service: SalesClaimsService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({providers: [provideHttpClient(), provideHttpClientTesting()]});
    service = TestBed.inject(SalesClaimsService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('accepts the complete HTTP 200 PATCH response and invalidates report queries', () => {
    const invalidated = jasmine.createSpy('invalidated');
    service.chequesChanged$.subscribe(invalidated);
    const updated: ChequeDto = {...pending, ...receipt, paymentDifference: 1.5, paymentDifferenceType: 'Decrease'};
    let result: ChequeDto | undefined;
    service.updateChequeStatus('c1', receipt).subscribe(value => result = value);
    const req = http.expectOne(r => r.url.endsWith('/cheques/c1/status'));
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(receipt);
    req.flush(updated, { status: 200, statusText: 'OK' });
    expect(result).toEqual(updated);
    expect(invalidated).toHaveBeenCalledTimes(1);
  });
  it('creates allocations of the correct amount without receipt fields', () => {
    const payload: CreateChequesRequest = {startDate: '2026-09-01', allocations: [{departmentName: null, amount: 950, chequeNumber: null, bankName: null}]};
    service.createCheques('claim1', payload).subscribe(value => expect(value).toEqual([pending]));
    const req = http.expectOne(r => r.url.endsWith('/cheques/claims/claim1'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush([pending]);
  });
  it('preserves nullable receipt values from list and upcoming endpoints', () => {
    service.getCheques().subscribe(value => expect(value[0]).toEqual(pending));
    http.expectOne(r => r.url.endsWith('/cheques')).flush([pending]);
    service.getUpcomingDueCheques().subscribe(value => expect(value[0].actualAmount).toBeNull());
    http.expectOne(r => r.url.endsWith('/cheques/upcoming-due')).flush([pending]);
    service.prepareCheque('Company',9,2026).subscribe(value => expect(value).toEqual(prepare));
    http.expectOne(r => r.url.endsWith('/cheques/prepare')).flush(prepare);
  });
});

describe('Cheque receipt workflow', () => {
  let app: AppComponent;
  let service: SalesClaimsService;
  beforeEach(() => {
    TestBed.configureTestingModule({providers: [provideHttpClient(), provideHttpClientTesting()]});
    app = TestBed.runInInjectionContext(() => new AppComponent());
    service = TestBed.inject(SalesClaimsService);
    app.openChequeStatusModal(pending);
    Object.assign(app.chequeStatusForm, receipt, { chequeDate: '2026-09-25' });
    spyOn(service, 'updateChequeStatus').and.returnValue(NEVER);
  });
  for (const status of ['PaidInFull', 'PartiallyPaid'] as const) {
    for (const actualAmount of [null, -1, NaN, Infinity]) {
      it('rejects invalid received amount for ' + status + ': ' + actualAmount, () => {
        Object.assign(app.chequeStatusForm, {status, actualAmount, remainingAmount: 0});
        app.updateChequeStatus();
        expect(service.updateChequeStatus).not.toHaveBeenCalled();
      });
    }
    for (const chequeDate of ['', 'bad', '2026-02-30']) {
      it('rejects invalid date for ' + status + ': ' + chequeDate, () => {
        Object.assign(app.chequeStatusForm, {status, chequeDate, remainingAmount: 0});
        app.updateChequeStatus();
        expect(service.updateChequeStatus).not.toHaveBeenCalled();
      });
    }
  }
  for (const remainingAmount of [null, -1, 922, NaN, Infinity]) {
    it('rejects invalid partial remaining amount ' + remainingAmount, () => {
      Object.assign(app.chequeStatusForm, {status: 'PartiallyPaid', remainingAmount});
      app.updateChequeStatus();
      expect(service.updateChequeStatus).not.toHaveBeenCalled();
    });
  }
  for (const remainingAmount of [0, pending.finalAmount]) {
    it('accepts boundary values including zero receipt', () => {
      Object.assign(app.chequeStatusForm, {status: 'PartiallyPaid', actualAmount: 0, remainingAmount});
      app.updateChequeStatus();
      expect(service.updateChequeStatus).toHaveBeenCalledWith('c1', jasmine.objectContaining({actualAmount: 0, remainingAmount}));
    });
  }
  for (const status of ['Pending', 'Deferred'] as const) {
    it('sends null receipt fields for ' + status, () => {
      app.chequeStatusForm.status = status;
      app.updateChequeStatus();
      expect(service.updateChequeStatus).toHaveBeenCalledWith('c1', jasmine.objectContaining({status, actualAmount: null, chequeDate: null, remainingAmount: null}));
    });
  }
  it('replaces both cached copies with server values and refetches affected queries', () => {
    const updated: ChequeDto = {...pending, ...receipt, actualAmount: 940, paymentDifference: 18.5, paymentDifferenceType: 'Increase'};
    (service.updateChequeStatus as jasmine.Spy).and.returnValue(of(updated));
    spyOn(service, 'getCheques').and.returnValue(NEVER);
    spyOn(service, 'getUpcomingDueCheques').and.returnValue(NEVER);
    app.cheques.set([pending]); app.upcomingCheques.set([pending]);
    app.updateChequeStatus();
    expect(app.cheques()[0]).toBe(updated);
    expect(app.upcomingCheques()[0]).toBe(updated);
    expect(service.getCheques).toHaveBeenCalled();
    expect(service.getUpcomingDueCheques).toHaveBeenCalled();
  });
  it('displays null as not received while retaining zero', () => {
    expect(app.formatReceiptMoney(null)).toBe('لم يُستلم');
    expect(app.formatReceiptMoney(0)).toBe(app.formatMoney(0));
    expect(app.displayPaymentDifferenceType(null)).toBe('لم يُستلم');
  });
  for (const [flag, label] of [['Equal','مطابق'], ['Increase','زيادة'], ['Decrease','نقص']] as const) {
    it('localizes difference flag ' + flag, () => {
      expect(app.displayPaymentDifferenceType(flag)).toBe(label);
      expect(app.paymentDifferenceClass(flag)).toBe('difference-' + flag);
    });
  }
  it('allocates the correct amount exactly and rejects a one-cent mismatch', () => {
    const allocations = (app as any).createDefaultAllocations(prepare);
    expect(allocations.reduce((total: number, item: {amount: number}) => total + item.amount, 0)).toBe(950);
    app.preparedCheque.set(prepare);
    app.chequeForm.allocations = [{departmentName: null, amount: 949.99, chequeNumber: null, bankName: null}];
    spyOn(service, 'createCheques').and.returnValue(NEVER);
    app.createCheques();
    expect(service.createCheques).not.toHaveBeenCalled();
    app.chequeForm.allocations[0].amount = 950;
    app.createCheques();
    expect(service.createCheques).toHaveBeenCalledWith('claim1', jasmine.objectContaining({allocations: app.chequeForm.allocations}));
  });
});

describe('Cheque report invalidation', () => {
  it('refetches all active reports, including selected company and upcoming cheques', () => {
    const reports = jasmine.createSpyObj<ReportsService>('reports', ['getTotalBalance', 'getCompanyBalance', 'getAgingReport', 'getTopDebtors', 'getUpcomingDue']);
    for (const method of ['getTotalBalance', 'getCompanyBalance', 'getAgingReport', 'getTopDebtors', 'getUpcomingDue'] as const) reports[method].and.returnValue(NEVER);
    TestBed.configureTestingModule({providers: [provideHttpClient(), provideHttpClientTesting(), {provide: ReportsService, useValue: reports}, {provide: CompaniesService, useValue: {getCompanies: () => NEVER}}]});
    const component = TestBed.runInInjectionContext(() => new ReportsComponent());
    component.selectBalanceCompany('Company');
    for (const method of ['getTotalBalance', 'getCompanyBalance', 'getAgingReport', 'getTopDebtors', 'getUpcomingDue'] as const) reports[method].calls.reset();
    TestBed.inject(SalesClaimsService).chequesChanged$.next();
    for (const method of ['getTotalBalance', 'getCompanyBalance', 'getAgingReport', 'getTopDebtors', 'getUpcomingDue'] as const) expect(reports[method]).toHaveBeenCalledTimes(1);
  });
});

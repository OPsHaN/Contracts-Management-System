import { ComponentFixture, TestBed } from "@angular/core/testing";

import { ClaimReviewComparison } from "./api.models";
import { ClaimReviewComparisonComponent } from "./claim-review-comparison.component";
import { claimReviewComparisonTranslation } from "./claim-review-comparison.translations";

describe("ClaimReviewComparisonComponent", () => {
  let fixture: ComponentFixture<ClaimReviewComparisonComponent>;

  const baseComparison: ClaimReviewComparison = {
    amountBeforeDiscount: 1000,
    correctedAmount: 900,
    amountDifference: 100,
    amountDifferenceType: "Decrease",
    prescriptionsCount: 50,
    correctedPrescriptionsCount: 55,
    prescriptionsCountDifference: 5,
    prescriptionsCountDifferenceType: "Increase",
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClaimReviewComparisonComponent],
    }).compileComponents();
  });

  afterEach(() => {
    document.documentElement.lang = "ar";
  });

  function render(
    comparison: ClaimReviewComparison,
    language: "ar" | "en" = "ar",
  ): HTMLElement {
    document.documentElement.lang = language;
    fixture = TestBed.createComponent(ClaimReviewComparisonComponent);
    fixture.componentRef.setInput("comparison", comparison);
    fixture.componentRef.setInput(
      "moneyFormatter",
      (value: number | null | undefined) =>
        value === null || value === undefined ? "—" : `SAR ${value}`,
    );
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it("shows decrease and increase states using backend directions", () => {
    const element = render(baseComparison, "en");
    const amountDirection = element.querySelector<HTMLElement>(
      '[data-testid="amount-direction"]',
    );
    const prescriptionsDirection = element.querySelector<HTMLElement>(
      '[data-testid="prescriptions-direction"]',
    );

    expect(amountDirection?.classList.contains("is-decrease")).toBeTrue();
    expect(amountDirection?.textContent).toContain("↓");
    expect(amountDirection?.textContent).toContain("Decrease");
    expect(prescriptionsDirection?.classList.contains("is-increase")).toBeTrue();
    expect(prescriptionsDirection?.textContent).toContain("↑");
    expect(prescriptionsDirection?.textContent).toContain("Increase");
  });

  it("shows the neutral no-difference state", () => {
    const element = render({
      ...baseComparison,
      amountDifference: 0,
      amountDifferenceType: "NoDifference",
      prescriptionsCountDifference: 0,
      prescriptionsCountDifferenceType: "NoDifference",
    });
    const badges = element.querySelectorAll<HTMLElement>(".direction-badge");

    expect(badges.length).toBe(2);
    badges.forEach((badge) => {
      expect(badge.classList.contains("is-nodifference")).toBeTrue();
      expect(badge.textContent).toContain("−");
      expect(badge.textContent).toContain("لا يوجد فرق");
    });
  });

  it("shows an em dash for null corrected values", () => {
    const element = render({
      ...baseComparison,
      correctedAmount: null,
      correctedPrescriptionsCount: null,
    });

    expect(
      element.querySelector('[data-testid="corrected-amount"]')?.textContent?.trim(),
    ).toBe("—");
    expect(
      element
        .querySelector('[data-testid="corrected-prescriptions"]')
        ?.textContent?.trim(),
    ).toBe("—");
  });

  it("provides Arabic and English labels for comparison fields and badges", () => {
    expect(claimReviewComparisonTranslation("absoluteDifference", "ar")).toBe(
      "الفرق المطلق",
    );
    expect(claimReviewComparisonTranslation("absoluteDifference", "en")).toBe(
      "Absolute difference",
    );
    expect(claimReviewComparisonTranslation("Increase", "ar")).toBe("زيادة");
    expect(claimReviewComparisonTranslation("Increase", "en")).toBe("Increase");
  });
});
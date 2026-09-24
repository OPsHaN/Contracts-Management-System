import { CommonModule, DOCUMENT } from "@angular/common";
import { Component, Input, inject } from "@angular/core";

import { ClaimReviewComparison, DifferenceType } from "./api.models";
import {
  ClaimReviewComparisonTranslationKey,
  claimReviewComparisonTranslation,
} from "./claim-review-comparison.translations";

@Component({
  selector: "app-claim-review-comparison",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./claim-review-comparison.component.html",
  styleUrl: "./claim-review-comparison.component.scss",
})
export class ClaimReviewComparisonComponent {
  private readonly document = inject(DOCUMENT);

  @Input({ required: true }) comparison!: ClaimReviewComparison;
  @Input({ required: true }) moneyFormatter!: (
    value: number | null | undefined,
  ) => string;

  label(key: ClaimReviewComparisonTranslationKey): string {
    return claimReviewComparisonTranslation(key, this.language());
  }

  formatCount(value: number | null): string {
    if (value === null) {
      return "—";
    }

    return new Intl.NumberFormat(
      this.language() === "ar" ? "ar-EG-u-nu-arab" : "en-US",
      { maximumFractionDigits: 0 },
    ).format(value);
  }

  directionClass(type: DifferenceType): string {
    return `is-${type.toLowerCase()}`;
  }

  directionArrow(type: DifferenceType): string {
    if (type === "Increase") {
      return "↑";
    }

    if (type === "Decrease") {
      return "↓";
    }

    return "−";
  }

  private language(): "ar" | "en" {
    return this.document.documentElement.lang.toLowerCase().startsWith("en")
      ? "en"
      : "ar";
  }
}
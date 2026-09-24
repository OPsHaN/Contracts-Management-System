import { Pipe, PipeTransform } from "@angular/core";

@Pipe({
  name: "arabicDigits",
  standalone: true,
})
export class ArabicDigitsPipe implements PipeTransform {
  private readonly digits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

  transform(value: string | number | null | undefined): string {
    if (value === null || value === undefined) {
      return "";
    }

    return String(value).replace(/\d/g, (digit) => this.digits[Number(digit)]);
  }
}
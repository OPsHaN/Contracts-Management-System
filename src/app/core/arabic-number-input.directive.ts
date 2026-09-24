import {
  Directive,
  ElementRef,
  HostListener,
  forwardRef,
  inject,
} from "@angular/core";
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from "@angular/forms";

@Directive({
  selector: "input[appArabicNumber]",
  standalone: true,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ArabicNumberInputDirective),
      multi: true,
    },
  ],
})
export class ArabicNumberInputDirective implements ControlValueAccessor {
  private readonly element = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private readonly arabicDigits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

  private onChange: (value: number | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: number | null | undefined): void {
    this.element.nativeElement.value =
      value === null || value === undefined ? "" : this.toArabic(String(value));
  }

  registerOnChange(fn: (value: number | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.element.nativeElement.disabled = disabled;
  }

  @HostListener("input", ["$event"])
  handleInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const cursor = input.selectionStart;
    input.value = this.toArabic(input.value);

    if (cursor !== null) {
      input.setSelectionRange(cursor, cursor);
    }

    this.onChange(this.toNumber(input.value));
  }

  @HostListener("blur")
  handleBlur(): void {
    this.onTouched();
  }

  private toArabic(value: string): string {
    return value
      .replace(/[0-9]/g, (digit) => this.arabicDigits[Number(digit)])
      .replace(/\./g, "٫");
  }

  private toNumber(value: string): number | null {
    const normalized = value
      .replace(/[٠-٩]/g, (digit) => String(this.arabicDigits.indexOf(digit)))
      .replace(/[٫,،]/g, ".")
      .replace(/٬/g, "")
      .trim();

    if (!normalized) {
      return null;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
}
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

/** Bestimmter Fortschritt zwischen 0 und 100 % als Balken auf einer Kachel. */
@Component({
  selector: 'app-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  templateUrl: './progress.component.html',
  styleUrl: './progress.component.scss',
})
export class ProgressComponent {
  readonly value = input.required<number>();

  protected readonly clamped = computed(() => Math.min(100, Math.max(0, Math.round(this.value()))));
}

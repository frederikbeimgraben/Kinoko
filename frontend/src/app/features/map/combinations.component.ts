import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import type { Combination, Rule } from '../../core/api/models';

/** Der Text zu jeder Regel. */
const RULE_KEY: Record<Rule, TranslationKey> = {
  intersection: 'map.combination.intersection',
  graded: 'map.combination.graduated',
};
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { SvgIconComponent } from '../../ui/svg-icon/svg-icon.component';

/** Eine gespeicherte Kombination mit ihrer Unterzeile. */
interface Row {
  combination: Combination;
  subline: string;
}

/** Die gespeicherten Kombinationen: laden oder entfernen. */
@Component({
  selector: 'app-combinations',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ListRowComponent, SvgIconComponent, TranslatePipe],
  templateUrl: './combinations.component.html',
  styleUrl: './combinations.component.scss',
})
export class CombinationsComponent {
  private readonly i18n = inject(I18nService);

  readonly saved = input.required<readonly Combination[]>();

  readonly picked = output<Combination>();
  readonly removed = output<Combination>();

  protected readonly rows = computed<Row[]>(() =>
    this.saved().map((combination) => ({
      combination,
      subline: this.i18n.translate('map.combination.summary', {
        rule: this.i18n.translate(RULE_KEY[combination.rule ?? 'intersection']),
        count: combination.factors?.length ?? 0,
      }),
    })),
  );

  protected removeLabel(combination: Combination): string {
    return `${this.i18n.translate('common.delete')} ${combination.name ?? ''}`.trim();
  }
}

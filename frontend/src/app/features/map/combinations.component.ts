import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import type { Combination, Rule } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import { ChoiceRowComponent } from '../../ui/choice-row/choice-row.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';

const RULE_KEY: Record<Rule, TranslationKey> = {
  intersection: 'map.combination.intersection',
  graded: 'map.combination.graduated',
};

/** A saved combination with its sub-line. */
interface Row {
  combination: Combination;
  subline: string;
}

/** The saved combinations as one group of radio rows, per the board `CombinationsBody`. */
@Component({
  selector: 'app-combinations',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChoiceRowComponent, RowGroupComponent, TranslatePipe],
  template: `
    @if (rows().length === 0) {
      <p class="combinations__empty">{{ 'map.combination.empty' | t }}</p>
    } @else {
      <app-row-group role="radiogroup">
        @for (row of rows(); track row.combination.id) {
          <app-choice-row
            [label]="row.combination.name ?? ''"
            [subline]="row.subline"
            [checked]="row.combination.id === selected()"
            (toggled)="chosen.emit(row.combination)"
          />
        }
      </app-row-group>
    }
  `,
  styles: `
    .combinations__empty {
      margin: 0;
      padding: 16px 4px;
      color: var(--text-var);
    }
  `,
})
export class CombinationsComponent {
  private readonly i18n = inject(I18nService);

  readonly saved = input.required<readonly Combination[]>();
  readonly selected = input<string | null>(null);

  readonly chosen = output<Combination>();

  /** One factor needs no rule, so its line names only the count. */
  protected readonly rows = computed<Row[]>(() =>
    this.saved().map((combination) => {
      const count = combination.factors?.length ?? 0;
      return {
        combination,
        subline:
          count === 1
            ? this.i18n.translate('map.combination.oneFactor')
            : this.i18n.translate('map.combination.summary', {
                rule: this.i18n.translate(RULE_KEY[combination.rule ?? 'intersection']),
                count,
              }),
      };
    }),
  );
}

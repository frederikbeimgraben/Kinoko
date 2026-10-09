import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { ColourChange } from '../../../core/api/models';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { FoldSectionComponent } from '../../../ui/fold-section/fold-section.component';
import { ListRowComponent } from '../../../ui/list-row/list-row.component';
import { RowGroupComponent } from '../../../ui/row-group/row-group.component';
import { SectionComponent } from '../../../ui/section/section.component';
import { SvgIconComponent } from '../../../ui/svg-icon/svg-icon.component';
import { CatalogueText } from '../catalogue-text';
import type { SpeciesReaction } from '../species.store';
import {
  DAGGER,
  colourChangeRow,
  distinctChanges,
  reactionRow,
  reactionSources,
  swatchBackground,
  type ChangeRow,
} from './reactions';

/** The section "Verfärbung": the colour changes and the reactions to reagents, then their sources. */
@Component({
  selector: 'app-species-reactions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FoldSectionComponent,
    ListRowComponent,
    RowGroupComponent,
    SectionComponent,
    SvgIconComponent,
    TranslatePipe,
  ],
  templateUrl: './species-reactions.component.html',
  styleUrl: './species-reactions.component.scss',
})
export class SpeciesReactionsComponent {
  private readonly i18n = inject(I18nService);
  private readonly names = inject(CatalogueText);

  readonly changes = input<readonly ColourChange[]>([]);
  readonly reactions = input<readonly SpeciesReaction[]>([]);

  protected readonly dagger = DAGGER;
  protected readonly background = swatchBackground;

  protected readonly rows = computed<ChangeRow[]>(() => [
    ...distinctChanges(this.changes(), this.reactions()).map((change, index) =>
      colourChangeRow(change, index, this.i18n, this.names),
    ),
    ...this.reactions().map((reaction, index) => reactionRow(reaction, index, this.i18n, this.names)),
  ]);

  protected readonly sources = computed(() => reactionSources(this.reactions()));

  /** A legend line explains the dagger only when a row has it. */
  protected readonly hasDagger = computed(() => this.rows().some((row) => row.partlyConfirmed));

  protected open(url: string | null): void {
    if (url !== null) globalThis.open(url, '_blank', 'noreferrer');
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../../core/i18n/translations';
import { ListRowComponent } from '../../../ui/list-row/list-row.component';
import { OverlayHostComponent } from '../../../ui/overlay-host/overlay-host.component';
import { RowGroupComponent } from '../../../ui/row-group/row-group.component';
import { SectionComponent } from '../../../ui/section/section.component';
import { SheetComponent } from '../../../ui/sheet/sheet.component';
import { RUN_KIND_TEXT } from '../runs.rows';
import { DataSourcesStore } from './data-sources.store';
import { needText } from './data-sources.rows';

/** The missing inputs of one run kind. */
interface Block {
  readonly run: string;
  readonly title: string;
  readonly needs: readonly string[];
}

/** A sheet with the unmet preconditions of each run kind. */
@Component({
  selector: 'app-needs-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ListRowComponent,
    OverlayHostComponent,
    RowGroupComponent,
    SectionComponent,
    SheetComponent,
    TranslatePipe,
  ],
  templateUrl: './needs-sheet.component.html',
  styleUrl: './needs-sheet.component.scss',
})
export class NeedsSheetComponent {
  private readonly i18n = inject(I18nService);
  private readonly store = inject(DataSourcesStore);

  readonly open = input(false);
  readonly closed = output();

  private readonly text = (key: TranslationKey, values?: Record<string, string | number>): string =>
    this.i18n.translate(key, values);

  protected readonly blocks = computed<readonly Block[]>(() =>
    this.store.blocked().map((entry) => ({
      run: entry.run,
      title: this.text(RUN_KIND_TEXT[entry.run]),
      needs: entry.missing.map((need) => needText(need, this.text)),
    })),
  );
}

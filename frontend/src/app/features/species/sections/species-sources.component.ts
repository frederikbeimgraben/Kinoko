import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { IconButtonComponent } from '../../../ui/icon-button/icon-button.component';
import { ListRowComponent } from '../../../ui/list-row/list-row.component';
import { RowGroupComponent } from '../../../ui/row-group/row-group.component';
import { SectionComponent } from '../../../ui/section/section.component';
import { hostOf } from './reactions';
import type { SpeciesEntry } from '../../../core/api/models';

interface SourceRow {
  title: string;
  host: string;
  url: string;
}

/** The address without a closing slash and in lower case, so that one page counts one time. */
function addressKey(url: string): string {
  return url.trim().replace(/\/+$/, '').toLowerCase();
}

/** The sources of a species per `SpeciesSections.dc.html`: title, host and a button to open the page. */
@Component({
  selector: 'app-species-sources',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconButtonComponent, ListRowComponent, RowGroupComponent, SectionComponent, TranslatePipe],
  templateUrl: './species-sources.component.html',
  styleUrl: './species-sources.component.scss',
})
export class SpeciesSourcesComponent {
  readonly species = input.required<SpeciesEntry>();

  protected readonly rows = computed<SourceRow[]>(() =>
    this.species()
      .sources.filter(
        (one, index, all) =>
          all.findIndex((other) => addressKey(other.url) === addressKey(one.url)) === index,
      )
      .map((one) => ({ title: one.title, host: hostOf(one.url), url: one.url })),
  );

  protected open(url: string): void {
    globalThis.open(url, '_blank', 'noreferrer');
  }
}

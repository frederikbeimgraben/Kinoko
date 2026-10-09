import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { IconButtonComponent } from '../../../ui/icon-button/icon-button.component';
import { ListRowComponent } from '../../../ui/list-row/list-row.component';
import { RowGroupComponent } from '../../../ui/row-group/row-group.component';
import { SectionComponent } from '../../../ui/section/section.component';
import { hostOf, reactionSources } from './reactions';
import type { SpeciesReaction } from '../species.store';
import type { SpeciesEntry } from '../../../core/api/models';

interface SourceRow {
  title: string;
  host: string;
  url: string | null;
}

/** The address without scheme, `www.`, closing slash and case, so that one page counts one time. */
export function addressKey(url: string | null, title: string): string {
  if (url === null) return `title:${title}`;
  return url
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '');
}

/** The sources of a species per `SpeciesSections.dc.html`: title, host and a button to open the page.
 * The sources of the reactions follow the sources of the profile. */
@Component({
  selector: 'app-species-sources',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconButtonComponent, ListRowComponent, RowGroupComponent, SectionComponent, TranslatePipe],
  templateUrl: './species-sources.component.html',
  styleUrl: './species-sources.component.scss',
})
export class SpeciesSourcesComponent {
  readonly species = input.required<SpeciesEntry>();
  readonly reactions = input<readonly SpeciesReaction[]>([]);

  protected readonly rows = computed<SourceRow[]>(() => {
    const own = this.species().sources.map((one) => ({
      title: one.title,
      url: one.url,
      host: sublineOf(one.title, hostOf(one.url)),
    }));
    const more = reactionSources(this.reactions()).map((one) => ({
      title: one.label,
      url: one.url,
      host: sublineOf(one.label, one.sub),
    }));
    return [...own, ...more].filter(
      (one, index, all) =>
        all.findIndex((other) => addressKey(other.url, other.title) === addressKey(one.url, one.title)) ===
        index,
    );
  });

  protected open(url: string | null): void {
    if (url !== null) globalThis.open(url, '_blank', 'noreferrer');
  }
}

/** The line below the title. A title that already is that line gets no line below. */
function sublineOf(title: string, line: string): string {
  return line.toLowerCase() === title.trim().toLowerCase() ? '' : line;
}

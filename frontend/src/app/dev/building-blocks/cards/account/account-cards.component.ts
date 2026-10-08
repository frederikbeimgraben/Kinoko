import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import type { FriendGroup, Zone } from '../../../../core/api/models';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { FormFieldComponent } from '../../../../ui/form-field/form-field.component';
import { DataExportBodyComponent } from '../../../../features/account/data-export-body.component';
import type { ExportPart } from '../../../../features/account/export-files';
import type { DataCounts } from '../../../../features/account/my-data.store';
import { EntriesFilterBodyComponent } from '../../../../features/entries/entries-filter-body.component';
import { NO_FILTER, type EntriesFilter } from '../../../../features/entries/entry-filter';
import { BlockCardComponent } from '../block-card/block-card.component';

/** The counts of `DataExportBody.dc.html`. */
const COUNTS: DataCounts = { finds: 12, markers: 4, zones: 2, photos: 3, combinations: 2 };

const PARTS: ReadonlySet<ExportPart> = new Set<ExportPart>(['finds', 'markers', 'zones']);

/** A group with only the fields that the filter chips read. */
function group(id: string, name: string): FriendGroup {
  return { id, name, ownerId: 'owner', inviteCode: '', createdAt: '2026-09-01T08:00:00Z', members: [] };
}

/** A zone with only the fields that the filter chips read. */
function zone(id: string, name: string): Zone {
  return {
    id,
    name,
    polygon: { type: 'Polygon', coordinates: [] },
    areaHa: 1,
    colour: 'green',
    note: null,
    visibility: 'private',
    groupId: null,
  };
}

/** The sheet bodies of the account and the entries, per their `*Body.dc.html`. */
@Component({
  selector: 'app-account-cards',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BlockCardComponent,
    DataExportBodyComponent,
    EntriesFilterBodyComponent,
    FormFieldComponent,
    TranslatePipe,
  ],
  templateUrl: './account-cards.component.html',
})
export class AccountCardsComponent {
  protected readonly counts = COUNTS;
  protected readonly parts = PARTS;
  protected readonly groups = [group('karlsruhe', 'Pilzgruppe Karlsruhe'), group('familie', 'Familie')];
  private readonly i18n = inject(I18nService);

  protected readonly zones = computed(() => [
    zone('schoenbuch', this.i18n.translate('beispiel.schoenbuchNord')),
    zone('kirnbach', 'Kirnbachtal'),
  ]);
  protected readonly filter: EntriesFilter = { ...NO_FILTER, visibility: 'shared', time: 'month' };
}

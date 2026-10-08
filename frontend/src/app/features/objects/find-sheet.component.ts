import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Injector,
  input,
  output,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { catchError, firstValueFrom, map, of } from 'rxjs';
import { AccountStore } from '../../core/access/account.store';
import { GroupsStore } from '../../core/access/groups.store';
import { PersonNamesStore } from '../../core/access/person-names.store';
import { photoPath } from '../../core/api/models';
import type { Find, Photo } from '../../core/api/models';
import { PhotosApi } from '../../core/api/photos.api';
import { longDate } from '../../core/i18n/dates';
import { I18nService } from '../../core/i18n/i18n.service';
import { ViewportService } from '../../core/layout/viewport.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { ConfirmDialogComponent } from '../../ui/confirm-dialog/confirm-dialog.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { MapAppLinkComponent } from '../../ui/map-app-link/map-app-link.component';
import { ObjectTitleComponent } from '../../ui/object-title/object-title.component';
import { PhotoDialogComponent } from '../../ui/photo-dialog/photo-dialog.component';
import { PhotoStripComponent, type StripPhoto } from '../../ui/photo-strip/photo-strip.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import { ScrollFadeDirective } from '../../ui/scroll-fade/scroll-fade.directive';
import { SectionComponent } from '../../ui/section/section.component';
import { ToastService } from '../../ui/toast/toast.service';
import { FindFormComponent, type FindSubmission } from '../add-entry/find-form.component';
import { EntriesStore } from '../entries/entries.store';
import { findSubline } from '../entries/find-subline';
import { SpeciesStore } from '../species/species.store';
import { ObjectSheetStore } from './object-sheet.store';

/** The object sheet of a find, per the board `FindViewBody`. */
@Component({
  selector: 'app-find-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    ConfirmDialogComponent,
    FindFormComponent,
    ListRowComponent,
    MapAppLinkComponent,
    ObjectTitleComponent,
    PhotoDialogComponent,
    PhotoStripComponent,
    RowGroupComponent,
    ScrollFadeDirective,
    SectionComponent,
    TranslatePipe,
  ],
  templateUrl: './find-sheet.component.html',
  styleUrl: './find-sheet.component.scss',
})
export class FindSheetComponent {
  private readonly account = inject(AccountStore);
  private readonly names = inject(PersonNamesStore);
  private readonly groups = inject(GroupsStore);
  private readonly i18n = inject(I18nService);
  private readonly toasts = inject(ToastService);
  private readonly arten = inject(SpeciesStore);
  private readonly eintraege = inject(EntriesStore);
  protected readonly sheet = inject(ObjectSheetStore);
  protected readonly wide = inject(ViewportService).wide;
  private readonly photos = inject(PhotosApi);
  private readonly injector = inject(Injector);

  readonly find = input.required<Find>();

  readonly closed = output();

  protected readonly editing = this.sheet.editing;
  protected readonly deleteAsk = signal(false);
  protected readonly busy = signal(false);
  protected readonly viewing = signal<number | null>(null);
  private tile: HTMLElement | null = null;

  /** The photos of the find that the service knows. The strip and the form show them. */
  private readonly photoList = rxResource({
    params: () => this.find().id,
    stream: ({ params: findId }) =>
      this.photos.list({ findId }).pipe(
        map((page): readonly Photo[] => page.items),
        // Without the list, the form shows only the new files.
        catchError(() => of<readonly Photo[]>([])),
      ),
  });
  protected readonly held = computed(() => this.photoList.value() ?? []);

  protected readonly strip = computed<readonly StripPhoto[]>(() =>
    this.held().map((one) => ({ id: one.id, path: photoPath(one.id, 'list'), lead: one.lead })),
  );

  protected readonly art = computed(() => {
    const id = this.find().speciesId;
    return id === null ? null : this.arten.entryById(id);
  });

  protected readonly speciesName = computed(() => this.art()?.name ?? '');
  protected readonly location = computed<readonly [number, number]>(() => [this.find().lon, this.find().lat]);

  /** The muted line below the name: date, count and reporter. */
  protected readonly sub = computed(() => {
    const date = longDate(this.find().foundOn, this.i18n.locale());
    return findSubline(this.i18n, date, this.find().count, this.reporterName());
  });

  /** The line of the delete dialog: species and date, per the board `MapDialogFindDelete`. */
  protected readonly deleteMeta = computed(
    () => `${this.speciesName()} · ${longDate(this.find().foundOn, this.i18n.locale())}`,
  );

  protected readonly thumbPhoto = computed(() => this.strip()[0]?.path ?? '');

  protected readonly shared = computed(() => this.find().visibility === 'shared');

  /** The group of a shared find, when the person knows it. */
  protected readonly groupName = computed(() => {
    const id = this.find().groupId;
    return id === null ? null : ((this.groups.groups() ?? []).find((group) => group.id === id)?.name ?? null);
  });

  constructor() {
    void this.arten.loadBundle();
    if (this.groups.groups() === null) this.groups.load(false, true);
  }

  /** The own name comes from the account. Another name only shows with a shared group. */
  private reporterName(): string | null {
    const find = this.find();
    if (this.account.owns(find.ownerId)) return this.eintraege.reporter() ?? '';
    return this.names.nameOf(find.ownerId);
  }

  /** Removes a photo of the find and loads the list again. */
  protected async removePhoto(id: string): Promise<void> {
    try {
      await firstValueFrom(this.photos.remove(id));
    } catch {
      this.toasts.error(this.i18n.translate('melden.verworfen'));
      return;
    }
    this.photoList.reload();
  }

  protected openPhoto(index: number): void {
    const active = document.activeElement;
    this.tile = active instanceof HTMLElement ? active : null;
    this.viewing.set(index);
  }

  protected closeGallery(): void {
    this.viewing.set(null);
    afterNextRender(() => this.tile?.focus(), { injector: this.injector });
  }

  protected async save(submission: FindSubmission): Promise<void> {
    this.busy.set(true);
    try {
      if (await this.eintraege.updateFind(this.find(), submission.input)) {
        this.toasts.success(this.i18n.translate('objekt.gespeichert'));
        this.sheet.setEditing(false);
      }
    } finally {
      this.busy.set(false);
    }
  }

  protected async remove(): Promise<void> {
    this.deleteAsk.set(false);
    if (await this.eintraege.deleteFind(this.find().id)) {
      this.toasts.success(this.i18n.translate('fund.geloescht'));
      this.closed.emit();
    }
  }
}

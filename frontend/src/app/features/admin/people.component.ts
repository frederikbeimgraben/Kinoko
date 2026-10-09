import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { Person, Role } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import type { TranslationKey } from '../../core/i18n/translations';
import { joined } from '../../core/i18n/numbers';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ViewportService } from '../../core/layout/viewport.service';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { CheckRowComponent } from '../../ui/check-row/check-row.component';
import { ConfirmDialogComponent } from '../../ui/confirm-dialog/confirm-dialog.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { OverlayHostComponent } from '../../ui/overlay-host/overlay-host.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import { SearchFieldComponent } from '../../ui/search-field/search-field.component';
import { SheetComponent } from '../../ui/sheet/sheet.component';
import { RowGroupSkeletonComponent } from '../../ui/skeleton/row-group-skeleton.component';
import { StateViewComponent } from '../../ui/state-view/state-view.component';
import { SvgIconComponent } from '../../ui/svg-icon/svg-icon.component';
import { AdminStore } from './admin.store';
import { roleName } from './role-name';

/** The built-in role of each signed-in person. Nobody assigns it, so the sheet shows it as held and locked. */
const EVERY_ONE = 'user';

/** The admin role. The admin group of the SSO also gives it. */
const ADMIN = 'admin';

/** A row of the person list: the name and the roles below it. */
interface Row {
  id: string;
  name: string;
  roles: string;
}

/** A role in the assignment sheet. */
interface Choice {
  id: string;
  name: string;
  checked: boolean;
  /** The SSO or the sign-in gives the role: the box is checked and does not toggle. */
  locked: boolean;
  /** Why the box is locked. */
  note?: TranslationKey;
}

/** The person list: search, accounts and their roles. A row opens the assignment. */
@Component({
  selector: 'app-people',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    CheckRowComponent,
    ConfirmDialogComponent,
    ListRowComponent,
    OverlayHostComponent,
    PageHeaderComponent,
    RowGroupComponent,
    RowGroupSkeletonComponent,
    SearchFieldComponent,
    SheetComponent,
    StateViewComponent,
    SvgIconComponent,
    TranslatePipe,
  ],
  templateUrl: './people.component.html',
  styleUrl: './people.component.scss',
})
export class PeopleComponent {
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly store = inject(AdminStore);

  protected readonly wide = inject(ViewportService).wide;
  protected readonly search = signal('');
  protected readonly editing = signal<Person | null>(null);
  protected readonly chosen = signal<ReadonlySet<string>>(new Set());
  protected readonly saving = this.store.saving;
  protected readonly removing = signal<Person | null>(null);
  protected readonly loaded = computed(() => this.store.people() !== null);

  protected readonly rows = computed<Row[]>(() =>
    (this.store.people() ?? []).map((person) => ({
      id: person.id,
      name: person.name ?? person.email ?? this.i18n.translate('admin.people.noName'),
      roles: joined(this.heldNames(person)),
    })),
  );

  protected readonly choices = computed<Choice[]>(() => {
    const groupAdmin = this.editing()?.groupAdmin ?? false;
    const locale = this.i18n.locale();
    return (this.store.roles() ?? [])
      .map((role): Choice => {
        const note = lockNote(role, groupAdmin);
        const name = roleName(this.i18n, role.name);
        return note === undefined
          ? { id: role.id, name, checked: this.chosen().has(role.id), locked: false }
          : { id: role.id, name, checked: true, locked: true, note };
      })
      .sort((one, other) => one.name.localeCompare(other.name, locale));
  });

  protected readonly deleteQuestion = computed(() =>
    this.i18n.translate('admin.people.deleteQuestion', { name: this.removing()?.name ?? '' }),
  );

  constructor() {
    this.store.loadPeople('');
    // Without the roles, the assignment sheet is empty.
    this.store.loadRoles();
  }

  protected onSearch(text: string): void {
    this.search.set(text);
    this.store.loadPeople(text.trim());
  }

  protected edit(id: string): void {
    const person = this.store.people()?.find((one) => one.id === id) ?? null;
    this.editing.set(person);
    this.chosen.set(new Set(person?.roles.map((role) => role.id) ?? []));
  }

  protected toggle(id: string, on: boolean): void {
    this.chosen.update((held) => {
      const next = new Set(held);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  /** The service refuses to take the admin role from the last admin. The sheet then stays open. */
  protected save(): void {
    const person = this.editing();
    if (person === null) return;
    this.store.setRoles({
      id: person.id,
      roles: [...this.chosen()],
      onDone: () => {
        this.editing.set(null);
      },
    });
  }

  /** The stored roles. Before them come the admin role when the SSO group gives it, and the base role. */
  private heldNames(person: Person): string[] {
    const roles = this.store.roles() ?? [];
    const implied = person.groupAdmin && !person.roles.some((role) => role.slug === ADMIN);
    const admin = implied ? roles.filter((role) => role.slug === ADMIN) : [];
    // A stored base role does not show a second time.
    const base = roles.filter(
      (role) => role.slug === EVERY_ONE && !person.roles.some((one) => one.slug === EVERY_ONE),
    );
    return [...admin, ...base, ...person.roles].map((role) => roleName(this.i18n, role.name));
  }

  protected askDelete(): void {
    this.removing.set(this.editing());
    this.editing.set(null);
  }

  protected remove(): void {
    const person = this.removing();
    this.removing.set(null);
    if (person !== null) this.store.deletePerson({ id: person.id });
  }

  protected close(): void {
    this.editing.set(null);
  }

  protected back(): void {
    void this.router.navigateByUrl('/verwaltung');
  }
}

/** Why a role in the sheet is held without a choice, or nothing for a free role. */
function lockNote(role: Role, groupAdmin: boolean): TranslationKey | undefined {
  if (role.slug === EVERY_ONE) return 'admin.people.everyOne';
  return groupAdmin && role.slug === ADMIN ? 'admin.people.fromGroup' : undefined;
}

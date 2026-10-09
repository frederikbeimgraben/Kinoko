import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  signal,
  type Signal,
} from '@angular/core';
import { Router } from '@angular/router';
import type { Permission, PermissionArea, Role } from '../../core/api/models';
import { PERMISSION_AREAS } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { injectRouteParam } from '../../core/navigation/route-param';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { ConfirmDialogComponent } from '../../ui/confirm-dialog/confirm-dialog.component';
import { FormFieldComponent } from '../../ui/form-field/form-field.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import { SectionComponent } from '../../ui/section/section.component';
import { RowGroupSkeletonComponent } from '../../ui/skeleton/row-group-skeleton.component';
import { StateViewComponent } from '../../ui/state-view/state-view.component';
import { SwitchComponent } from '../../ui/switch/switch.component';
import { AdminStore } from './admin.store';
import { AREA_TEXT, PERMISSION_TEXT } from './labels';
import { roleAbout, roleName } from './role-name';

/** The route segment that creates a new role. */
export const NEW_ROLE = 'neu';

/** A permission in the matrix. */
interface Right {
  key: Permission;
  titel: string;
  checked: boolean;
}

/** A group of the matrix, by area. */
interface Area {
  area: PermissionArea;
  titel: string;
  rights: Right[];
}

/** A field that starts with a value of the role. After that, the input of the person stays. */
function seeded<T>(role: Signal<Role | null>, pick: (role: Role | null) => T) {
  return linkedSignal<Role | null, T>({
    source: role,
    computation: (next, previous) =>
      previous !== undefined && previous.source?.id === next?.id ? previous.value : pick(next),
  });
}

/** Creates or changes a role. A built-in role keeps its name and cannot be deleted. */
@Component({
  selector: 'app-role',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    ListRowComponent,
    ConfirmDialogComponent,
    FormFieldComponent,
    PageHeaderComponent,
    RowGroupComponent,
    RowGroupSkeletonComponent,
    SectionComponent,
    StateViewComponent,
    SwitchComponent,
    TranslatePipe,
  ],
  templateUrl: './role.component.html',
  styleUrl: './role.component.scss',
})
export class RoleComponent {
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly store = inject(AdminStore);

  private readonly id = injectRouteParam('id', NEW_ROLE);

  protected readonly creating = computed(() => this.id() === NEW_ROLE);
  protected readonly role = computed<Role | null>(
    () => this.store.roles()?.find((one) => one.id === this.id()) ?? null,
  );
  protected readonly waiting = computed(() => !this.creating() && this.store.roles() === null);
  /** The list is there, but it has no role with this id. */
  protected readonly missing = computed(
    () => !this.creating() && this.store.roles() !== null && this.role() === null,
  );
  protected readonly locked = computed(() => this.role()?.builtIn === true);
  protected readonly saving = this.store.saving;

  protected readonly name = seeded(this.role, (role) => role?.name ?? '');
  protected readonly slug = seeded(this.role, (role) => role?.slug ?? '');
  protected readonly description = seeded(this.role, (role) =>
    role === null ? '' : roleAbout(this.i18n, role),
  );
  protected readonly chosen = seeded<ReadonlySet<Permission>>(
    this.role,
    (role) => new Set(role?.permissions),
  );
  protected readonly confirming = signal(false);

  /** The head shows the name of the role. A new role shows "New role". */
  protected readonly title = computed(() => {
    const current = this.role();
    if (current) return roleName(this.i18n, current.name);
    return this.i18n.translate(this.creating() ? 'admin.role.new' : 'admin.roles.title');
  });

  /** The name field of a built-in role shows the translated name, not the key. */
  protected readonly displayName = computed(() =>
    this.locked() ? roleName(this.i18n, this.name()) : this.name(),
  );

  protected readonly ready = computed(() => this.name().trim().length > 0 && this.slug().trim().length > 0);

  protected readonly areas = computed<Area[]>(() => {
    const catalogue = this.store.catalogue() ?? [];
    const held = this.chosen();
    return PERMISSION_AREAS.map((area) => ({
      area,
      titel: this.i18n.translate(AREA_TEXT[area]),
      rights: catalogue
        .filter((entry) => entry.area === area)
        .map((entry) => ({
          key: entry.key,
          titel: this.i18n.translate(PERMISSION_TEXT[entry.key]),
          checked: this.locked()
            ? this.role()?.permissions.includes(entry.key) === true
            : held.has(entry.key),
        })),
    })).filter((group) => group.rights.length > 0);
  });

  protected readonly deleteQuestion = computed(() => {
    const current = this.role();
    const name = current ? roleName(this.i18n, current.name) : '';
    return this.i18n.translate('admin.role.deleteQuestion', { name });
  });

  constructor() {
    this.store.loadRoles();
    this.store.loadCatalogue();
  }

  protected toggle(permission: Permission, on: boolean): void {
    this.chosen.update((held) => {
      const next = new Set(held);
      if (on) next.add(permission);
      else next.delete(permission);
      return next;
    });
  }

  protected save(): void {
    if (!this.ready()) return;
    const permissions = [...this.chosen()];
    // The built-in text is not stored. Only a text of the person goes to the service.
    const current = this.role();
    const typed = this.description().trim();
    const about = current === null ? '' : roleAbout(this.i18n, { ...current, description: '' });
    const description = typed === '' || (current?.builtIn === true && typed === about) ? null : typed;
    const onDone = (): void => {
      this.leave();
    };
    this.store.saveRole(
      this.creating()
        ? { input: { slug: this.slug().trim(), name: this.name().trim(), description, permissions }, onDone }
        : { id: this.id(), patch: { name: this.name().trim(), description, permissions }, onDone },
    );
  }

  protected remove(): void {
    this.confirming.set(false);
    this.store.deleteRole({
      id: this.id(),
      onDone: () => {
        this.leave();
      },
    });
  }

  protected back(): void {
    this.leave();
  }

  private leave(): void {
    void this.router.navigateByUrl('/verwaltung/rollen');
  }
}

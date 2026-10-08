import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { GroupsState } from '../../core/access/groups.state';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { ConfirmDialogComponent } from '../../ui/confirm-dialog/confirm-dialog.component';
import { FormFieldComponent } from '../../ui/form-field/form-field.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { RowGroupSkeletonComponent } from '../../ui/skeleton/row-group-skeleton.component';
import { StateViewComponent } from '../../ui/state-view/state-view.component';
import { GroupMembersComponent } from '../account/group-members.component';
import { AdminSharedStore } from './admin-shared.store';

/** A group in the administration: rename it, remove a member or delete it. */
@Component({
  selector: 'app-admin-group',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    ConfirmDialogComponent,
    FormFieldComponent,
    GroupMembersComponent,
    PageHeaderComponent,
    RowGroupSkeletonComponent,
    StateViewComponent,
    TranslatePipe,
  ],
  templateUrl: './admin-group.component.html',
  styleUrl: './admin-group.component.scss',
})
export class AdminGroupComponent {
  readonly id = input.required<string>();

  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly state = inject(GroupsState);
  private readonly writes = inject(AdminSharedStore);

  protected readonly asking = signal(false);
  protected readonly saving = this.writes.saving;

  protected readonly loaded = computed(() => this.state.groups() !== null);
  protected readonly group = computed(() => this.state.one(this.id()));
  private readonly savedName = computed(() => this.group()?.name ?? '');
  /** A member change gives a new group object with the same name. The input then stays. */
  protected readonly name = linkedSignal(() => this.savedName());
  protected readonly title = computed(() => this.group()?.name ?? this.i18n.translate('admin.groups.title'));

  protected readonly question = computed(
    () => `${this.title()} ${this.i18n.translate('group.deleteConfirm')}`,
  );

  constructor() {
    if (this.state.groups() === null) this.state.load(true);
  }

  protected removeMember(userId: string): void {
    this.writes.removeMember({ id: this.id(), userId });
  }

  protected save(): void {
    const name = this.name().trim();
    if (name === '') return;
    this.writes.renameGroup({
      id: this.id(),
      name,
      onDone: () => {
        this.back();
      },
    });
  }

  protected remove(): void {
    this.writes.removeGroup({
      id: this.id(),
      onDone: () => {
        this.asking.set(false);
        this.back();
      },
    });
  }

  protected back(): void {
    void this.router.navigateByUrl('/verwaltung/gruppen');
  }
}

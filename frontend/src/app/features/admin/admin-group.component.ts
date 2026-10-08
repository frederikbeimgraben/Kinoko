import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { GroupsStore } from '../../core/access/groups.store';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { ConfirmDialogComponent } from '../../ui/confirm-dialog/confirm-dialog.component';
import { FormFieldComponent } from '../../ui/form-field/form-field.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { GroupMembersComponent } from '../account/group-members.component';

/** Eine Gruppe in der Verwaltung: umbenennen, Mitglied entfernen, löschen. */
@Component({
  selector: 'app-admin-group',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    ConfirmDialogComponent,
    FormFieldComponent,
    GroupMembersComponent,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './admin-group.component.html',
  styleUrl: './admin-group.component.scss',
})
export class AdminGroupComponent {
  readonly id = input.required<string>();

  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly state = inject(GroupsStore);

  protected readonly nameChoice = signal<string | null>(null);
  protected readonly asking = signal(false);
  protected readonly saving = signal(false);

  protected readonly group = computed(() => this.state.one(this.id()));
  protected readonly name = computed(() => this.nameChoice() ?? this.group()?.name ?? '');
  protected readonly title = computed(() => this.group()?.name ?? this.i18n.translate('admin.groups.title'));

  protected readonly question = computed(
    () => `${this.title()} ${this.i18n.translate('group.deleteConfirm')}`,
  );

  constructor() {
    if (this.state.groups() === null) this.state.load(true);
  }

  protected removeMember(userId: string): void {
    void this.state.removeMember(this.id(), userId);
  }

  protected save(): void {
    const name = this.name().trim();
    if (name === '') return;
    this.saving.set(true);
    void this.state.rename(this.id(), name).then((group) => {
      this.saving.set(false);
      if (group !== null) this.back();
    });
  }

  protected remove(): void {
    void this.state.remove(this.id()).then((done) => {
      if (!done) return;
      this.asking.set(false);
      this.back();
    });
  }

  protected back(): void {
    void this.router.navigateByUrl('/verwaltung/gruppen');
  }
}

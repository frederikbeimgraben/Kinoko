import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { GroupsState } from '../../core/access/groups.state';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { AddRowComponent } from '../../ui/add-row/add-row.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { GroupSheetComponent } from './group-sheet.component';
import { memberCount } from './group-text';

/** Eine Zeile der Gruppenliste. */
interface Row {
  id: string;
  name: string;
  members: string;
}

/** Die Gruppen des Kontos: anlegen, beitreten, öffnen. */
@Component({
  selector: 'app-groups',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AddRowComponent, GroupSheetComponent, ListRowComponent, PageHeaderComponent, TranslatePipe],
  templateUrl: './groups.component.html',
  styleUrl: './groups.component.scss',
})
export class GroupsComponent {
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly state = inject(GroupsState);

  protected readonly creating = signal(false);
  protected readonly joining = signal(false);
  protected readonly busy = signal(false);

  protected readonly rows = computed<Row[]>(() =>
    (this.state.groups() ?? []).map((group) => ({
      id: group.id,
      name: group.name,
      members: memberCount(this.i18n, group.members.length),
    })),
  );

  constructor() {
    this.state.load();
  }

  protected create(name: string): void {
    if (name.trim() === '') return;
    this.busy.set(true);
    this.state.create(name.trim()).subscribe({
      next: () => {
        this.busy.set(false);
        this.creating.set(false);
      },
      error: () => {
        this.busy.set(false);
      },
    });
  }

  protected join(code: string): void {
    if (code.trim() === '') return;
    this.busy.set(true);
    this.state.join(code.trim()).subscribe({
      next: () => {
        this.busy.set(false);
        this.joining.set(false);
      },
      error: () => {
        this.busy.set(false);
      },
    });
  }

  protected open(id: string): void {
    void this.router.navigate(['/konto/gruppen', id]);
  }

  protected back(): void {
    void this.router.navigateByUrl('/konto');
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { BadgeComponent } from '@stupa-makers/ui-kit';
import type { Person, Role } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { CheckRowComponent } from '../../ui/check-row/check-row.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { SearchFieldComponent } from '../../ui/search-field/search-field.component';
import { OverlayHostComponent } from '../../ui/overlay-host/overlay-host.component';
import { SheetComponent, type DetentSize } from '../../ui/sheet/sheet.component';
import { AdminState } from './admin.state';

/** Das Blatt der Zuweisung ist so hoch wie sein Inhalt. */
const DETENTS: readonly [DetentSize, DetentSize, DetentSize] = ['content', 'content', 'content'];

/** Die feste Rolle, die jede angemeldete Person trägt. Sie wird nicht vergeben. */
const EVERY_ONE = 'user';

/** Eine Rolle neben einer Person. */
interface Mark {
  id: string;
  name: string;
  /** Die Rolle Admin trägt die Primärfarbe, jede andere den Grundton. */
  lead: boolean;
}

/** Eine Zeile der Personenliste. */
interface Row {
  id: string;
  name: string;
  email: string;
  roles: readonly Mark[];
}

/** Eine Rolle im Blatt der Zuweisung. */
interface Choice {
  id: string;
  name: string;
  checked: boolean;
}

/** Die Personenliste: Suche, Konten und ihre Rollen. Eine Zeile weist zu. */
@Component({
  selector: 'app-people',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    BadgeComponent,
    CheckRowComponent,
    ListRowComponent,
    OverlayHostComponent,
    PageHeaderComponent,
    SearchFieldComponent,
    SheetComponent,
    TranslatePipe,
  ],
  templateUrl: './people.component.html',
  styleUrl: './people.component.scss',
})
export class PeopleComponent {
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly state = inject(AdminState);

  protected readonly DETENTS = DETENTS;
  protected readonly search = signal('');
  protected readonly editing = signal<Person | null>(null);
  protected readonly chosen = signal<ReadonlySet<string>>(new Set());
  protected readonly saving = signal(false);

  protected readonly rows = computed<Row[]>(() =>
    (this.state.people() ?? []).map((person) => ({
      id: person.id,
      name: person.name ?? this.i18n.translate('admin.people.noName'),
      email: person.email ?? '',
      roles: person.roles.map((role) => ({
        id: role.id,
        name: this.i18n.translate(role.name as TranslationKey),
        lead: role.slug === 'admin',
      })),
    })),
  );

  /** Nur freie Rollen: die feste Rolle jeder Person wird nicht vergeben. */
  private readonly assignable = computed<readonly Role[]>(() =>
    (this.state.roles() ?? []).filter((role) => role.slug !== EVERY_ONE),
  );

  protected readonly choices = computed<Choice[]>(() =>
    this.assignable().map((role) => ({
      id: role.id,
      name: this.i18n.translate(role.name as TranslationKey),
      checked: this.chosen().has(role.id),
    })),
  );

  constructor() {
    this.state.loadPeople('');
    // Ohne die Rollen bliebe das Blatt der Zuweisung leer.
    this.state.loadRoles();
  }

  protected onSearch(text: string): void {
    this.search.set(text);
    this.state.loadPeople(text.trim());
  }

  protected edit(id: string): void {
    const person = this.state.people()?.find((one) => one.id === id) ?? null;
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

  protected save(): void {
    const person = this.editing();
    if (person === null || this.saving()) return;
    this.saving.set(true);
    this.state.setRoles(person.id, [...this.chosen()]).subscribe({
      next: () => {
        this.saving.set(false);
        this.editing.set(null);
      },
      // Der Dienst weist ab, wer der letzten Person die Rolle Admin nimmt. Das
      // Blatt bleibt dann offen, damit die Wahl nicht verloren geht.
      error: () => {
        this.saving.set(false);
      },
    });
  }

  protected close(): void {
    this.editing.set(null);
  }

  protected back(): void {
    void this.router.navigateByUrl('/verwaltung');
  }
}

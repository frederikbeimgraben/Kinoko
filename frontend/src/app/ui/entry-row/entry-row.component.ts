import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LevelPillComponent } from '../level-pill/level-pill.component';

/** Ein Fund, Marker oder eine Zone, wie die Eintragszeile sie zeigt. */
export interface EntryRowEntry {
  readonly title: string;
  readonly meta: string;
  readonly note?: string;
}

/** Eintragszeile mit Titel, Meta, Notiz und dem Zustand „ausstehend“ als Plakette. */
@Component({
  selector: 'app-entry-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LevelPillComponent, TranslatePipe],
  templateUrl: './entry-row.component.html',
  styleUrl: './entry-row.component.scss',
})
export class EntryRowComponent {
  readonly entry = input.required<EntryRowEntry>();
  readonly pending = input(false);

  readonly chosen = output();
}

import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ActionBarComponent } from '../action-bar/action-bar.component';
import { OverlayHostComponent } from '../overlay-host/overlay-host.component';
import { SheetComponent, type DetentSize } from '../sheet/sheet.component';

/** Das Blatt ist so hoch wie sein Inhalt. */
const DETENTS: readonly [DetentSize, DetentSize, DetentSize] = ['content', 'content', 'content'];

/** Ein Blatt mit Titel, Feldern und zwei Aktionen. Die Felder kommen von außen. */
@Component({
  selector: 'app-form-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ActionBarComponent, OverlayHostComponent, SheetComponent],
  templateUrl: './form-sheet.component.html',
  styleUrl: './form-sheet.component.scss',
})
export class FormSheetComponent {
  readonly title = input.required<string>();
  readonly submit = input.required<string>();
  readonly secondary = input('');
  /** Die zweite Aktion trägt die Gefahrfarbe, etwa beim Löschen. */
  readonly secondaryDanger = input(false);
  readonly busy = input(false);

  readonly submitted = output();
  readonly secondaryPressed = output();
  readonly cancelled = output();

  protected readonly DETENTS = DETENTS;
}

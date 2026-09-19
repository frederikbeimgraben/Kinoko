import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ViewportService } from '../../core/layout/viewport.service';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { FormFieldComponent } from '../../ui/form-field/form-field.component';
import { OverlayHostComponent } from '../../ui/overlay-host/overlay-host.component';
import { SheetComponent, type DetentSize } from '../../ui/sheet/sheet.component';

/** Das Blatt ist so hoch wie sein Inhalt. */
const DETENTS: readonly [DetentSize, DetentSize, DetentSize] = ['content', 'content', 'content'];

/** Ein Blatt mit einem Feld: Gruppe anlegen, Gruppe beitreten. */
@Component({
  selector: 'app-group-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ActionBarComponent, FormFieldComponent, OverlayHostComponent, SheetComponent, TranslatePipe],
  templateUrl: './group-sheet.component.html',
  styleUrl: './group-sheet.component.scss',
})
export class GroupSheetComponent {
  readonly title = input.required<string>();
  readonly label = input.required<string>();
  readonly placeholder = input.required<string>();
  readonly submit = input.required<string>();
  /** Die Beschriftung steht als Abschnittszeile über dem Feld, nicht im Feld. */
  readonly section = input(false);
  readonly busy = input(false);

  readonly submitted = output<string>();
  readonly cancelled = output();

  protected readonly DETENTS = DETENTS;
  protected readonly wide = inject(ViewportService).wide;
  protected readonly text = signal('');
}

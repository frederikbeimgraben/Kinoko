import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ActionBarComponent } from '../action-bar/action-bar.component';
import { OverlayHostComponent } from '../overlay-host/overlay-host.component';
import { SheetComponent, type DetentSize } from '../sheet/sheet.component';

/** The sheet is as high as its content. */
const DETENTS: readonly [DetentSize, DetentSize, DetentSize] = ['content', 'content', 'content'];

/** A sheet with a title, fields and two actions. The caller gives the fields. */
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
  /** The second action has the danger colour, for example for delete. */
  readonly secondaryDanger = input(false);
  readonly busy = input(false);

  readonly submitted = output();
  readonly secondaryPressed = output();
  readonly cancelled = output();

  protected readonly DETENTS = DETENTS;
}

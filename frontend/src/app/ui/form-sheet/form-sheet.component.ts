import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { ViewportService } from '../../core/layout/viewport.service';
import { ActionBarComponent } from '../action-bar/action-bar.component';
import { OverlayHostComponent } from '../overlay-host/overlay-host.component';
import { SheetComponent, type DetentSize } from '../sheet/sheet.component';
import type { IconName } from '../svg-icon/svg-icon.component';

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
  /** An icon before the label of the main action. */
  readonly submitIcon = input<IconName>();
  readonly secondary = input('');
  /** The second action has the danger colour, for example for delete. */
  readonly secondaryDanger = input(false);
  readonly busy = input(false);

  readonly submitted = output();
  readonly secondaryPressed = output();
  readonly cancelled = output();

  protected readonly DETENTS = DETENTS;

  /** On the desktop the sheet is a modal. The content is in this view, so the class goes on it here. */
  protected readonly modal = inject(ViewportService).wide;
}

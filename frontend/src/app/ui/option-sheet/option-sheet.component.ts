import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { ActionBarComponent } from '../action-bar/action-bar.component';
import { CheckRowComponent } from '../check-row/check-row.component';
import { ListRowComponent } from '../list-row/list-row.component';
import { OverlayHostComponent } from '../overlay-host/overlay-host.component';
import { ScrollFadeDirective } from '../scroll-fade/scroll-fade.directive';
import { SheetComponent } from '../sheet/sheet.component';
import { SvgIconComponent, type IconName } from '../svg-icon/svg-icon.component';

/** One row to choose: icon, title and its value. */
export interface OptionSheetOption {
  readonly id: string;
  readonly title: string;
  readonly icon?: IconName;
  readonly value?: string;
}

/** A sheet to choose from: a card of rows below the title. One choice or many. */
@Component({
  selector: 'app-option-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    CheckRowComponent,
    ListRowComponent,
    OverlayHostComponent,
    ScrollFadeDirective,
    SheetComponent,
    SvgIconComponent,
  ],
  templateUrl: './option-sheet.component.html',
  styleUrl: './option-sheet.component.scss',
})
export class OptionSheetComponent {
  readonly open = input(false);
  readonly title = input.required<string>();
  readonly options = input.required<readonly OptionSheetOption[]>();
  /** The chosen row shows a check mark instead of a chevron. */
  readonly selected = input<string | null>(null);
  /** Many choices: check rows instead of chevron rows, and a foot with one action. */
  readonly multiple = input(false);
  /** The label of the foot action. Only many choices need it. */
  readonly confirmLabel = input<string>('');
  /** A sheet over its own ground darkens it. A sheet over the map does not. */
  readonly dims = input(true);

  readonly chosen = output<string>();
  /** For many choices: the chosen set, sent by the foot action. */
  readonly confirmed = output<readonly string[]>();
  readonly closed = output();

  private readonly marks = signal<ReadonlySet<string>>(new Set());

  protected checked(id: string): boolean {
    return this.marks().has(id);
  }

  protected toggle(id: string, on: boolean): void {
    this.marks.update((held) => {
      const next = new Set(held);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  protected confirm(): void {
    this.confirmed.emit([...this.marks()]);
    this.marks.set(new Set());
  }

  protected dismiss(): void {
    this.marks.set(new Set());
    this.closed.emit();
  }
}

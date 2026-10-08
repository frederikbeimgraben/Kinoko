import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  input,
  output,
  viewChild,
} from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ActionBarComponent } from '../action-bar/action-bar.component';
import { OverlayHostComponent } from '../overlay-host/overlay-host.component';
import { ScrollFadeDirective } from '../scroll-fade/scroll-fade.directive';
import { SheetComponent } from '../sheet/sheet.component';

/** A sheet for filter content: the overview with reset, a group with a way back. */
@Component({
  selector: 'app-filter-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ActionBarComponent, OverlayHostComponent, ScrollFadeDirective, SheetComponent, TranslatePipe],
  templateUrl: './filter-sheet.component.html',
  styleUrl: './filter-sheet.component.scss',
})
export class FilterSheetComponent {
  readonly open = input.required<boolean>();
  readonly title = input.required<string>();
  readonly resetEnabled = input(false);
  /** Without a label, the sheet has no foot and ends at the content. */
  readonly primaryLabel = input<string>();
  /** A group shows the back button instead of reset and the close button. */
  readonly back = input(false);

  readonly resetClick = output();
  readonly primaryClick = output();
  readonly backClick = output();
  readonly closed = output();

  /** A group has the way back. Reset belongs to the overview. */
  protected readonly showsReset = computed(() => this.resetEnabled() && !this.back());

  private readonly content = viewChild<ElementRef<HTMLElement>>('content');

  constructor() {
    // A new group starts at the top, not at the scroll position of the overview.
    afterRenderEffect(() => {
      this.title();
      const box = this.content()?.nativeElement;
      if (box) box.scrollTop = 0;
    });
  }
}

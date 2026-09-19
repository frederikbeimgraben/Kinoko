import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  input,
  output,
  viewChild,
} from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { OverlayHostComponent } from '../overlay-host/overlay-host.component';
import { ScrollFadeDirective } from '../scroll-fade/scroll-fade.directive';
import { SheetComponent, type DetentSize } from '../sheet/sheet.component';
import { SvgIconComponent } from '../svg-icon/svg-icon.component';

/** Das Filterblatt steht über der Liste und füllt den Streifen unter dem Kopf. */
const DETENTS: readonly [DetentSize, DetentSize, DetentSize] = [1, 1, 1];

/** Blatt für Filterinhalte: Übersicht mit Zurücksetzen, Gruppe mit Weg zurück. */
@Component({
  selector: 'app-filter-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OverlayHostComponent, ScrollFadeDirective, SheetComponent, SvgIconComponent, TranslatePipe],
  templateUrl: './filter-sheet.component.html',
  styleUrl: './filter-sheet.component.scss',
})
export class FilterSheetComponent {
  protected readonly detents = DETENTS;

  readonly open = input.required<boolean>();
  readonly title = input.required<string>();
  readonly resetEnabled = input(false);
  /** Ohne Beschriftung bleibt der Fuß aus: das Blatt endet am Inhalt. */
  readonly primaryLabel = input<string>();
  /** Eine Gruppe zeigt den Pfeil zurück statt Zurücksetzen und X. */
  readonly back = input(false);

  readonly resetClick = output();
  readonly primaryClick = output();
  readonly backClick = output();
  readonly closed = output();

  private readonly content = viewChild<ElementRef<HTMLElement>>('content');

  constructor() {
    // Eine neue Gruppe beginnt oben, nicht an der Stelle der Übersicht.
    afterRenderEffect(() => {
      this.title();
      const box = this.content()?.nativeElement;
      if (box) box.scrollTop = 0;
    });
  }
}

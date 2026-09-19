import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { ActionBarComponent } from '../action-bar/action-bar.component';
import { CheckRowComponent } from '../check-row/check-row.component';
import { ListRowComponent } from '../list-row/list-row.component';
import { OverlayHostComponent } from '../overlay-host/overlay-host.component';
import { ScrollFadeDirective } from '../scroll-fade/scroll-fade.directive';
import { SheetComponent, type Detent, type DetentSize } from '../sheet/sheet.component';
import { SvgIconComponent, type IconName } from '../svg-icon/svg-icon.component';

/** Eine Zeile zur Wahl: Zeichen, Titel und ihr Wert. */
export interface OptionSheetOption {
  readonly id: string;
  readonly title: string;
  readonly icon?: IconName;
  readonly value?: string;
}

/** Ohne Vorgabe fasst das Blatt nur seinen Inhalt. */
const DETENTS: readonly [DetentSize, DetentSize, DetentSize] = ['content', 'content', 'content'];

/** Blatt zur Wahl: unter dem Titel des Blatts eine Karte aus Zeilen. Einfach- oder Mehrfachwahl. */
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
  /** Die gewählte Zeile trägt einen Haken statt eines Pfeils. */
  readonly selected = input<string | null>(null);
  /** Mehrfachwahl: Prüfzeilen statt Pfeilzeilen, Fuß mit einer Aktion. */
  readonly multiple = input(false);
  /** Die Beschriftung der Fußaktion. Nur bei Mehrfachwahl nötig. */
  readonly confirmLabel = input<string>('');
  readonly detents = input<readonly [DetentSize, DetentSize, DetentSize]>(DETENTS);
  readonly detent = input<Detent>(2);
  /** Ein Blatt über eigenem Grund dunkelt ihn ab; eines über der Karte nicht. */
  readonly dims = input(true);

  readonly chosen = output<string>();
  /** Bei Mehrfachwahl: die gewählte Menge, ausgelöst über die Fußaktion. */
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

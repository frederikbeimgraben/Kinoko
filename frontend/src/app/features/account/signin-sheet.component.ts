import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, viewChild } from '@angular/core';
import { AuthService } from '../../core/auth';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ViewportService } from '../../core/layout/viewport.service';
// Diese Datei laedt beim Start mit. Sie nimmt die Bausteine darum einzeln
// und nicht ueber `ui/index.ts`: das Sammelmodul zieht jeden Baustein in das
// erste Buendel, auch die Saisonkurve und die Zeitleiste, die hier niemand
// braucht. Das waren 81 kB.
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { OverlayHostComponent } from '../../ui/overlay-host/overlay-host.component';
import { SheetComponent } from '../../ui/sheet/sheet.component';

/** Die Höhe steht so im Board `SignInSheet`. */
const DETENTS = ['404px', '404px', '404px'] as const;

/**
 * Fragt nach der Anmeldung, wenn etwas gespeichert werden soll. Es erscheint
 * nur auf {@link AuthService.requestSignIn}, nie von selbst: Karte, Arten
 * und Ebenen bleiben ohne Konto nutzbar.
 */
@Component({
  selector: 'app-signin-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ActionBarComponent, OverlayHostComponent, SheetComponent, TranslatePipe],
  templateUrl: './signin-sheet.component.html',
  styleUrl: './signin-sheet.component.scss',
})
export class SignInSheetComponent {
  private readonly auth = inject(AuthService);
  // `read` ist nötig: eine Referenz auf ein Komponenten-Element liefert sonst
  // die Komponente, nicht ihr Element.
  private readonly footer = viewChild('footer', { read: ElementRef });

  protected readonly wide = inject(ViewportService).wide;
  protected readonly pending = this.auth.sheetOpen;
  protected readonly detents = DETENTS;

  constructor() {
    effect(() => {
      // Ein modales Blatt nimmt den Fokus, sonst wanderte der Tabulator weiter
      // durch die Karte darunter.
      const footer = this.footer() as ElementRef<HTMLElement> | undefined;
      footer?.nativeElement.querySelector('button')?.focus();
    });
  }

  protected signIn(): void {
    void this.auth.signIn();
  }

  protected later(): void {
    this.auth.later();
  }
}

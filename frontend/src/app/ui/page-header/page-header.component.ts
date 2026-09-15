import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { SvgIconComponent } from '../svg-icon/svg-icon.component';

/** Der Kopf einer Seite: Titel, ein wahlweiser Zurück-Knopf, ein Aktions-Slot. */
@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SvgIconComponent, TranslatePipe],
  templateUrl: './page-header.component.html',
  styleUrl: './page-header.component.scss',
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly back = input(false);
  /** In der Spalte der Karte trägt der Kopf die Maße eines Blatts. */
  readonly compact = input(false);

  readonly backClick = output();
}

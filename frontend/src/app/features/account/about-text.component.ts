import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';

/** Ein Absatz einer Textseite: Zwischenüberschrift und Text, je ein Schlüssel. */
export interface AboutSection {
  heading: TranslationKey;
  body: TranslationKey;
}

/** Eine reine Textseite unter dem Konto: Titel, dann Absätze mit Zwischenüberschrift. */
@Component({
  selector: 'app-about-text',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, TranslatePipe],
  templateUrl: './about-text.component.html',
  styleUrl: './about-text.component.scss',
})
export class AboutTextComponent {
  readonly title = input.required<TranslationKey>();
  readonly sections = input.required<readonly AboutSection[]>();

  readonly backClick = output();
}

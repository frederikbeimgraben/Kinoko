import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';

/** One row of a text page: a label and a short sub-line, one key each. */
export interface AboutSection {
  heading: TranslationKey;
  body: TranslationKey;
}

/** A text page below the account, per `AboutMethod.dc.html`: a group of rows with one sub-line each. */
@Component({
  selector: 'app-about-text',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ListRowComponent, PageHeaderComponent, RowGroupComponent, TranslatePipe],
  templateUrl: './about-text.component.html',
  styleUrl: './about-text.component.scss',
})
export class AboutTextComponent {
  readonly title = input.required<TranslationKey>();
  readonly sections = input.required<readonly AboutSection[]>();

  readonly backClick = output();
}

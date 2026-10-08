import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';

/** The empty frame of a tab that has no content yet. */
@Component({
  selector: 'app-placeholder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, TranslatePipe],
  templateUrl: './placeholder.component.html',
  styleUrl: './placeholder.component.scss',
})
export class PlaceholderComponent {
  readonly titel = input.required<string>();
}

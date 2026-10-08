import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Shows the categories of a feature as a row. It has no selection and no interaction. */
@Component({
  selector: 'app-tag-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tag-list.component.html',
  styleUrl: './tag-list.component.scss',
})
export class TagListComponent {
  readonly tags = input.required<readonly string[]>();
  readonly label = input.required<string>();
  /** Tags of the species are filled. Tags for selection have only an outline. */
  readonly filled = input(false);
}

import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Die Kategorien eines Merkmals als Reihe, ohne Auswahl, ohne Interaktion. */
@Component({
  selector: 'app-tag-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tag-list.component.html',
  styleUrl: './tag-list.component.scss',
})
export class TagListComponent {
  readonly tags = input.required<readonly string[]>();
  readonly label = input.required<string>();
  /** Marken der Art selbst stehen gefüllt, Marken zur Wahl nur umrandet. */
  readonly filled = input(false);
}

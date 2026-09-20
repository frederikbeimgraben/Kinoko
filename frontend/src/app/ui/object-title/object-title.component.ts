import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { PrivateImageComponent } from '../private-image/private-image.component';
import type { IconName } from '../svg-icon/svg-icon.component';

/** Der Kopf eines Objekt-Blatts: Bild, Name, gedämpfte Zeile. Per `ObjectTitle.dc.html`. */
@Component({
  selector: 'app-object-title',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PrivateImageComponent],
  templateUrl: './object-title.component.html',
  styleUrl: './object-title.component.scss',
})
export class ObjectTitleComponent {
  readonly title = input.required<string>();
  readonly sub = input('');
  readonly colour = input('#7a5230');
  readonly icon = input<IconName>('mushroom');
  readonly photo = input('');
}

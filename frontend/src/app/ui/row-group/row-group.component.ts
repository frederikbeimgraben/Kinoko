import { ChangeDetectionStrategy, Component } from '@angular/core';

/** A borderless row list, per `kit.css` `.grp`. Replaces the kit card. */
@Component({
  selector: 'app-row-group',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './row-group.component.html',
  styleUrl: './row-group.component.scss',
})
export class RowGroupComponent {}

import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import type { BodyPart, SpeciesEntry } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { CheckRowComponent } from '../../ui/check-row/check-row.component';
import { OverlayHostComponent } from '../../ui/overlay-host/overlay-host.component';
import { SheetComponent, type DetentSize } from '../../ui/sheet/sheet.component';
import { PART_TEXT } from '../species/labels';
import { freeParts } from './species-lists';

/** Das Blatt ist so hoch wie seine Liste. */
const DETENTS: readonly [DetentSize, DetentSize, DetentSize] = ['content', 'content', 'content'];

/** Ein Teil, das die Art noch nicht führt. */
interface Choice {
  part: BodyPart;
  name: string;
  checked: boolean;
}

/** Das Blatt zur Wahl weiterer Teile einer Art. */
@Component({
  selector: 'app-part-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ActionBarComponent, CheckRowComponent, OverlayHostComponent, SheetComponent, TranslatePipe],
  templateUrl: './part-picker.component.html',
  styleUrl: './part-picker.component.scss',
})
export class PartPickerComponent {
  private readonly i18n = inject(I18nService);

  readonly open = input(false);
  readonly species = input<SpeciesEntry | null>(null);
  /** Teile, die schon gewählt sind und darum nicht mehr zur Wahl stehen. */
  readonly held = input<readonly BodyPart[]>([]);

  readonly chosen = output<readonly BodyPart[]>();
  readonly closed = output();

  protected readonly DETENTS = DETENTS;
  private readonly marks = signal<ReadonlySet<BodyPart>>(new Set());

  protected readonly choices = computed<Choice[]>(() =>
    freeParts(this.species(), this.held()).map((part) => ({
      part,
      name: this.i18n.translate(PART_TEXT[part]),
      checked: this.marks().has(part),
    })),
  );

  protected toggle(part: BodyPart, on: boolean): void {
    this.marks.update((one) => {
      const next = new Set(one);
      if (on) next.add(part);
      else next.delete(part);
      return next;
    });
  }

  protected add(): void {
    this.chosen.emit([...this.marks()]);
    this.marks.set(new Set());
  }

  protected close(): void {
    this.marks.set(new Set());
    this.closed.emit();
  }
}

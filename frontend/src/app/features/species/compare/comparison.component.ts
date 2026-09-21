import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ViewportService } from '../../../core/layout/viewport.service';
import { ColourFieldComponent } from '../../../ui/colour-field/colour-field.component';
import { LevelPillComponent } from '../../../ui/level-pill/level-pill.component';
import { PageHeaderComponent } from '../../../ui/page-header/page-header.component';
import { SwitchComponent } from '../../../ui/switch/switch.component';
import { SpeciesState } from '../species.state';
import { compareGroups, type Group } from './comparison.rows';
import { ComparisonState } from './comparison.state';

/** Zwei Arten nebeneinander, nach Gruppen des Körpers geordnet. */
@Component({
  selector: 'app-comparison',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ColourFieldComponent, LevelPillComponent, PageHeaderComponent, SwitchComponent, TranslatePipe],
  templateUrl: './comparison.component.html',
  styleUrl: './comparison.component.scss',
})
export class ComparisonComponent {
  private readonly catalogue = inject(SpeciesState);
  private readonly comparison = inject(ComparisonState);
  private readonly location = inject(Location);
  private readonly i18n = inject(I18nService);

  protected readonly wide = inject(ViewportService).wide;
  protected readonly species = this.comparison.species;
  protected readonly names = computed(() => this.species().map((one) => one.name));
  protected readonly paired = computed(() => this.species().length > 1);

  protected readonly diffOnly = signal(false);
  protected readonly diffOnlyLabel = computed(() => this.i18n.translate('species.compare.diffOnly'));

  protected readonly groups = computed<readonly Group[]>(() =>
    compareGroups(this.species(), this.i18n, this.diffOnly()),
  );

  constructor() {
    void this.catalogue.loadBundle();
  }

  protected back(): void {
    this.location.back();
  }

  protected setDiffOnly(value: boolean): void {
    this.diffOnly.set(value);
  }

  protected rowClass(diff: boolean): string {
    return diff ? 'compare__row compare__row--diff' : 'compare__row';
  }
}

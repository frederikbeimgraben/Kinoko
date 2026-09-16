import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import type { SpeciesEntry } from '../../../core/api/models';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ListRowComponent } from '../../../ui/list-row/list-row.component';
import { taxonSlug } from './taxonomy';

/** Die Einordnung einer Art: Gattung und Familie, der Weg zur Stufe. */
@Component({
  selector: 'app-species-taxonomy',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ListRowComponent, TranslatePipe],
  templateUrl: './species-taxonomy.component.html',
  styleUrl: './species-taxonomy.component.scss',
})
export class SpeciesTaxonomyComponent {
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  readonly species = input.required<SpeciesEntry>();

  protected readonly genus = computed(() => this.species().genusName);

  protected readonly line = computed(() => {
    const family = this.species().familyName ?? '';
    if (family === '') return this.genus();
    return this.i18n.translate('species.taxonomy.line', { genus: this.genus(), family });
  });

  protected open(): void {
    void this.router.navigate(['/taxonomie', 'genus', taxonSlug(this.genus())]);
  }
}

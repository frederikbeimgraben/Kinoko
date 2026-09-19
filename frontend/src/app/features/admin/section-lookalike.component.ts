import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { injectRouteParam } from '../../core/navigation/route-param';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { FormFieldComponent } from '../../ui/form-field/form-field.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { SpeciesPickerComponent } from '../../ui/species-picker/species-picker.component';
import { SpeciesState } from '../species/species.state';
import { speciesPickerEntry } from '../species/species-picker-entry';
import { SpeciesEditorState } from './species-editor.state';
import { withLookalike, withoutLookalike } from './species-lists';

/** Eine Verwechslung einer Art: die andere Art und der Unterschied. */
@Component({
  selector: 'app-section-lookalike',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    FormFieldComponent,
    ListRowComponent,
    PageHeaderComponent,
    SpeciesPickerComponent,
    TranslatePipe,
  ],
  templateUrl: './section-lookalike.component.html',
  styleUrl: './section-lookalike.component.scss',
})
export class SectionLookalikeComponent {
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly state = inject(SpeciesEditorState);
  private readonly catalogue = inject(SpeciesState);

  protected readonly slug = injectRouteParam('slug');
  private readonly index = injectRouteParam('index', '0');
  protected readonly at = computed(() => Number(this.index()));

  protected readonly other = signal('');
  protected readonly difference = signal('');
  protected readonly picking = signal(false);

  private readonly held = computed(() => this.state.species()?.lookalikes[this.at()] ?? null);

  protected readonly choices = computed(() =>
    this.catalogue.species().map((entry) => speciesPickerEntry(entry, this.i18n)),
  );

  protected readonly otherName = computed(() => {
    const slug = this.other();
    const held = this.held();
    if (held?.slug === slug) return held.name;
    return this.catalogue.species().find((one) => one.slug === slug)?.name ?? '';
  });

  constructor() {
    effect(() => {
      const slug = this.slug();
      if (slug !== '') this.state.load(slug);
    });
    void this.catalogue.loadBundle();
    effect(() => {
      const one = this.held();
      this.other.set(one?.slug ?? '');
      this.difference.set(one?.difference ?? '');
    });
  }

  protected choose(slug: string): void {
    this.other.set(slug);
    this.picking.set(false);
  }

  protected apply(): void {
    if (this.other() === '') return;
    this.state.save({
      lookalikes: withLookalike(this.state.species(), this.at(), {
        slug: this.other(),
        difference: this.difference(),
      }),
    });
    this.back();
  }

  protected remove(): void {
    this.state.save({ lookalikes: withoutLookalike(this.state.species(), this.at()) });
    this.back();
  }

  protected back(): void {
    void this.router.navigate(['/verwaltung/arten', this.slug()]);
  }
}

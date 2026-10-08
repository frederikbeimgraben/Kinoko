import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import type { SpeciesEntry } from '../../../core/api/models';
import type { TranslationKey } from '../../../core/i18n/translations';

const PARTS: readonly { key: 'cap' | 'stem' | 'flesh'; titleKey: TranslationKey }[] = [
  { key: 'cap', titleKey: 'species.field.cap' },
  { key: 'stem', titleKey: 'species.field.stem' },
  { key: 'flesh', titleKey: 'species.field.flesh' },
];

/** A body part with its catalogue sentence. */
interface Trait {
  titleKey: TranslationKey;
  text: string;
}

/** Traits of a species: cap, stem and flesh, each with a catalogue sentence. */
@Component({
  selector: 'app-species-traits',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  templateUrl: './species-traits.component.html',
  styleUrl: './species-traits.component.scss',
})
export class SpeciesTraitsComponent {
  private readonly i18n = inject(I18nService);

  readonly species = input.required<SpeciesEntry>();

  protected readonly traits = computed<Trait[]>(() => {
    const held = this.species();
    return PARTS.map((part) => ({
      titleKey: part.titleKey,
      text: held.traits.find((one) => one.key === part.key)?.text ?? '',
    })).filter((trait) => trait.text !== '');
  });

  protected label(trait: Trait): string {
    return this.i18n.translate(trait.titleKey);
  }
}

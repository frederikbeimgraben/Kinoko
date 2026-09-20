import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AvatarButtonComponent } from '../../../../ui/avatar-button/avatar-button.component';
import { ColourFieldComponent, type ColourValue } from '../../../../ui/colour-field/colour-field.component';
import {
  ColourSwatchesComponent,
  type ColourSwatch,
} from '../../../../ui/colour-swatches/colour-swatches.component';
import { CrosshairComponent } from '../../../../ui/crosshair/crosshair.component';
import { MonoComponent } from '../../../../ui/mono/mono.component';
import { RampComponent } from '../../../../ui/ramp/ramp.component';
import { SkeletonComponent } from '../../../../ui/skeleton/skeleton.component';
import { StatRowComponent, type Stat } from '../../../../ui/stat-row/stat-row.component';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { BlockCardComponent } from '../block-card/block-card.component';

const STAT_KEYS = [
  'entry.finds',
  'entry.markers',
  'entry.zones',
  'entry.images',
  'map.combination.list',
] as const;

const STAT_VALUES = [12, 4, 2, 3, 2] as const;

const SWATCH_COLOURS: readonly ColourValue[] = [
  { name: 'creamy white', hex: '#f2e8d5' },
  { name: 'ochre', hex: '#c9a877' },
];

/** The eight D1 display blocks, each with its verified board default. */
@Component({
  selector: 'app-display-cards',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AvatarButtonComponent,
    BlockCardComponent,
    ColourFieldComponent,
    ColourSwatchesComponent,
    CrosshairComponent,
    MonoComponent,
    RampComponent,
    SkeletonComponent,
    StatRowComponent,
    TranslatePipe,
  ],
  templateUrl: './display-cards.component.html',
})
export class DisplayCardsComponent {
  private readonly i18n = inject(I18nService);

  protected readonly swatchColours = SWATCH_COLOURS;

  protected readonly toneSwatches: readonly ColourSwatch[] = [
    { value: '#7a4a2a', label: this.i18n.translate('enum.colour.brown') },
  ];

  protected readonly stats: readonly Stat[] = STAT_KEYS.map((key, index) => ({
    value: STAT_VALUES[index],
    label: this.i18n.translate(key),
  }));

  protected readonly monoText = this.i18n.translate('beispiel.lauf');
  protected readonly swatchLabel = this.i18n.translate('beispiel.farbspanne');
}

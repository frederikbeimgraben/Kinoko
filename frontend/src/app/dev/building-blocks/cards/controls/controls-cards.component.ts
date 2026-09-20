import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AddRowComponent } from '../../../../ui/add-row/add-row.component';
import { ButtonComponent } from '../../../../ui/button/button.component';
import { CheckRowComponent } from '../../../../ui/check-row/check-row.component';
import { ChoiceRowComponent } from '../../../../ui/choice-row/choice-row.component';
import { FloatingButtonComponent } from '../../../../ui/floating-button/floating-button.component';
import { IconButtonComponent } from '../../../../ui/icon-button/icon-button.component';
import { SwitchComponent } from '../../../../ui/switch/switch.component';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { BlockCardComponent } from '../block-card/block-card.component';

/** Die Zeilen- und Knopf-Bausteine der D1-Steuerelemente, je ihre Vorgabe. */
@Component({
  selector: 'app-controls-cards',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AddRowComponent,
    BlockCardComponent,
    ButtonComponent,
    CheckRowComponent,
    ChoiceRowComponent,
    FloatingButtonComponent,
    IconButtonComponent,
    SwitchComponent,
    TranslatePipe,
  ],
  templateUrl: './controls-cards.component.html',
  styleUrl: './controls-cards.component.scss',
})
export class ControlsCardsComponent {}

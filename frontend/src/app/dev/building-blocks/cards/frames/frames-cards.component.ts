import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { FilterChipComponent } from '../../../../ui/filter-chip/filter-chip.component';
import { IconButtonComponent } from '../../../../ui/icon-button/icon-button.component';
import { NavComponent } from '../../../../ui/nav/nav.component';
import { NavTabComponent } from '../../../../ui/nav/nav-tab.component';
import { PageHeaderComponent } from '../../../../ui/page-header/page-header.component';
import { ScrollFadeDirective } from '../../../../ui/scroll-fade/scroll-fade.directive';
import { SearchFieldComponent } from '../../../../ui/search-field/search-field.component';
import { SplitLayoutComponent } from '../../../../ui/split-layout/split-layout.component';
import { SurfaceComponent } from '../../../../ui/surface/surface.component';
import { AvatarButtonComponent } from '../../../../ui/avatar-button/avatar-button.component';
import { BlockCardComponent } from '../block-card/block-card.component';

/** Die Rahmen der D2-Lieferung: Leisten, Reiter, Spalten und Flächen. */
@Component({
  selector: 'app-frames-cards',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AvatarButtonComponent,
    BlockCardComponent,
    FilterChipComponent,
    IconButtonComponent,
    NavComponent,
    NavTabComponent,
    PageHeaderComponent,
    ScrollFadeDirective,
    SearchFieldComponent,
    SplitLayoutComponent,
    SurfaceComponent,
    TranslatePipe,
  ],
  templateUrl: './frames-cards.component.html',
  styleUrl: './frames-cards.component.scss',
})
export class FramesCardsComponent {}

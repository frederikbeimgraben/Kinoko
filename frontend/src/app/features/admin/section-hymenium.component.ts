import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import type { ColourGroup, GillAttachment, GillEdge, GillSpacing, HymeniumType } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { ColourFieldComponent, type ColourMode } from '../../ui/colour-field/colour-field.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { SvgIconComponent } from '../../ui/svg-icon/svg-icon.component';
import { SpeciesEditorState } from './species-editor.state';
import {
  FIELD_TITLE,
  choiceText,
  choicesOf,
  hymeniumRows,
  valueOf,
  type HymeniumField,
  type HymeniumRow,
} from './section-hymenium.rows';

/** Ein Wert der offenen Wahl. */
interface Choice {
  value: string;
  label: string;
  chosen: boolean;
}

/** Die Fruchtschicht einer Art: ihre Felder und die Wahl des offenen Feldes. */
@Component({
  selector: 'app-section-hymenium',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    ColourFieldComponent,
    ListRowComponent,
    PageHeaderComponent,
    SvgIconComponent,
    TranslatePipe,
  ],
  templateUrl: './section-hymenium.component.html',
  styleUrl: './section-hymenium.component.scss',
})
export class SectionHymeniumComponent {
  private readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly state = inject(SpeciesEditorState);

  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });

  protected readonly slug = computed(() => this.params().get('slug') ?? '');
  protected readonly open = signal<HymeniumField>('attachment');
  private readonly draft = signal<Partial<Record<HymeniumField, string>>>({});

  protected readonly rows = computed<HymeniumRow[]>(() => {
    const species = this.state.species();
    if (species === null) return [];
    return hymeniumRows(species, (key) => this.i18n.translate(key)).map((row) => {
      const drafted = this.draft()[row.field];
      return drafted === undefined
        ? row
        : { ...row, value: this.i18n.translate(choiceText(row.field, drafted)) };
    });
  });

  protected readonly openTitle = computed(() => this.i18n.translate(FIELD_TITLE[this.open()]));

  protected readonly choices = computed<Choice[]>(() => {
    const field = this.open();
    const held = this.valueFor(field);
    return choicesOf(field).map((value) => ({
      value,
      label: this.i18n.translate(choiceText(field, value)),
      chosen: value === held,
    }));
  });

  protected readonly colours = computed<ColourGroup | null>(() => {
    const species = this.state.species();
    const kind = species?.hymeniumType;
    if (species === null || kind === undefined || kind === null) return null;
    return species.colours.find((one) => one.part === kind) ?? null;
  });

  protected readonly mode = computed<ColourMode>(() => {
    const held = this.colours()?.mode;
    return held === 'gradient' ? 'gradient' : held === 'single' ? 'single' : 'multiple';
  });

  constructor() {
    effect(() => {
      const slug = this.slug();
      if (slug !== '') this.state.load(slug);
    });
  }

  protected choose(value: string): void {
    this.draft.update((one) => ({ ...one, [this.open()]: value }));
  }

  protected openField(field: HymeniumField): void {
    this.open.set(field);
  }

  protected apply(): void {
    const drafted = this.draft();
    this.state.save({
      ...(drafted.kind === undefined ? {} : { hymeniumType: drafted.kind as HymeniumType }),
      ...(drafted.attachment === undefined ? {} : { gillAttachment: drafted.attachment as GillAttachment }),
      ...(drafted.spacing === undefined ? {} : { gillSpacing: drafted.spacing as GillSpacing }),
      ...(drafted.edge === undefined ? {} : { gillEdge: drafted.edge as GillEdge }),
    });
    this.back();
  }

  protected back(): void {
    void this.router.navigate(['/verwaltung/arten', this.slug()]);
  }

  private valueFor(field: HymeniumField): string | null {
    const drafted = this.draft()[field];
    if (drafted !== undefined) return drafted;
    const species = this.state.species();
    return species === null ? null : valueOf(species, field);
  }
}

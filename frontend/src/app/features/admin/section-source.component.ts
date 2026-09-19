import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import type { SourceScope } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { shortDate } from '../../core/i18n/dates';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { FormFieldComponent } from '../../ui/form-field/form-field.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { SegmentedComponent, type SegmentOption } from '../../ui/segmented/segmented.component';
import { SpeciesEditorState } from './species-editor.state';
import { withSource, withoutSource } from './species-lists';

/** Die beiden Arten einer Quelle, wie der Vertrag sie kennt. */
const SCOPES: readonly SourceScope[] = ['profile', 'further'];

const SCOPE_TEXT: Readonly<Record<SourceScope, TranslationKey>> = {
  profile: 'admin.source.scope.profile',
  further: 'admin.source.scope.further',
};

/** Eine Quelle einer Art: Art der Quelle, Titel, Adresse und Prüftag. */
@Component({
  selector: 'app-section-source',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ActionBarComponent, FormFieldComponent, PageHeaderComponent, SegmentedComponent, TranslatePipe],
  templateUrl: './section-source.component.html',
  styleUrl: './section-source.component.scss',
})
export class SectionSourceComponent {
  private readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly state = inject(SpeciesEditorState);

  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });

  protected readonly slug = computed(() => this.params().get('slug') ?? '');
  protected readonly at = computed(() => Number(this.params().get('index') ?? '0'));

  protected readonly scope = signal<SourceScope>('profile');
  protected readonly title = signal('');
  protected readonly url = signal('');
  protected readonly checkedOn = signal('');

  private readonly held = computed(() => this.state.species()?.sources[this.at()] ?? null);

  protected readonly scopes = computed<SegmentOption[]>(() =>
    SCOPES.map((one) => ({ value: one, label: this.i18n.translate(SCOPE_TEXT[one]) })),
  );

  protected readonly checkedDay = computed(() => {
    const day = this.checkedOn();
    return day === '' ? '' : shortDate(day, this.i18n);
  });

  constructor() {
    effect(() => {
      const slug = this.slug();
      if (slug !== '') this.state.load(slug);
    });
    effect(() => {
      const one = this.held();
      this.scope.set(one?.scope ?? 'profile');
      this.title.set(one?.title ?? '');
      this.url.set(one?.url ?? '');
      this.checkedOn.set(one?.checkedOn ?? '');
    });
  }

  protected chooseScope(value: string): void {
    this.scope.set(value as SourceScope);
  }

  protected apply(): void {
    this.state.save({
      sources: withSource(this.state.species(), this.at(), {
        scope: this.scope(),
        title: this.title(),
        url: this.url(),
        checkedOn: this.checkedOn(),
      }),
    });
    this.back();
  }

  protected remove(): void {
    this.state.save({ sources: withoutSource(this.state.species(), this.at()) });
    this.back();
  }

  protected back(): void {
    void this.router.navigate(['/verwaltung/arten', this.slug()]);
  }
}

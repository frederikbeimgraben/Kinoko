import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { GroupsState } from '../../core/access/groups.state';
import type { Visibility } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { FormFieldComponent } from '../../ui/form-field/form-field.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { OverlayHostComponent } from '../../ui/overlay-host/overlay-host.component';
import { SegmentedComponent } from '../../ui/segmented/segmented.component';
import { SheetComponent, type DetentSize } from '../../ui/sheet/sheet.component';
import { visibilitySegments } from './visibility';

/** Das Blatt der Gruppenwahl ist so hoch wie sein Inhalt. */
const DETENTS: readonly [DetentSize, DetentSize, DetentSize] = [0.5, 0.5, 0.9];

/** Privat oder an eine Gruppe: Schalter und Gruppenwahl von Fund, Marker und Zone. */
@Component({
  selector: 'app-visibility-choice',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormFieldComponent,
    ListRowComponent,
    OverlayHostComponent,
    SegmentedComponent,
    SheetComponent,
    TranslatePipe,
  ],
  templateUrl: './visibility-choice.component.html',
  styleUrl: './visibility-choice.component.scss',
})
export class VisibilityChoiceComponent {
  readonly visibility = input.required<Visibility>();
  readonly groupId = input<string | null>(null);
  /** Im engen Formular stehen Beschriftung und Schalter nebeneinander. */
  readonly inline = input(false);

  readonly visibilityChange = output<Visibility>();
  readonly groupChange = output<string | null>();

  private readonly i18n = inject(I18nService);
  private readonly state = inject(GroupsState);

  protected readonly DETENTS = DETENTS;
  protected readonly picking = signal(false);
  protected readonly segments = computed(() => visibilitySegments(this.i18n));
  protected readonly groups = computed(() => this.state.groups() ?? []);

  protected readonly groupName = computed(
    () => this.groups().find((one) => one.id === this.groupId())?.name ?? '',
  );

  constructor() {
    // Erst beim Teilen braucht das Formular die Gruppen.
    effect(() => {
      if (this.visibility() !== 'shared' || this.state.groups() !== null) return;
      this.state.load(false, true);
    });
    // Wer genau eine Gruppe hat, teilt ohne weiteren Griff an sie.
    effect(() => {
      const only = this.groups();
      if (this.visibility() !== 'shared' || this.groupId() !== null || only.length !== 1) return;
      this.groupChange.emit(only[0].id);
    });
  }

  protected chooseVisibility(value: string): void {
    const chosen: Visibility = value === 'shared' ? 'shared' : 'private';
    this.visibilityChange.emit(chosen);
    if (chosen === 'private') this.groupChange.emit(null);
  }

  protected chooseGroup(id: string): void {
    this.groupChange.emit(id);
    this.picking.set(false);
  }
}

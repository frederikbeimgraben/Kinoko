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
import { GroupsStore } from '../../core/access/groups.store';
import type { Visibility } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { FormFieldComponent } from '../../ui/form-field/form-field.component';
import { OptionSheetComponent, type OptionSheetOption } from '../../ui/option-sheet/option-sheet.component';
import { SegmentedComponent } from '../../ui/segmented/segmented.component';
import { visibilitySegments } from './visibility';

/** The sheet of the group choice is as high as its content. */

/** Private or shared with a group: the switch and the group choice of a find, marker or zone. */
@Component({
  selector: 'app-visibility-choice',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormFieldComponent, OptionSheetComponent, SegmentedComponent, TranslatePipe],
  templateUrl: './visibility-choice.component.html',
  styleUrl: './visibility-choice.component.scss',
})
export class VisibilityChoiceComponent {
  readonly visibility = input.required<Visibility>();
  readonly groupId = input<string | null>(null);
  /** In the narrow form, the label and the switch are side by side. */
  readonly inline = input(false);

  readonly visibilityChange = output<Visibility>();
  readonly groupChange = output<string | null>();

  private readonly i18n = inject(I18nService);
  private readonly state = inject(GroupsStore);

  protected readonly picking = signal(false);
  protected readonly segments = computed(() => visibilitySegments(this.i18n));
  protected readonly groups = computed(() => this.state.groups() ?? []);

  protected readonly groupName = computed(
    () => this.groups().find((one) => one.id === this.groupId())?.name ?? '',
  );

  protected readonly groupOptions = computed<readonly OptionSheetOption[]>(() =>
    this.groups().map((row) => ({ id: row.id, title: row.name })),
  );

  constructor() {
    // The form needs the groups only when a person shares.
    effect(() => {
      if (this.visibility() !== 'shared' || this.state.groups() !== null) return;
      this.state.load(false, true);
    });
    // A person with exactly one group shares with it without a further step.
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

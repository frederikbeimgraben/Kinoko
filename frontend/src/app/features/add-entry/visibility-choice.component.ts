import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { GroupsStore } from '../../core/access/groups.store';
import type { Visibility } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { ChoiceRowComponent } from '../../ui/choice-row/choice-row.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { OverlayHostComponent } from '../../ui/overlay-host/overlay-host.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import { ScrollFadeDirective } from '../../ui/scroll-fade/scroll-fade.directive';
import { SegmentedComponent } from '../../ui/segmented/segmented.component';
import { SheetComponent } from '../../ui/sheet/sheet.component';
import { memberCount } from '../account/group-text';
import { visibilitySegments } from './visibility';

/** Private or shared with a group: the segment and the group choice of a find (boards `FindFormSharedBody`,
 * `MapGroupPicker`). The picker takes a choice only with "Übernehmen". */
@Component({
  selector: 'app-visibility-choice',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    ChoiceRowComponent,
    ListRowComponent,
    OverlayHostComponent,
    RowGroupComponent,
    ScrollFadeDirective,
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
  /** In a narrow form, the label and the segment are side by side. */
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

  /** Each group with its member count, per `GroupPickBody.dc.html`. */
  protected readonly rows = computed(() =>
    this.groups().map((group) => ({
      id: group.id,
      name: group.name,
      members: memberCount(this.i18n, group.members.length),
    })),
  );

  /** The group in the open picker. It starts with the chosen group at each open. */
  protected readonly draft = linkedSignal({
    source: () => ({ open: this.picking(), chosen: this.groupId() }),
    computation: ({ chosen }): string | null => chosen,
  });

  constructor() {
    // The form needs the groups only for a share.
    effect(() => {
      if (this.visibility() !== 'shared' || this.state.groups() !== null) return;
      this.state.load(false, true);
    });
    // With exactly one group, the share goes to it without a choice.
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

  protected openPicker(): void {
    this.picking.set(true);
  }

  protected apply(): void {
    this.groupChange.emit(this.draft());
    this.picking.set(false);
  }
}

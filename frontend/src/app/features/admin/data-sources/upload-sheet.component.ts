import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { Router } from '@angular/router';
import type { DataSourceAccept, DataSourceKind } from '../../../core/api/models';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../../core/i18n/translations';
import { ActionBarComponent } from '../../../ui/action-bar/action-bar.component';
import { ListRowComponent } from '../../../ui/list-row/list-row.component';
import { OverlayHostComponent } from '../../../ui/overlay-host/overlay-host.component';
import { ProgressComponent } from '../../../ui/progress/progress.component';
import { RippleDirective } from '../../../ui/ripple/ripple.directive';
import { RowGroupComponent } from '../../../ui/row-group/row-group.component';
import { SheetComponent } from '../../../ui/sheet/sheet.component';
import { SvgIconComponent } from '../../../ui/svg-icon/svg-icon.component';
import { SwitchComponent } from '../../../ui/switch/switch.component';
import { DataSourcesStore } from './data-sources.store';
import { bytesText, fileProblem } from './format';
import { KIND_TEXT, STATE_TEXT, STATE_TONE } from './labels';
import { sameFile, factsOf } from './upload-machine';
import { UploadStore } from './upload.store';
import { uploadLines, uploadError } from './upload-text';

/** The upload dialog: pick a file, send it in resumable parts, and follow the new version. */
@Component({
  selector: 'app-upload-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    ListRowComponent,
    OverlayHostComponent,
    ProgressComponent,
    RippleDirective,
    RowGroupComponent,
    SheetComponent,
    SvgIconComponent,
    SwitchComponent,
    TranslatePipe,
  ],
  templateUrl: './upload-sheet.component.html',
  styleUrl: './upload-sheet.component.scss',
})
export class UploadSheetComponent {
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly sources = inject(DataSourcesStore);
  private readonly store = inject(UploadStore);

  readonly kind = input<DataSourceKind | null>(null);
  readonly closed = output();

  protected readonly picked = linkedSignal<DataSourceKind | null, File | null>({
    source: this.kind,
    computation: () => null,
  });
  protected readonly activate = linkedSignal({ source: this.kind, computation: () => true });

  private readonly text = (key: TranslationKey, values?: Record<string, string | number>): string =>
    this.i18n.translate(key, values);

  protected readonly upload = this.store.upload;
  protected readonly phase = this.store.phase;
  protected readonly running = this.store.active;

  protected readonly title = computed(() => {
    const kind = this.kind();
    return kind === null ? '' : this.text('admin.upload.title', { name: this.text(KIND_TEXT[kind]) });
  });

  private readonly accept = computed<DataSourceAccept | null>(() => {
    const kind = this.kind();
    const fromList = this.sources.sources()?.find((one) => one.kind === kind)?.accept;
    const detail = this.sources.detail();
    return fromList ?? (detail?.kind === kind ? detail.accept : null);
  });

  protected readonly acceptAttr = computed(() => this.accept()?.extensions.join(',') ?? '');

  protected readonly acceptText = computed(() => {
    const accept = this.accept();
    if (accept === null) return '';
    return this.text('admin.upload.accept', {
      typen: accept.extensions.join(', '),
      limit: bytesText(accept.maxBytes, this.i18n.locale()),
    });
  });

  protected readonly problem = computed(() => {
    const file = this.picked();
    const accept = this.accept();
    if (file === null || accept === null) return '';
    const found = fileProblem(file.name, file.size, accept);
    if (found === 'type') return this.text('admin.upload.wrongType');
    if (found === 'size')
      return this.text('admin.upload.tooLarge', { limit: bytesText(accept.maxBytes, this.i18n.locale()) });
    return '';
  });

  protected readonly fileLine = computed(() => {
    const file = this.picked() ?? null;
    const facts = file === null ? this.upload().file : factsOf(file);
    return facts === null ? null : { name: facts.name, size: bytesText(facts.size, this.i18n.locale()) };
  });

  /** The open session of this kind after a reload. The person picks the same file again to continue. */
  protected readonly resumeHint = computed(() => {
    const saved = this.store.saved();
    if (saved === null) return '';
    if (saved.kind !== this.kind() || this.running()) return '';
    return this.text('admin.upload.resumeHint', { name: saved.name });
  });

  /** An open session of this kind on the server that this browser cannot continue. It blocks a new upload. */
  protected readonly blocking = computed(() => {
    const kind = this.kind();
    const detail = this.sources.detail();
    const open = detail?.kind === kind ? detail.openUpload : null;
    if (open === null || this.running() || this.store.saved()?.uploadId === open.id) return null;
    return { id: open.id, note: this.text('admin.upload.openHint', { name: open.fileName }) };
  });

  protected readonly resumes = computed(() => {
    const file = this.picked();
    const kind = this.kind();
    return file !== null && kind !== null && sameFile(this.store.saved(), kind, factsOf(file));
  });

  protected readonly lines = computed(() => uploadLines(this.upload(), this.text, this.i18n.locale()));
  protected readonly error = computed(() => uploadError(this.upload(), this.text));

  protected readonly versionState = computed(() => {
    const version = this.upload().version;
    return version === null
      ? null
      : { text: this.text(STATE_TEXT[version.state]), tone: STATE_TONE[version.state] };
  });

  protected pick(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.picked.set(target.files?.item(0) ?? null);
    target.value = '';
  }

  protected drop(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files.item(0) ?? null;
    if (file !== null) this.picked.set(file);
  }

  protected allowDrop(event: DragEvent): void {
    event.preventDefault();
  }

  protected start(): void {
    const kind = this.kind();
    const file = this.picked();
    if (kind === null || file === null || this.problem() !== '') return;
    this.store.reset();
    this.store.start({ kind, file, activate: this.activate() });
  }

  protected toggle(): void {
    if (this.phase() === 'paused') this.store.resume();
    else this.store.pause();
  }

  protected cancel(): void {
    this.store.cancel({
      onDone: () => {
        this.refresh();
      },
    });
    this.picked.set(null);
  }

  protected discard(): void {
    const open = this.blocking();
    if (open !== null)
      this.store.discard({
        id: open.id,
        onDone: () => {
          this.refresh();
        },
      });
  }

  /** Reads the detail of this kind again, so that it shows the open session of the server. */
  private refresh(): void {
    const kind = this.kind();
    if (kind !== null && this.sources.kind() === kind) {
      this.sources.openDetail({ kind, speciesId: this.sources.speciesId() });
    }
  }

  /** Opens the page of the new version and leaves the dialog ready for the next upload. */
  protected toVersion(): void {
    const kind = this.upload().kind;
    this.store.reset();
    this.picked.set(null);
    this.closed.emit();
    if (kind !== null) void this.router.navigate(['/verwaltung/datenquellen', kind]);
  }
}

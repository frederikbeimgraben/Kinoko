import type { I18nService } from '../../core/i18n/i18n.service';

/** The state banner at the bottom of the entry list, per `Banner.dc.html`. */
export interface EntriesBanner {
  readonly offline: boolean;
  readonly text: string;
  readonly count: string | undefined;
}

/** Without network: "no connection" with the pending count. With network: the pending count, or no banner. */
export function entriesBanner(pending: number, online: boolean, i18n: I18nService): EntriesBanner | null {
  if (!online) {
    const count = pending === 0 ? undefined : i18n.translate('entry.pending.count', { count: pending });
    return { offline: true, text: i18n.translate('state.noConnection'), count };
  }
  if (pending === 0) return null;
  const text =
    pending === 1
      ? i18n.translate('entry.pending.one')
      : i18n.translate('entry.pending.many', { count: pending });
  return { offline: false, text, count: undefined };
}

import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { SearchFieldComponent } from './search-field.component';

describe('SearchFieldComponent', () => {
  it('rendert mit Platzhalter und meldet Eingaben', async () => {
    const { container, fixture } = await render(SearchFieldComponent, {
      inputs: { placeholder: 'Art suchen' },
    });
    const inputs: string[] = [];
    fixture.componentInstance.valueChange.subscribe((value) => inputs.push(value));

    await userEvent.type(screen.getByPlaceholderText('Art suchen'), 'Stein');

    expect(inputs.at(-1)).toBe('Stein');
    await noViolations(container);
  });

  it('zeigt das Löschen erst bei Inhalt', async () => {
    const { container, rerender } = await render(SearchFieldComponent, {
      inputs: { value: '' },
    });

    expect(container.querySelector('.search__clear')).toBeNull();

    await rerender({ inputs: { value: 'Stein' } });

    expect(container.querySelector('.search__clear')).not.toBeNull();
  });

  it('leert den Wert per Löschen-Knopf', async () => {
    const { fixture } = await render(SearchFieldComponent, {
      inputs: { value: 'Stein' },
    });
    const inputs: string[] = [];
    fixture.componentInstance.valueChange.subscribe((value) => inputs.push(value));

    await userEvent.click(screen.getByRole('button'));

    expect(inputs).toEqual(['']);
  });

  it('trägt Bildschirmtastatur für die Suche und den Druckzustand', async () => {
    const { container } = await render(SearchFieldComponent, {});

    const input = container.querySelector('input');
    expect(input).toHaveAttribute('inputmode', 'search');
    expect(input).toHaveAttribute('enterkeyhint', 'search');
    expect(container.querySelector('.search')).toHaveClass('tap');
    expect(container.querySelector('.search')).toHaveAttribute('data-press', 'scale');
  });

  it('bleibt ohne deutsches Wort bei leerem Katalog', async () => {
    const { container } = await render(SearchFieldComponent, {
      inputs: { value: 'x', placeholder: 'search' },
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });
});

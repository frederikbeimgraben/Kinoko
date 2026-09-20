import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { ObjectTitleComponent } from './object-title.component';

describe('ObjectTitleComponent', () => {
  it('zeigt Bild, Namen und die gedämpfte Zeile', async () => {
    const { container } = await render(ObjectTitleComponent, {
      inputs: { title: 'Steinpilz', sub: '6. September 2026 · 3 Stück · Frederik' },
    });

    expect(screen.getByText('Steinpilz')).toBeInTheDocument();
    expect(screen.getByText('6. September 2026 · 3 Stück · Frederik')).toBeInTheDocument();
    expect(container.querySelector('app-private-image')).not.toBeNull();
    await noViolations(container);
  });

  it('gibt Farbe und Zeichen an das Bild weiter', async () => {
    const { container } = await render(ObjectTitleComponent, {
      inputs: { title: 'Alter Fichtenbestand', colour: '#4f8a3c', icon: 'flag' },
    });

    const fallback = container.querySelector<HTMLElement>('.private__fallback');
    expect(fallback?.style.background).toContain('rgb(79, 138, 60)');
  });
});

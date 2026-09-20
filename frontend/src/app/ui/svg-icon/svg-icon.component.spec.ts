import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { ICONS } from './icons';
import { SvgIconComponent } from './svg-icon.component';

describe('SvgIconComponent', () => {
  it('zeichnet ein beschriftetes Piktogramm als Bild', async () => {
    const { container } = await render(SvgIconComponent, {
      inputs: { name: 'map', label: 'Karte' },
    });

    expect(screen.getByRole('img', { name: 'Karte' })).toBeInTheDocument();
    await noViolations(container);
  });

  it('versteckt ein Piktogramm ohne Beschriftung vor Hilfsmitteln', async () => {
    const { container } = await render(SvgIconComponent, { inputs: { name: 'plus' } });

    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('nimmt für die gefüllten Pfeile das kleinere Raster', async () => {
    const { container } = await render(SvgIconComponent, { inputs: { name: 'right' } });

    expect(container.querySelector('svg')).toHaveAttribute('viewBox', '0 0 12 12');
  });

  it('zeichnet jeden Eintrag der Tabelle', async () => {
    for (const name of Object.keys(ICONS) as (keyof typeof ICONS)[]) {
      TestBed.resetTestingModule();
      const { container } = await render(SvgIconComponent, { inputs: { name } });

      expect(container.querySelector('svg')?.childElementCount).toBeGreaterThan(0);
    }
  });

  it('reicht eine eigene Strichstärke durch', async () => {
    const { container } = await render(SvgIconComponent, {
      inputs: { name: 'layers', strokeWidth: 1.6 },
    });

    expect(container.querySelector('svg')).toHaveStyle({ strokeWidth: '1.6px' });
  });

  it('färbt sich schwächer im gedämpften Ton', async () => {
    const { container } = await render(SvgIconComponent, {
      inputs: { name: 'mushroom', tone: 'dim' },
    });

    expect(container.querySelector('svg')).toHaveClass('dim');
  });

  it('trägt keinen gedämpften Ton ohne die Angabe', async () => {
    const { container } = await render(SvgIconComponent, { inputs: { name: 'mushroom' } });

    expect(container.querySelector('svg')).not.toHaveClass('dim');
  });
});

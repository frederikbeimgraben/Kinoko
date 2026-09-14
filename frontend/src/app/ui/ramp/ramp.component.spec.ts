import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { RampComponent } from './ramp.component';
import { FORECAST_RAMP } from './ramp-colours';

describe('RampComponent', () => {
  it('zeigt Beschriftung, beide Enden und jede Stufe', async () => {
    const { container } = await render(RampComponent, {
      inputs: { label: 'Fundwahrscheinlichkeit je Begehung', from: '0 %', to: '50 %' },
    });

    expect(screen.getByText('Fundwahrscheinlichkeit je Begehung')).toBeInTheDocument();
    expect(screen.getByText('0 %')).toBeInTheDocument();
    expect(screen.getByText('50 %')).toBeInTheDocument();
    expect(container.querySelectorAll('.ramp__step')).toHaveLength(FORECAST_RAMP.length);
    await noViolations(container);
  });

  it('trägt die Fußnote nur, wenn eine da ist', async () => {
    const { fixture, container } = await render(RampComponent, {
      inputs: { label: 'Waldanteil', from: '0 %', to: '100 %' },
    });

    expect(container.querySelector('.note')).toBeNull();

    fixture.componentRef.setInput('note', 'Eine Zelle misst 500 Meter.');
    fixture.detectChanges();

    expect(screen.getByText('Eine Zelle misst 500 Meter.')).toBeInTheDocument();
  });

  it('nennt Hilfsmitteln die Spanne des Verlaufs', async () => {
    await render(RampComponent, {
      inputs: { label: 'Niederschlag', from: '0 mm', to: '152 mm', colours: ['#000', '#fff'] },
    });

    expect(screen.getByRole('img', { name: 'Niederschlag: 0 mm – 152 mm' })).toBeInTheDocument();
  });

  it('bleibt ohne deutsches Wort im leeren Katalog', async () => {
    const { container } = await render(RampComponent, {
      providers: [EMPTY_CATALOG],
      inputs: { label: 'Rainfall', from: '0 mm', to: '150 mm' },
    });

    noGermanText(container);
  });
});

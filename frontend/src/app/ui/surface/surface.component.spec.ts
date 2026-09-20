import { Component } from '@angular/core';
import { render } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { SurfaceComponent } from './surface.component';

@Component({
  imports: [SurfaceComponent],
  template: `<app-surface><p>Inhalt</p></app-surface>`,
})
class HostComponent {}

describe('SurfaceComponent', () => {
  it('trägt seinen Inhalt', async () => {
    const { container } = await render(HostComponent);

    expect(container.querySelector('.surface')).toHaveTextContent('Inhalt');
    await noViolations(container);
  });

  it('läuft offen in den unteren Rand', async () => {
    const { container } = await render(SurfaceComponent);

    expect(container.querySelector('.surface--closed')).toBeNull();
  });

  it('rundet sich ganz, wenn sie den Rand nicht erreicht', async () => {
    const { container } = await render(SurfaceComponent, { inputs: { open: false } });

    expect(container.querySelector('.surface--closed')).not.toBeNull();
  });
});

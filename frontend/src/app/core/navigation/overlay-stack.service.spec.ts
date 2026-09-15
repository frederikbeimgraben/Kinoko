import { TestBed } from '@angular/core/testing';
import { OverlayStackService } from './overlay-stack.service';

function build(): OverlayStackService {
  return TestBed.inject(OverlayStackService);
}

describe('OverlayStackService', () => {
  it('legt bei open einen Verlaufseintrag an', () => {
    const stack = build();
    const pushState = vi.spyOn(history, 'pushState');

    stack.open(() => undefined);

    expect(pushState).toHaveBeenCalledWith({ overlayDepth: 1 }, '');
  });

  it('geht bei back einen Schritt zurück, ohne onBack aufzurufen', () => {
    const stack = build();
    const onBack = vi.fn();
    const back = vi.spyOn(history, 'back').mockImplementation(() => undefined);
    stack.open(onBack);

    stack.back();

    expect(back).toHaveBeenCalledTimes(1);
    expect(onBack).not.toHaveBeenCalled();
  });

  it('ruft onBack bei einer echten Browser-Geste zurück auf', () => {
    const stack = build();
    const onBack = vi.fn();
    vi.spyOn(history, 'back').mockImplementation(() => undefined);
    stack.open(onBack);

    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('schließt bei back nur die oberste Ebene', () => {
    const stack = build();
    const outer = vi.fn();
    const inner = vi.fn();
    vi.spyOn(history, 'back').mockImplementation(() => undefined);
    stack.open(outer);
    stack.open(inner);

    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();
  });

  it('schwenkt die Browser-Geste nach einem eigenen back nicht doppelt aus', () => {
    const stack = build();
    const onBack = vi.fn();
    vi.spyOn(history, 'back').mockImplementation(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    stack.open(onBack);

    stack.back();

    expect(onBack).not.toHaveBeenCalled();
  });

  it('geht bei closeAll für jede Ebene einen Schritt zurück', () => {
    const stack = build();
    const go = vi.spyOn(history, 'go').mockImplementation(() => undefined);
    stack.open(() => undefined);
    stack.open(() => undefined);

    stack.closeAll();

    expect(go).toHaveBeenCalledWith(-2);
  });

  it('tut nichts, wenn keine Ebene offen steht', () => {
    const stack = build();
    const back = vi.spyOn(history, 'back').mockImplementation(() => undefined);
    const go = vi.spyOn(history, 'go').mockImplementation(() => undefined);

    stack.back();
    stack.closeAll();

    expect(back).not.toHaveBeenCalled();
    expect(go).not.toHaveBeenCalled();
  });
});

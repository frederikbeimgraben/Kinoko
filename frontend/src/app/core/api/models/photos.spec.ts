import { photo } from '../../../testing/photos-fixture';
import { photoCaption, photoCaptionLang } from './photos';

describe('photoCaption', () => {
  const both = photo({ caption: 'Junge Fruchtkörper im Moos', captionEn: 'Young fruiting bodies in moss' });

  it('gives the German caption in German', () => {
    expect(photoCaption(both, 'de')).toBe('Junge Fruchtkörper im Moos');
  });

  it('gives the English caption in English', () => {
    expect(photoCaption(both, 'en')).toBe('Young fruiting bodies in moss');
  });

  it('falls back to the German caption without an English caption', () => {
    expect(photoCaption(photo({ caption: 'Junge Fruchtkörper', captionEn: '' }), 'en')).toBe(
      'Junge Fruchtkörper',
    );
  });

  it('gives null for a photo without a caption', () => {
    expect(photoCaption(photo({ caption: null, captionEn: '' }), 'en')).toBeNull();
    expect(photoCaption(photo({ caption: null, captionEn: '' }), 'de')).toBeNull();
  });
});

describe('photoCaptionLang', () => {
  it('marks only the German fallback in another UI language', () => {
    expect(photoCaptionLang(photo({ caption: 'Junge Fruchtkörper', captionEn: '' }), 'en')).toBe('de');
    expect(photoCaptionLang(photo({ caption: 'Junge Fruchtkörper', captionEn: 'Young' }), 'en')).toBeNull();
    expect(photoCaptionLang(photo({ caption: 'Junge Fruchtkörper', captionEn: '' }), 'de')).toBeNull();
    expect(photoCaptionLang(photo({ caption: null, captionEn: '' }), 'en')).toBeNull();
  });
});

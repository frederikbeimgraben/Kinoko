import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { GROUPS, KARLSRUHE } from '../../testing/groups-fixture';
import { GroupsApi } from './groups.api';

function build(): { api: GroupsApi; http: HttpTestingController } {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  return { api: TestBed.inject(GroupsApi), http: TestBed.inject(HttpTestingController) };
}

describe('GroupsApi', () => {
  it('liest die eigenen Gruppen ohne Abfragewert', () => {
    const { api, http } = build();
    let seen = 0;

    api.list().subscribe((groups) => {
      seen = groups.length;
    });
    http.expectOne('/api/groups').flush({ items: GROUPS });

    expect(seen).toBe(2);
    http.verify();
  });

  it('fragt mit `all` nach allen Gruppen', () => {
    const { api, http } = build();

    api.list(true).subscribe();

    expect(http.expectOne('/api/groups?all=true').request.method).toBe('GET');
    http.verify();
  });

  it('legt an, tritt bei, benennt um und löscht', () => {
    const { api, http } = build();

    api.create('Familie').subscribe();
    http.expectOne({ url: '/api/groups', method: 'POST' }).flush(KARLSRUHE);
    api.join('PILZ-7F3K').subscribe();
    http.expectOne({ url: '/api/groups/join', method: 'POST' }).flush(KARLSRUHE);
    api.rename('gruppe-eins', 'Neu').subscribe();
    http.expectOne({ url: '/api/groups/gruppe-eins', method: 'PUT' }).flush(KARLSRUHE);
    api.remove('gruppe-eins').subscribe();
    http.expectOne({ url: '/api/groups/gruppe-eins', method: 'DELETE' }).flush(null);
    api.removeMember('gruppe-eins', 'konto-zwei').subscribe();

    expect(http.expectOne('/api/groups/gruppe-eins/members/konto-zwei').request.method).toBe('DELETE');
    http.verify();
  });
});

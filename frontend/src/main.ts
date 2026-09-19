import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { appConfig } from './app/app.config';
import { SILENT_PATH } from './app/core/auth';

// Ein Fehler beim Start hat keine Oberfläche, die ihn zeigen könnte.
function start(): void {
  bootstrapApplication(App, appConfig).catch((failure: unknown) => {
    document.body.textContent = String(failure);
  });
}

/** Der iframe der stillen Erneuerung meldet nur an das Fenster darüber. */
function answerSilently(): void {
  void import('oidc-client-ts').then(({ UserManager }) =>
    new UserManager({
      authority: '',
      client_id: '',
      redirect_uri: '',
      automaticSilentRenew: false,
      monitorSession: false,
    }).signinSilentCallback(),
  );
}

if (location.pathname.startsWith(SILENT_PATH)) answerSilently();
else start();

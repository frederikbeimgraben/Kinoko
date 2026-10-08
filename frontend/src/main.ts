import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { appConfig } from './app/app.config';
import { SILENT_PATH } from './app/core/auth';

// A startup error has no UI that can show it.
function start(): void {
  bootstrapApplication(App, appConfig).catch((failure: unknown) => {
    document.body.textContent = String(failure);
  });
}

/** The silent renew iframe only reports to its parent window. */
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

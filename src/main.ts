import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import localeArEg from '@angular/common/locales/ar-EG';
import { LOCALE_ID } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';

import { AppComponent } from './app/app.component';
import { authInterceptor } from './app/core/auth.interceptor';

registerLocaleData(localeArEg);

bootstrapApplication(AppComponent, {
  providers: [
    { provide: LOCALE_ID, useValue: 'ar-EG' },
    provideRouter([]),
    provideHttpClient(withInterceptors([authInterceptor]))
  ]
}).catch((error) => console.error(error));

# ZDNP e-PODNESOCI App

Flutter client for Android and Windows, located in this repository alongside the existing Cloudflare Worker and D1 schema.

## Current scope

The initial client foundation connects to the existing staff API:
- staff sign-in and secure local session storage;
- role and institution-aware dashboard;
- educator/director case list;
- administrator user list and activity summary.

The native app currently covers staff sign-in and dashboards. The website has staging endpoints for request/petition submission and status lookup; the app does not yet include the public form. Complaints and corruption/irregularity reports remain disabled until a confidential reviewer and independent routing path are defined. Do not enter real personal or correctional data in staging.

## Local setup

Install Flutter with Android and Windows desktop support. From this directory, generate the native platform scaffolding once:

```sh
flutter create --project-name zdnp_e_podnesoci --platforms=android,windows .
flutter pub get
flutter run -d windows --dart-define=ZDNP_API_BASE_URL=https://www.zdnp.org
```

For Android, select a connected device or emulator:

```sh
flutter run --dart-define=ZDNP_API_BASE_URL=https://www.zdnp.org
```

The API base URL can be overridden with `ZDNP_API_BASE_URL`. Do not point the app at production until the Worker, authentication, privacy, and institutional approval work is complete. The current Cloudflare Worker is documented as a staging/test system.

## Build

```sh
flutter build apk --release --dart-define=ZDNP_API_BASE_URL=https://www.zdnp.org
flutter build windows --release --dart-define=ZDNP_API_BASE_URL=https://www.zdnp.org
```

The app uses the Worker's existing `sid` session cookie. Its value is stored in Android secure storage or Windows protected storage and sent only over HTTPS to the configured API origin. The user's password is never stored.

# UpDown

Up/down timer that adds to or subtracts from a long-term time balance per category
(e.g. flextime). Installable web app (PWA). All data stays in the browser on
your device.

## Features

- Categories with a running balance; start a timer that counts **＋** or **－**.
- One timer at a time; starting another stops and books the running one.
- Quick bookings (presets) per category, default ±15 min, configurable.
- Edit, add and delete bookings (time range, sign, category, note).
- Bookings that ended more than one calendar month ago are folded into the category's
  archived sum and deleted (only their net effect is kept).
- Reminder every N minutes (default 30) while a timer runs: banner + optional beep.
- Export JSON (backup) / CSV, import JSON (replaces all data).
- Works fully offline after the first visit (whole app precached by a service worker).
  New versions are fetched when online and take effect on the next app start.

## Limitations (iPhone)

- No lock-screen timer (needs a native app / Live Activity).
- Reminders only fire while the app is open on screen; when you return, one catch-up
  reminder is shown. Sound follows the silent switch; iOS has no web vibration API.
- Data lives in browser storage of this origin. Export a JSON backup regularly.

## Development

```sh
npm install
npm run dev        # dev server
npm test           # unit tests (vitest)
npm run lint       # eslint
npm run format     # prettier
npm run build      # type-check + production build into dist/
npm run icons      # regenerate PNG icons in public/
```

## Install on iPhone

Hosted at <https://florianziemen.github.io/updown/> (deployed from `main` by
`.github/workflows/pages.yml`). Service workers need HTTPS; any static HTTPS host
serving `dist/` works, sub-paths included (relative paths). Open the URL in Safari →
Share → _Add to Home Screen_. Nothing is sent to the host besides fetching the static
files.

## License

MIT, see [LICENSE](LICENSE).

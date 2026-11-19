# Calibration Tracker

Keep a register of your measuring equipment, record each calibration with its test points, and print certificates and QR labels. See what is due or overdue, check gages in and out of the tool crib, and get reminders by email.

Inspired by https://gaugify.io

Built with [oss.new](https://oss.new) for [EveryApp](https://github.com/every-app/every-app).

## Features

- Keep an equipment register with intervals, owners and files, and search, sort and filter it.
- Record calibrations with environment, test points and pass/fail, then filter and export them as CSV.
- Print or save a numbered certificate for every calibration.
- Print a label whose QR code opens the record and its certificate for anyone who scans it.
- See overdue and upcoming calibrations on the dashboard and in exportable reports.
- Email owners before items fall due, or send a weekly digest.
- Check gages out of the tool crib and back in, with history.
- Make members technicians or viewers and see who changed what.

Left out: accounts and sign-in, which your Gateway handles; plans and billing; a customer portal; a REST API; AI certificate checks; work orders; CSV import; uncertainty analysis; trend charts; RFID and multi-site setups.

## Setup

```sh
pnpm install
pnpm dev                 # run locally behind the dev Gateway
pnpm test                # unit tests
pnpm run deploy          # deploy to your Cloudflare account through your Gateway
```

The app needs no secrets or settings. It uses a D1 database and an R2 bucket (enable R2 on the Cloudflare account once). Reminders are optional: they use the Gateway's email service, set up with `pnpm everyapp configure calibration-tracker`. The behavior, authorization and persistence checks in `checks/` run against a packaged release in EveryApp's validation runtime.

## Limitations

- One workspace per install; Gateway owners and admins are the app's admins.
- Certificates are saved as PDF through the browser's print dialog.
- Reminders run every 15 minutes in UTC; dates are UTC days.
- Files can be up to 20 MB each.
- Email delivery with a configured sender hasn't been tested here; the checks cover the unconfigured state.

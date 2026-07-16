# Attendance App

This repository contains:

- Mobile app (`mobile/`): React Native (Expo) app to view attendance
- Backend (`server/`): Node.js Express service that fetches attendance from an existing website (configurable) and exposes a clean JSON API for the app.

## Quick start

1) Backend

- Copy `server/.env.example` to `server/.env` and set `SOURCE_BASE_URL` to the existing website root.
- Install deps and run:

```bash
cd server
npm install
npm run dev
```

2) Mobile

- In a second terminal:

```bash
cd mobile
export API_BASE_URL=http://localhost:4000
npm install
npm start
```

Open the Expo Developer Tools link to run on web/Android/iOS as appropriate.

## Notes

- The scraper in `server/src/scraper.ts` contains placeholder selectors for `table.attendance`. Update the selectors and any authentication steps to match the real site.
- If the scraper finds no rows, it returns sample data so you can verify the mobile UI immediately.

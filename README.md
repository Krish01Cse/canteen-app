# CanteenX

This app now stores all persistent data in SQLite instead of `localStorage`.

## Deployment status

- `npm run lint` passes
- `npm run build` passes
- the Node server can now serve both the API and the built frontend in production

## Persisted data

- student and canteen accounts
- menu items
- pickup time slots
- orders and order items

The database file is created at [canteen.sqlite](/Users/krish_01/Downloads/project/canteen-app/canteen.sqlite).

## Run locally

1. `npm run dev:full`
2. Open the Vite URL shown in the terminal

That starts both the React frontend and the SQLite-backed Node API.

If you want to run them separately:

- `npm run server`
- `npm run dev`

## Deploy

This app requires Node 24+ because it uses the built-in `node:sqlite` module.

1. `npm install`
2. `npm run build`
3. `npm start`

The production server serves:

- frontend assets from `dist/`
- API routes under `/api/*`
- a health endpoint at `/health`

Optional environment variables:

- `PORT` to change the server port
- `DB_PATH` to store the SQLite database in a custom location

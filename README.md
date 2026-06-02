# RosterForge

RosterForge is a small rota planner I built for teams that just need to see who is covering what, without dragging in a full HR product.

It runs as a single Node.js app: the backend exposes a few REST endpoints, the frontend is plain HTML/CSS/JavaScript, and data is stored in a local JSON file. The point was to keep the project easy to clone, run, and inspect.

## What it does

- Add shifts with person, role, date, start, and end time
- See weekly coverage at a glance
- Highlight days that need more people
- Review simple time-off requests
- Persist changes locally in `data/store.json`

## Running it

```bash
npm start
```

Then open `http://localhost:4171`.

The app creates `data/store.json` from `data/seed.json` the first time it runs.

## API

- `GET /api/summary`
- `GET /api/shifts`
- `POST /api/shifts`
- `GET /api/requests`
- `PATCH /api/requests/:id`

## Stack

Node.js, native HTTP server, REST API, vanilla JavaScript, HTML, CSS, and JSON file persistence.

# Volunteer Shift API

Backend API for creating and managing volunteer shift signups, built for the HackIllinois 2027
Systems take-home. TypeScript, Express 5, MongoDB via Mongoose 9, validation with Zod 4.

## Run it

```bash
npm install        # first run also downloads a MongoDB binary (~100 MB) for local/test use
npm run dev        # http://localhost:3000, in-memory MongoDB unless MONGO_URI is set
npm test           # vitest against a fresh in-memory MongoDB per test file
npm run verify     # typecheck + lint + format check + tests (what CI runs)
```

Requires Node 24 or newer. See `.env.example` for configuration.

_Endpoint table, data model, and design notes are added as the project is built._

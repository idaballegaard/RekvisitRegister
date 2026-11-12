# RekvisitRegister

## MongoDB Atlas

Backend forbinder til MongoDB via værdier i `backend/.env`.

1. I Atlas skal du oprette en databasebruger under **Database Access** og tillade din udviklingsmaskines IP-adresse under **Network Access**.
2. Vælg **Connect** og derefter **Drivers** for at hente connection string til Node.js.
3. Kopiér `backend/.env.example` til `backend/.env`. Indsæt Atlas-connection string i `MONGODB_URI`, og angiv databasenavnet i `MONGODB_DB_NAME`.
4. Hvis databasebrugerens adgangskode indeholder specialtegn, skal de URL-encodes i connection stringen. Del eller commit ikke `backend/.env`.
5. Start backend med `npm --prefix backend run start-dev`. Når terminalen melder, at den er forbundet, kan du kontrollere forbindelsen på `http://localhost:3000/health`.

Et vellykket health-check svarer med `{"status":"ok","database":"connected"}`.

## Første bruger og forening

Tilføj disse værdier til din lokale `backend/.env` med foreningens navn og den første foreningsansvarliges oplysninger:

```env
INITIAL_ASSOCIATION_NAME=Esbjerg Amatørteater Råd
INITIAL_ADMIN_FIRST_NAME=Fornavn
INITIAL_ADMIN_LAST_NAME=Efternavn
INITIAL_ADMIN_USERNAME=admin
INITIAL_ADMIN_PASSWORD=brug-en-unik-adgangssætning-på-mindst-12-tegn
```

Kør derefter `npm --prefix backend run bootstrap:admin` én gang. Scriptet opretter foreningen og den første bruger i en transaktion. Det stopper, hvis databasen allerede indeholder en forening eller en bruger. Adgangskoden gemmes som bcrypt-hash; brugernavne normaliseres til små bogstaver og skal være globalt unikke. Fjern `INITIAL_ADMIN_PASSWORD` og de øvrige `INITIAL_ADMIN_*`-værdier fra `.env`, når oprettelsen er gennemført.

Brugerens dokument indeholder `firstName`, `lastName`, `userName`, `passwordHash`, `role` og `associationId`. De interne roller er `associationAdmin`, `propManager` og `searchUser`. Rolle-rettighederne er defineret i `backend/src/models/user.model.ts`; login-endpoints og beskyttelse af API-routes er næste trin.

## Backend med TypeScript

Backendens TypeScript-kildekode ligger i `backend/src/` og er opdelt i `config`, `controllers`, `models`, `repositories`, `routes`, `services` og `scripts`. Start udviklingsserveren med `npm --prefix backend run start-dev`, byg med `npm --prefix backend run build`, og kør tests med `npm --prefix backend test`.
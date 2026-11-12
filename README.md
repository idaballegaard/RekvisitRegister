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

Brugerens dokument indeholder `firstName`, `lastName`, `userName`, `passwordHash`, `role` og `associationId`. Adgangskoden skal være gemt som bcrypt-hash; en adgangskode indsat som almindelig tekst kan ikke bruges til login. De interne roller er `associationAdmin`, `propManager` og `searchUser`. Rolle-rettighederne er defineret i `backend/src/models/user.model.ts`.

## Login

Sæt `AUTH_TOKEN_SECRET` i `backend/.env` til en tilfældig hemmelighed på mindst 32 bytes. Du kan generere en med `openssl rand -base64 32`. Hold værdien hemmelig, og skift den ikke, mens aktive tokens stadig skal virke. Login-endpointet accepterer JSON med `userName` og `password`:

```http
POST /auth/login
Content-Type: application/json

{"userName":"admin","password":"din-adgangskode"}
```

Et vellykket svar indeholder et bearer-token, der udløber efter 15 minutter, og brugerens ikke-følsomme profil. Login er begrænset til 10 forsøg pr. IP-adresse pr. 15 minutter. Send tokenet i `Authorization: Bearer <token>`-headeren til `GET /auth/me` for at hente den autentificerede profil. Endpoints, der skal kræve login, skal beskyttes med autentificeringsmiddleware; dette trin beskytter `/auth/me`.

## Backend med TypeScript

Backendens TypeScript-kildekode ligger i `backend/src/` og er opdelt i `config`, `controllers`, `models`, `repositories`, `routes`, `services` og `scripts`. Start udviklingsserveren med `npm --prefix backend run start-dev`, byg med `npm --prefix backend run build`, og kør tests med `npm --prefix backend test`.
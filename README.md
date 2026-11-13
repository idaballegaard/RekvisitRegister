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
INITIAL_ADMIN_EMAIL=admin@example.dk
INITIAL_ADMIN_PASSWORD=brug-en-unik-adgangssætning-på-mindst-12-tegn
```

Kør derefter `npm --prefix backend run bootstrap:admin` én gang. Scriptet opretter foreningen og den første bruger i en transaktion. Det stopper, hvis databasen allerede indeholder en forening eller en bruger. E-mail er påkrævet, trimmes og gemmes med små bogstaver; e-mailadresser skal være unikke (uden forskel på store og små bogstaver). Backend opretter et unikt indeks ved opstart og stopper med en fejl, hvis eksisterende brugere har dublerede e-mailadresser. Adgangskoden gemmes som bcrypt-hash; brugernavne normaliseres til små bogstaver og skal være globalt unikke. Fjern `INITIAL_ADMIN_PASSWORD` og de øvrige `INITIAL_ADMIN_*`-værdier fra `.env`, når oprettelsen er gennemført.

Brugerens dokument indeholder `firstName`, `lastName`, `userName`, `email`, `passwordHash`, `role` og `associationId`. E-mail kan ses og opdateres på profilsiden. Adgangskoden skal være gemt som bcrypt-hash; en adgangskode indsat som almindelig tekst kan ikke bruges til login. De interne roller er `associationAdmin`, `propManager` og `searchUser`. Rolle-rettighederne er defineret i `backend/src/models/user.model.ts`.

## Login

Sæt `AUTH_TOKEN_SECRET` i `backend/.env` til en tilfældig hemmelighed på mindst 32 bytes. Du kan generere en med `openssl rand -base64 32`. Hold værdien hemmelig, og skift den ikke, mens aktive tokens stadig skal virke. Login-endpointet accepterer JSON med `userName` og `password`:

Start backend lokalt med `npm --prefix backend run start-dev`, og åbn `http://localhost:3000/api-docs` for Swagger UI. Brug `POST /auth/login` med brugerens almindelige adgangskode (ikke bcrypt-hashen) for at prøve login mod den konfigurerede database. Klik **Authorize** og indsæt `accessToken`-værdien fra svaret for derefter at prøve `GET /auth/me`. Swagger UI er kun aktiveret uden for `NODE_ENV=production`. Brug kun testkonti til manuel afprøvning, og del ikke tokens.

```http
POST /auth/login
Content-Type: application/json

{"userName":"admin","password":"din-adgangskode"}
```

Et vellykket svar indeholder et bearer-token, der udløber efter 15 minutter, og brugerens ikke-følsomme profil. Login er begrænset til 10 forsøg pr. IP-adresse pr. 15 minutter. Send tokenet i `Authorization: Bearer <token>`-headeren til `GET /auth/me` for at hente den autentificerede profil.

Beskyttede API-ruter skal bruge `requireAuthentication`. Ruter, der kræver en bestemt rettighed, skal også bruge `requirePermission` fra `backend/src/middleware/auth.middleware.ts`, for eksempel:

```ts
router.post(
  '/props',
  requireAuthentication,
  requirePermission(PERMISSIONS.MANAGE_PROPS),
  createProp,
)
```

Middleware svarer med `401` uden gyldigt login og `403`, hvis brugerens rolle mangler rettigheden. Projektet har endnu ingen rekvisit- eller andre forretningsruter; de skal tilføjes og beskyttes, når funktionerne implementeres.

En indlogget bruger kan skifte adgangskode med `PATCH /auth/password`. Kaldet kræver den nuværende adgangskode og en ny adgangskode på 12-72 UTF-8 bytes. JWT-tokenet bliver ikke tilbagekaldt ved skiftet; aktive tokens udløber fortsat efter deres normale 15 minutter.

## Backend med TypeScript

Backendens TypeScript-kildekode ligger i `backend/src/` og er opdelt i `config`, `controllers`, `models`, `repositories`, `routes`, `services` og `scripts`. Start udviklingsserveren med `npm --prefix backend run start-dev`, byg med `npm --prefix backend run build`, og kør tests med `npm --prefix backend test`. Auth-integrationstestene bruger en isoleret MongoDB Memory Server og forbinder ikke til din konfigurerede database; første testkørsel kan hente en MongoDB-binary.
export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'RekvisitRegister API',
    version: '1.0.0',
    description: 'API-dokumentation for login og sundhedstjek.',
  },
  servers: [{ url: '/', description: 'Samme server som Swagger UI' }],
  paths: {
    '/health': {
      get: {
        summary: 'Kontrollér backendens databaseforbindelse',
        responses: {
          '200': {
            description: 'Backend og database er tilgængelige.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['status', 'database'],
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    database: { type: 'string', example: 'connected' },
                  },
                },
              },
            },
          },
          '503': {
            description: 'Databasen er ikke tilgængelig.',
          },
        },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Log ind og få et bearer-token',
        description: 'Kræver en eksisterende bruger med et bcrypt-hash i passwordHash.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['userName', 'password'],
                properties: {
                  userName: { type: 'string', example: 'admin' },
                  password: { type: 'string', format: 'password', example: 'din-adgangskode' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Login lykkedes. Tokenet udløber efter 15 minutter.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['tokenType', 'expiresIn', 'accessToken', 'user'],
                  properties: {
                    tokenType: { type: 'string', example: 'Bearer' },
                    expiresIn: { type: 'integer', example: 900 },
                    accessToken: { type: 'string' },
                    user: { $ref: '#/components/schemas/UserProfile' },
                  },
                },
              },
            },
          },
          '400': { description: 'Loginfelter mangler eller er ugyldige.' },
          '401': { description: 'Brugernavn eller adgangskode er forkert.' },
          '429': { description: 'For mange loginforsøg.' },
        },
      },
    },
    '/auth/me': {
      get: {
        summary: 'Hent profilen for den indloggede bruger',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Den autentificerede brugerprofil.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['user'],
                  properties: {
                    user: { $ref: '#/components/schemas/UserProfile' },
                  },
                },
              },
            },
          },
          '401': { description: 'Bearer-token mangler, er ugyldigt eller udløbet.' },
          '404': { description: 'Brugerens forening blev ikke fundet.' },
        },
      },
    },
    '/auth/password': {
      patch: {
        summary: 'Skift adgangskode for den indloggede bruger',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['currentPassword', 'newPassword'],
                properties: {
                  currentPassword: { type: 'string', format: 'password' },
                  newPassword: {
                    type: 'string',
                    format: 'password',
                    description: 'Skal være 12-72 UTF-8 bytes.',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Adgangskoden blev opdateret.' },
          '400': { description: 'Felter mangler, ny adgangskode er ugyldig, eller nuværende adgangskode er forkert.' },
          '401': { description: 'Bearer-token mangler eller er ugyldigt.' },
          '404': { description: 'Brugeren findes ikke længere.' },
          '409': { description: 'Adgangskoden blev ændret samtidig.' },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      UserProfile: {
        type: 'object',
        required: [
          'userId',
          'firstName',
          'lastName',
          'userName',
          'role',
          'associationId',
          'associationName',
        ],
        properties: {
          userId: { type: 'string', example: '0123456789abcdef01234567' },
          firstName: { type: 'string', example: 'Ada' },
          lastName: { type: 'string', example: 'Lovelace' },
          userName: { type: 'string', example: 'ada.l' },
          role: {
            type: 'string',
            enum: ['associationAdmin', 'propManager', 'searchUser'],
          },
          associationId: { type: 'string', example: 'fedcba9876543210fedcba98' },
          associationName: { type: 'string', example: 'Skarntyden' },
        },
      },
    },
  },
} as const

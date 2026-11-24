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
    '/auth/forgot-password': {
      post: {
        summary: 'Anmod om et link til nulstilling af adgangskode',
        description: 'Svarteksten afslører ikke, om e-mailadressen findes i systemet.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: {
                  email: { type: 'string', format: 'email', maxLength: 254 },
                },
              },
            },
          },
        },
        responses: {
          '202': { description: 'Hvis adressen findes, sendes et nulstillingslink.' },
          '400': { description: 'E-mailadressen mangler eller er ugyldig.' },
          '429': { description: 'For mange forsøg.' },
          '503': { description: 'Mailafsendelse er ikke konfigureret eller tilgængelig.' },
        },
      },
    },
    '/auth/reset-password': {
      post: {
        summary: 'Nulstil adgangskode med et engangslink',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['token', 'newPassword'],
                properties: {
                  token: { type: 'string', minLength: 64, maxLength: 64 },
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
          '200': { description: 'Adgangskoden er nulstillet.' },
          '400': { description: 'Felter er ugyldige, eller tokenet er ugyldigt, brugt eller udløbet.' },
          '429': { description: 'For mange forsøg.' },
        },
      },
    },
    '/auth/accept-invitation': {
      post: {
        summary: 'Aktivér en inviteret bruger og vælg adgangskode',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['token', 'newPassword'],
                properties: {
                  token: { type: 'string', minLength: 64, maxLength: 64 },
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
          '200': { description: 'Kontoen er aktiveret.' },
          '400': { description: 'Felter er ugyldige, eller invitationslinket er brugt eller udløbet.' },
          '429': { description: 'For mange forsøg.' },
        },
      },
    },
    '/auth/email-verification': {
      post: {
        summary: 'Send bekræftelseslink til den indloggede brugers e-mail',
        security: [{ bearerAuth: [] }],
        responses: {
          '202': { description: 'Et link er sendt, hvis e-mailadressen ikke allerede er bekræftet.' },
          '401': { description: 'Bearer-token mangler eller er ugyldigt.' },
          '429': { description: 'For mange forsøg.' },
          '503': { description: 'Mailafsendelse er ikke konfigureret eller tilgængelig.' },
        },
      },
    },
    '/auth/confirm-email': {
      post: {
        summary: 'Bekræft e-mailadresse med et engangslink',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['token'],
                properties: {
                  token: { type: 'string', minLength: 64, maxLength: 64 },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'E-mailadressen er bekræftet.' },
          '400': { description: 'Bekræftelsestokenet er ugyldigt, brugt eller udløbet.' },
          '429': { description: 'For mange forsøg.' },
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
    '/associations/current/users': {
      get: {
        summary: 'Hent brugere i den indloggede brugers forening',
        description: 'Kræver tilladelsen createAssociationUsers.',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Brugere i den aktuelle forening.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['users'],
                  properties: {
                    users: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/AssociationUser' },
                    },
                  },
                },
              },
            },
          },
          '401': { description: 'Bearer-token mangler eller er ugyldigt.' },
          '403': { description: 'Kun foreningsansvarlige må administrere brugere.' },
        },
      },
      post: {
        summary: 'Opret en bruger og send et invitationslink',
        description: 'Foreningsansvarlige kan invitere rekvisitansvarlige eller søgebrugere. Linket udløber efter 24 timer.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['firstName', 'lastName', 'userName', 'email', 'role'],
                properties: {
                  firstName: { type: 'string', maxLength: 120 },
                  lastName: { type: 'string', maxLength: 120 },
                  userName: { type: 'string', minLength: 3, maxLength: 32 },
                  email: { type: 'string', format: 'email', maxLength: 254 },
                  role: { type: 'string', enum: ['propManager', 'searchUser'] },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Brugeren blev oprettet, og invitationen blev sendt.' },
          '400': { description: 'Brugeroplysningerne er ugyldige.' },
          '401': { description: 'Bearer-token mangler eller er ugyldigt.' },
          '403': { description: 'Kun foreningsansvarlige må administrere brugere.' },
          '409': { description: 'Brugernavnet eller e-mailadressen er allerede i brug.' },
          '503': { description: 'E-mailinvitationen kunne ikke sendes.' },
        },
      },
    },
    '/associations/current/users/{userId}/invitation': {
      post: {
        summary: 'Send invitation til en afventende bruger igen',
        description: 'Kræver tilladelsen createAssociationUsers. Brugeren skal tilhøre den aktuelle forening.',
        security: [{ bearerAuth: [] }],
        parameters: [{
          name: 'userId',
          in: 'path',
          required: true,
          schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
        }],
        responses: {
          '200': { description: 'Invitationen blev sendt igen med et nyt 24-timerslink.' },
          '401': { description: 'Bearer-token mangler eller er ugyldigt.' },
          '403': { description: 'Kun foreningsansvarlige må administrere brugere.' },
          '404': { description: 'Den afventende bruger blev ikke fundet i foreningen.' },
          '503': { description: 'E-mailinvitationen kunne ikke sendes.' },
        },
      },
    },
    '/associations/current/props': {
      post: {
        summary: 'Opret en rekvisit i den indloggede brugers forening',
        description: 'Kræver tilladelsen manageProps (foreningsansvarlig eller rekvisitansvarlig). Lageradressen skal tilhøre foreningen.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AssociationPropUpdate' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Rekvisitten er oprettet.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['message', 'prop'],
                  properties: {
                    message: { type: 'string' },
                    prop: { $ref: '#/components/schemas/AssociationProp' },
                  },
                },
              },
            },
          },
          '400': { description: 'Rekvisitoplysningerne eller lageradressen er ugyldige.' },
          '401': { description: 'Bearer-token mangler eller er ugyldigt.' },
          '403': { description: 'Brugeren må ikke oprette rekvisitter.' },
        },
      },
      get: {
        summary: 'Hent rekvisitter for den indloggede brugers forening',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Foreningens rekvisitter sorteret efter navn.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['props'],
                  properties: {
                    props: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/AssociationProp' },
                    },
                  },
                },
              },
            },
          },
          '401': { description: 'Bearer-token mangler eller er ugyldigt.' },
          '403': { description: 'Brugeren må ikke søge i rekvisitter.' },
          '500': { description: 'En eller flere rekvisitter har ugyldige databaseoplysninger.' },
        },
      },
    },
    '/associations/current/props/{propId}/images': {
      post: {
        summary: 'Tilføj et billede til en af foreningens rekvisitter',
        description: 'Foreningsansvarlige og rekvisitansvarlige kan tilføje billeder. JPEG, PNG eller WebP; højst 5 MiB og 10 billeder pr. rekvisit. Billedet genkodes til WebP.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'propId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'image/jpeg': { schema: { type: 'string', format: 'binary' } },
            'image/png': { schema: { type: 'string', format: 'binary' } },
            'image/webp': { schema: { type: 'string', format: 'binary' } },
          },
        },
        responses: {
          '201': {
            description: 'Billedet er tilføjet.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['imageId'],
                  properties: { imageId: { type: 'string' } },
                },
              },
            },
          },
          '400': { description: 'Ugyldigt billede eller billedgrænsen er nået.' },
          '401': { description: 'Login er påkrævet.' },
          '403': { description: 'Brugeren må ikke tilføje billeder.' },
          '404': { description: 'Rekvisitten blev ikke fundet i foreningen.' },
          '413': { description: 'Billedet er større end 5 MiB.' },
        },
      },
    },
    '/associations/current/props/{propId}/images/{imageId}': {
      parameters: [
        { name: 'propId', in: 'path', required: true, schema: { type: 'string' } },
        { name: 'imageId', in: 'path', required: true, schema: { type: 'string' } },
      ],
      get: {
        summary: 'Hent et billede af en af foreningens rekvisitter',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Billedet i WebP-format.',
            content: { 'image/webp': { schema: { type: 'string', format: 'binary' } } },
          },
          '401': { description: 'Login er påkrævet.' },
          '403': { description: 'Brugeren må ikke se rekvisitter.' },
          '404': { description: 'Billedet blev ikke fundet i foreningen.' },
        },
      },
      delete: {
        summary: 'Fjern et billede fra en af foreningens rekvisitter',
        description: 'Foreningsansvarlige og rekvisitansvarlige kan fjerne billeder.',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Billedet er fjernet.' },
          '401': { description: 'Login er påkrævet.' },
          '403': { description: 'Brugeren må ikke fjerne billeder.' },
          '404': { description: 'Billedet blev ikke fundet i foreningen.' },
        },
      },
    },
    '/associations/current/props/{propId}/reservations': {
      parameters: [
        { name: 'propId', in: 'path', required: true, schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } },
      ],
      get: {
        summary: 'Hent reservationer for en af foreningens rekvisitter',
        description: 'Kræver tilladelsen manageProps. Returnerer perioder, der blokerer hele rekvisitten.',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Rekvisittens reservationer sorteret efter startdato.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['reservations'],
                  properties: {
                    reservations: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/AssociationReservation' },
                    },
                  },
                },
              },
            },
          },
          '401': { description: 'Login er påkrævet.' },
          '403': { description: 'Brugeren må ikke administrere reservationer.' },
          '404': { description: 'Rekvisitten blev ikke fundet i foreningen.' },
        },
      },
      post: {
        summary: 'Reserver en rekvisit for en periode',
        description: 'Foreningsansvarlige og rekvisitansvarlige kan blokere hele rekvisitten. Datoerne er inklusive, og perioder må ikke overlappe.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['startDate', 'endDate'],
                properties: {
                  startDate: { type: 'string', format: 'date' },
                  endDate: { type: 'string', format: 'date' },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Reservationen er oprettet.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['message', 'reservation'],
                  properties: {
                    message: { type: 'string' },
                    reservation: { $ref: '#/components/schemas/AssociationReservation' },
                  },
                },
              },
            },
          },
          '400': { description: 'Datoerne er ugyldige.' },
          '401': { description: 'Login er påkrævet.' },
          '403': { description: 'Brugeren må ikke administrere reservationer.' },
          '404': { description: 'Rekvisitten blev ikke fundet i foreningen.' },
          '409': { description: 'Rekvisitten er utilgængelig eller allerede reserveret i perioden.' },
        },
      },
    },
    '/associations/current/props/{propId}/reservations/{reservationId}': {
      parameters: [
        { name: 'propId', in: 'path', required: true, schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } },
        { name: 'reservationId', in: 'path', required: true, schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } },
      ],
      delete: {
        summary: 'Fjern en reservation for en af foreningens rekvisitter',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Reservationen er fjernet.' },
          '401': { description: 'Login er påkrævet.' },
          '403': { description: 'Brugeren må ikke administrere reservationer.' },
          '404': { description: 'Reservationen blev ikke fundet i foreningen.' },
        },
      },
    },
    '/associations/current/props/{propId}': {
      patch: {
        summary: 'Opdatér en rekvisit i den indloggede brugers forening',
        description: 'Kræver tilladelsen manageProps (foreningsansvarlig eller rekvisitansvarlig). Rekvisitten og lageradressen skal tilhøre foreningen.',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'propId',
            in: 'path',
            required: true,
            schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AssociationPropUpdate' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Rekvisitten er opdateret.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['message', 'prop'],
                  properties: {
                    message: { type: 'string' },
                    prop: { $ref: '#/components/schemas/AssociationProp' },
                  },
                },
              },
            },
          },
          '400': { description: 'Rekvisitoplysningerne eller lageradressen er ugyldige.' },
          '401': { description: 'Bearer-token mangler eller er ugyldigt.' },
          '403': { description: 'Brugeren må ikke redigere rekvisitter.' },
          '404': { description: 'Rekvisitten blev ikke fundet i foreningen.' },
        },
      },
      delete: {
        summary: 'Slet en rekvisit i den indloggede brugers forening',
        description: 'Kræver tilladelsen manageProps (foreningsansvarlig eller rekvisitansvarlig). Rekvisittens billeder fjernes også.',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'propId',
            in: 'path',
            required: true,
            schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
          },
        ],
        responses: {
          '200': {
            description: 'Rekvisitten og dens billeder er slettet.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['message'],
                  properties: { message: { type: 'string' } },
                },
              },
            },
          },
          '401': { description: 'Bearer-token mangler eller er ugyldigt.' },
          '403': { description: 'Brugeren må ikke slette rekvisitter.' },
          '404': { description: 'Rekvisitten blev ikke fundet i foreningen.' },
          '500': { description: 'Rekvisitten blev slettet, men billedfiler kunne ikke ryddes.' },
        },
      },
    },
    '/associations/current': {
      get: {
        summary: 'Hent oplysninger om den indloggede brugers forening',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Foreningens oplysninger og alle tilknyttede lageradresser.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['association'],
                  properties: {
                    association: { $ref: '#/components/schemas/AssociationProfile' },
                  },
                },
              },
            },
          },
          '401': { description: 'Bearer-token mangler eller er ugyldigt.' },
          '404': { description: 'Foreningen blev ikke fundet.' },
        },
      },
      patch: {
        summary: 'Opdatér foreningens navn og overordnede kontaktperson',
        description: 'Kræver rollen associationAdmin.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'contactPerson'],
                properties: {
                  name: { type: 'string', maxLength: 120 },
                  contactPerson: {
                    type: 'object',
                    required: ['name', 'email', 'phone'],
                    properties: {
                      name: { type: 'string', maxLength: 120 },
                      email: { type: 'string', format: 'email', maxLength: 254 },
                      phone: { type: 'string', maxLength: 50 },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Foreningens oplysninger blev opdateret.' },
          '400': { description: 'Foreningsoplysningerne er ugyldige.' },
          '401': { description: 'Bearer-token mangler eller er ugyldigt.' },
          '403': { description: 'Kun foreningsansvarlige må ændre oplysningerne.' },
          '404': { description: 'Foreningen blev ikke fundet.' },
        },
      },
    },
    '/associations/current/storage-locations': {
      post: {
        summary: 'Tilføj en lageradresse til den indloggede brugers forening',
        description: 'Kræver rollen associationAdmin.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['address', 'postalCode', 'city'],
                properties: {
                  address: { type: 'string', maxLength: 200 },
                  postalCode: { type: 'string', maxLength: 20 },
                  city: { type: 'string', maxLength: 100 },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Lageradressen blev tilføjet.' },
          '400': { description: 'Lageradressens oplysninger er ugyldige.' },
          '401': { description: 'Bearer-token mangler eller er ugyldigt.' },
          '403': { description: 'Kun foreningsansvarlige må tilføje lageradresser.' },
          '404': { description: 'Foreningen blev ikke fundet.' },
        },
      },
    },
    '/associations/current/storage-locations/{locationId}': {
      patch: {
        summary: 'Redigér en lageradresse for den indloggede brugers forening',
        description: 'Kræver rollen associationAdmin. Adressen skal være tilknyttet foreningen.',
        security: [{ bearerAuth: [] }],
        parameters: [{
          name: 'locationId',
          in: 'path',
          required: true,
          schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
        }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['address', 'postalCode', 'city'],
                properties: {
                  address: { type: 'string', maxLength: 200 },
                  postalCode: { type: 'string', maxLength: 20 },
                  city: { type: 'string', maxLength: 100 },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Lageradressen blev opdateret.' },
          '400': { description: 'Lageradressens oplysninger er ugyldige.' },
          '401': { description: 'Bearer-token mangler eller er ugyldigt.' },
          '403': { description: 'Kun foreningsansvarlige må ændre lageradresser.' },
          '404': { description: 'Foreningen eller lageradressen blev ikke fundet.' },
        },
      },
      delete: {
        summary: 'Fjern en lageradresse fra den indloggede brugers forening',
        description: 'Kræver rollen associationAdmin. Adressen skal være tilknyttet foreningen.',
        security: [{ bearerAuth: [] }],
        parameters: [{
          name: 'locationId',
          in: 'path',
          required: true,
          schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
        }],
        responses: {
          '200': { description: 'Lageradressen blev fjernet.' },
          '401': { description: 'Bearer-token mangler eller er ugyldigt.' },
          '403': { description: 'Kun foreningsansvarlige må fjerne lageradresser.' },
          '404': { description: 'Foreningen eller lageradressen blev ikke fundet.' },
        },
      },
    },
    '/auth/profile': {
      patch: {
        summary: 'Opdatér e-mailadressen for den indloggede bruger',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: {
                  email: { type: 'string', format: 'email', maxLength: 254 },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'E-mailadressen blev opdateret.' },
          '400': { description: 'E-mail mangler eller er ugyldig.' },
          '401': { description: 'Bearer-token mangler eller er ugyldigt.' },
          '409': { description: 'E-mailadressen er allerede knyttet til en anden bruger.' },
          '404': { description: 'Brugeren findes ikke længere.' },
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
          'email',
          'role',
          'associationId',
          'associationName',
        ],
        properties: {
          userId: { type: 'string', example: '0123456789abcdef01234567' },
          firstName: { type: 'string', example: 'Ada' },
          lastName: { type: 'string', example: 'Lovelace' },
          userName: { type: 'string', example: 'ada.l' },
          email: { type: 'string', format: 'email', example: 'ada@example.dk' },
          role: {
            type: 'string',
            enum: ['associationAdmin', 'propManager', 'searchUser'],
          },
          AssociationUser: {
            type: 'object',
            required: [
              'id',
              'firstName',
              'lastName',
              'userName',
              'email',
              'role',
              'status',
              'createdAt',
            ],
            properties: {
              id: { type: 'string', example: '0123456789abcdef01234567' },
              firstName: { type: 'string', example: 'Ada' },
              lastName: { type: 'string', example: 'Lovelace' },
              userName: { type: 'string', example: 'ada.l' },
              email: { type: 'string', format: 'email', example: 'ada@example.dk' },
              role: { type: 'string', enum: ['associationAdmin', 'propManager', 'searchUser'] },
              status: { type: 'string', enum: ['active', 'pending', 'unverified'] },
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
          associationId: { type: 'string', example: 'fedcba9876543210fedcba98' },
          associationName: { type: 'string', example: 'Skarntyden' },
        },
      },
      AssociationProfile: {
        type: 'object',
        required: ['name', 'contactPerson', 'storageLocations'],
        properties: {
          name: { type: 'string', example: 'Esbjerg Amatør Teater Skantryden' },
          contactPerson: {
            type: 'object',
            nullable: true,
            description: 'Foreningens overordnede kontaktperson.',
            required: ['name', 'email', 'phone'],
            properties: {
              name: { type: 'string', example: 'Thomas Boulund Meng Hansen' },
              email: { type: 'string', format: 'email', example: 'thomas@example.dk' },
              phone: { type: 'string', example: '+45 60409598' },
            },
          },
          storageLocations: {
            type: 'array',
            description: 'Alle lageradresser refereret af storageLocationIds.',
            items: {
              type: 'object',
              required: ['id', 'address', 'postalCode', 'city'],
              properties: {
                id: { type: 'string', example: '6afebf6344bf850bfc30a250' },
                address: { type: 'string', example: 'Industrivej 7' },
                postalCode: { type: 'string', example: '6740' },
                city: { type: 'string', example: 'Bramming' },
              },
            },
          },
        },
      },
      AssociationProp: {
        type: 'object',
        required: [
          'id',
          'name',
          'description',
          'storageLocationId',
          'availability',
          'dimensions',
          'quantity',
          'colour',
          'placement',
          'tags',
          'condition',
          'historicalPeriod',
        ],
        properties: {
          id: { type: 'string', example: '6b002a5c3c49f74ff7188de8' },
          name: { type: 'string', example: 'Træstol' },
          description: { type: 'string', example: 'Mørk træstol med polstret sæde.' },
          storageLocationId: { type: 'string', example: '6afebf6344bf850bfc30a250' },
          availability: { type: 'boolean', example: true },
          dimensions: {
            type: 'object',
            required: ['height', 'width', 'depth', 'unit'],
            properties: {
              height: { type: 'number', example: 90 },
              width: { type: 'number', example: 45 },
              depth: { type: 'number', example: 45 },
              unit: { type: 'string', example: 'cm' },
            },
          },
          quantity: { type: 'number', example: 1 },
          colour: { type: 'string', example: 'Mørkebrun' },
          placement: { type: 'string', example: 'Reol 3' },
          tags: { type: 'array', items: { type: 'string' }, example: ['stol', 'træstol'] },
          condition: { type: 'string', example: 'God stand med lette brugsspor' },
          historicalPeriod: { type: 'string', example: '1920’erne' },
          imageIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Billed-id’er i visningsrækkefølge. Kan mangle for ældre rekvisitter.',
          },
        },
      },
      AssociationPropUpdate: {
        type: 'object',
        required: [
          'name',
          'description',
          'storageLocationId',
          'availability',
          'dimensions',
          'quantity',
          'colour',
          'placement',
          'tags',
          'condition',
          'historicalPeriod',
        ],
        properties: {
          name: { type: 'string', maxLength: 120 },
          description: { type: 'string', maxLength: 2000 },
          storageLocationId: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
          availability: { type: 'boolean' },
          dimensions: {
            type: 'object',
            required: ['height', 'width', 'depth', 'unit'],
            properties: {
              height: { type: 'number', minimum: 0 },
              width: { type: 'number', minimum: 0 },
              depth: { type: 'number', minimum: 0 },
              unit: { type: 'string', minLength: 1, maxLength: 20 },
            },
          },
          quantity: { type: 'integer', minimum: 1 },
          colour: { type: 'string', maxLength: 80 },
          placement: { type: 'string', maxLength: 120 },
          tags: {
            type: 'array',
            maxItems: 30,
            items: { type: 'string', minLength: 1, maxLength: 50 },
          },
          condition: { type: 'string', maxLength: 500 },
          historicalPeriod: { type: 'string', maxLength: 100 },
        },
      },
      AssociationReservation: {
        type: 'object',
        required: ['id', 'propId', 'startDate', 'endDate', 'createdAt'],
        properties: {
          id: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
          propId: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
} as const

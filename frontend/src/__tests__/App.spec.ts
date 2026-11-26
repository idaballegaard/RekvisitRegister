import { afterEach, describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import PropImage from '../components/PropImage.vue'
import AcceptInvitationView from '../views/AcceptInvitationView.vue'
import AdminView from '../views/AdminView.vue'
import LoginView from '../views/LoginView.vue'
import ProfileView from '../views/ProfileView.vue'
import PropDetailView from '../views/PropDetailView.vue'
import ResetPasswordView from '../views/ResetPasswordView.vue'
import VerifyEmailView from '../views/VerifyEmailView.vue'

const { routerPush, routerReplace, routeState } = vi.hoisted(() => ({
  routerPush: vi.fn(),
  routerReplace: vi.fn(),
  routeState: {
    params: { propId: '6b002a5c3c49f74ff7188de8' },
    query: { token: 'a'.repeat(64), tab: '', q: 'stol' },
  },
}))

vi.mock('vue-router', () => ({
  RouterLink: { template: '<a><slot /></a>' },
  useRouter: () => ({ push: routerPush, replace: routerReplace }),
  useRoute: () => routeState,
}))

const currentUserResponse = {
  user: {
    userId: '0123456789abcdef01234567',
    firstName: 'Ada',
    lastName: 'Lovelace',
    userName: 'ada.l',
    email: 'ada@example.dk',
    emailVerified: true,
    role: 'associationAdmin',
    associationId: 'fedcba9876543210fedcba98',
    associationName: 'Skarntyden',
  },
}

const associationResponse = {
  association: {
    name: 'Skarntyden',
    contactPerson: {
      name: 'Thomas Boulund Meng Hansen',
      email: 'thomas@eatskarntyden.dk',
      phone: '+45 60409598',
    },
    storageLocations: [
      {
        id: '6afebf6344bf850bfc30a250',
        address: 'Industrivej 7',
        postalCode: '6740',
        city: 'Bramming',
      },
      {
        id: '6afebf6344bf850bfc30a251',
        address: 'Teatergade 2',
        postalCode: '6700',
        city: 'Esbjerg',
      },
    ],
  },
}

const associationPropsResponse = {
  props: [
    {
      id: '6b002a5c3c49f74ff7188de8',
      name: 'Træstol',
      description: 'Mørk træstol med polstret sæde.',
      storageLocationId: '6afebf6344bf850bfc30a250',
      availability: true,
      dimensions: { height: 90, width: 45, depth: 45, unit: 'cm' },
      quantity: 1,
      colour: 'Mørkebrun',
      placement: 'Reol 3',
      tags: ['stol', 'træstol', 'møbel', 'polstret'],
      condition: 'God stand med lette brugsspor',
      historicalPeriod: '1920’erne',
    },
    {
      id: '6b002a5c3c49f74ff7188de9',
      name: 'Læderkuffert',
      description: 'Brun rejsekuffert med metalspænder.',
      storageLocationId: '6afebf6344bf850bfc30a251',
      availability: false,
      dimensions: { height: 50, width: 35, depth: 20, unit: 'cm' },
      quantity: 2,
      colour: 'Brun',
      placement: 'Reol 1',
      tags: ['kuffert', 'rejse'],
      condition: 'Slidt',
      historicalPeriod: '1940’erne',
    },
  ],
}

describe('LoginView', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    routerPush.mockReset()
    sessionStorage.clear()
  })

  it('renders the login page and its access fields', () => {
    const wrapper = mount(LoginView)

    expect(wrapper.text()).toContain('Velkommen tilbage')
    expect(wrapper.find('label[for="userName"]').text()).toBe('Brugernavn')
    expect(wrapper.get('input[name="userName"]').attributes('type')).toBe('text')
    expect(wrapper.get('input[name="userName"]').attributes('autocomplete')).toBe('username')
    expect(wrapper.find('input[type="password"]').exists()).toBe(true)
  })

  it('toggles password visibility', async () => {
    const wrapper = mount(LoginView)

    await wrapper.get('button[aria-label="Vis adgangskode"]').trigger('click')

    expect(wrapper.get('input[name="password"]').attributes('type')).toBe('text')
    expect(wrapper.find('button[aria-label="Skjul adgangskode"]').exists()).toBe(true)
  })

  it('logs in and navigates to the profile', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      tokenType: 'Bearer',
      expiresIn: 900,
      accessToken: 'test-access-token',
      user: {
        userId: '0123456789abcdef01234567',
        firstName: 'Ada',
        lastName: 'Lovelace',
        userName: 'ada.l',
        role: 'associationAdmin',
        associationId: 'fedcba9876543210fedcba98',
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(LoginView)

    await wrapper.get('input[name="userName"]').setValue('ada.l')
    await wrapper.get('input[name="password"]').setValue('a-long-passphrase')
    await wrapper.get('form').trigger('submit')

    await vi.waitFor(() => {
      expect(routerPush).toHaveBeenCalledWith({ name: 'profile' })
    })
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName: 'ada.l', password: 'a-long-passphrase' }),
    })
    expect(sessionStorage.getItem('rekvisit-register.access-token')).toBe('test-access-token')
  })

  it('shows backend login errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: 'Brugernavn eller adgangskode er forkert' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )))
    const wrapper = mount(LoginView)

    await wrapper.get('input[name="userName"]').setValue('ada.l')
    await wrapper.get('input[name="password"]').setValue('wrong-password')
    await wrapper.get('form').trigger('submit')

    await vi.waitFor(() => {
      expect(wrapper.get('[role="alert"]').text()).toContain('Brugernavn eller adgangskode er forkert')
    })
    expect(sessionStorage.getItem('rekvisit-register.access-token')).toBeNull()
  })

  it('requests a password reset without revealing whether the email exists', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({
        message: 'Hvis e-mailadressen findes, sender vi et link til nulstilling.',
      }),
      { status: 202, headers: { 'Content-Type': 'application/json' } },
    ))
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(LoginView)

    await wrapper.get('button[aria-label="Glemt adgangskode?"]').trigger('click')
    await wrapper.get('input[name="resetEmail"]').setValue('ada@example.dk')
    await wrapper.get('form[aria-label="Anmod om nulstilling"]').trigger('submit')

    await vi.waitFor(() => {
      expect(wrapper.get('[role="status"]').text()).toContain('Hvis e-mailadressen findes')
    })
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ada@example.dk' }),
    })
  })
})

describe('AdminView', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    routerPush.mockReset()
    routerReplace.mockReset()
    routeState.query.tab = ''
    routeState.query.q = 'stol'
    sessionStorage.clear()
  })

  it('shows general association details and every warehouse address', async () => {
    sessionStorage.setItem('rekvisit-register.access-token', 'current-test-token')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(
        JSON.stringify(currentUserResponse),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify(associationResponse),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(AdminView)

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Skarntyden')
    })
    expect(wrapper.get('main').classes()).toContain('mx-auto')
    expect(wrapper.get('main').classes()).toContain('max-w-[1250px]')
    expect(wrapper.text()).toContain('Adminpanel')
    expect(wrapper.get('h1').classes()).toContain('text-4xl')
    expect(wrapper.get('header > div > div > p').classes()).toContain('text-base')
    expect(wrapper.text()).toContain('Generelt')
    expect(wrapper.text()).toContain('Kontaktoplysninger')
    expect(wrapper.text()).not.toContain('Foreningens oplysninger')
    expect(wrapper.text()).not.toContain('Administrér brugere')
    expect(wrapper.get('#contacts-heading').classes()).toContain('text-2xl')
    expect(wrapper.get('#warehouses-heading').classes()).toContain('text-2xl')
    expect(
      wrapper.get('section[aria-labelledby="contacts-heading"] > div').classes(),
    ).toContain('justify-between')
    expect(wrapper.get('section[aria-labelledby="warehouses-heading"] > div').classes())
      .toContain('justify-between')
    expect(wrapper.get('section[aria-labelledby="contacts-heading"] dl').classes())
      .toContain('grid-cols-[7fr_6fr_4fr]')
    expect(wrapper.text()).toContain('Thomas Boulund Meng Hansen')
    expect(wrapper.text()).toContain('thomas@eatskarntyden.dk')
    expect(wrapper.get('section[aria-labelledby="contacts-heading"]').text())
      .toContain('thomas@eatskarntyden.dk')
    expect(wrapper.get('section[aria-labelledby="contacts-heading"]').text())
      .toContain('+45 60409598')
    expect(wrapper.text()).not.toContain('Ada Lovelace')
    expect(wrapper.text()).not.toContain('ada@example.dk')
    expect(wrapper.text()).toContain('Lageradresser')
    expect(wrapper.text()).toContain('Industrivej 7')
    expect(wrapper.text()).toContain('6740 Bramming')
    expect(wrapper.text()).toContain('Teatergade 2')
    expect(wrapper.text()).toContain('6700 Esbjerg')
    expect(wrapper.findAll('[aria-label="Foreningens lageradresser"] li')).toHaveLength(2)
    expect(
      wrapper.get('[aria-label="Foreningens lageradresser"] li p').classes(),
    ).toContain('text-lg')
    expect(
      wrapper.get('[aria-label="Foreningens lageradresser"] li > div').classes(),
    ).toContain('flex-1')
    expect(wrapper.findAll('button').some((button) => (
      button.text().includes('Tilføj lager') && !button.attributes('disabled')
    ))).toBe(true)
    expect(wrapper.get('button[aria-label="Log ud"]').classes()).toContain('bg-brand')
    expect(wrapper.findAll('nav button').find((button) => button.text() === 'Lån')
      ?.attributes('disabled')).toBeUndefined()
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/auth/me')
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: { Authorization: expect.stringMatching(/^Bearer /) },
    })
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/associations/current')
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: 'GET',
      headers: { Authorization: 'Bearer current-test-token' },
    })
  })

  it('lists association users and invites users to activate their accounts', async () => {
    sessionStorage.setItem('rekvisit-register.access-token', 'current-test-token')
    const invitedUser = {
      id: '1234567890abcdef12345678',
      firstName: 'Grace',
      lastName: 'Hopper',
      userName: 'grace.hopper',
      email: 'grace@example.dk',
      role: 'propManager',
      status: 'pending',
      createdAt: '2026-11-24T10:00:00.000Z',
    }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(currentUserResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(associationResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        users: [
          {
            ...invitedUser,
            id: 'abcdef1234567890abcdef12',
            firstName: 'Ada',
            lastName: 'Lovelace',
            userName: 'ada.l',
            email: 'ada@example.dk',
            role: 'associationAdmin',
            status: 'active',
          },
          invitedUser,
        ],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        message: 'Invitationen er sendt igen.',
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        message: 'Brugeren er oprettet, og en invitation er sendt.',
        user: invitedUser,
      }), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(AdminView)

    await vi.waitFor(() => expect(wrapper.text()).toContain('Skarntyden'))
    await wrapper.findAll('nav[aria-label="Adminpanel-faner"] button')
      .find((button) => button.text() === 'Brugere')
      ?.trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Ada Lovelace'))
    expect(wrapper.text()).toContain('Aktiv')
    expect(fetchMock.mock.calls[2]?.[0]).toBe('/api/associations/current/users')
    await wrapper.findAll('button')
      .find((button) => button.text() === 'Send invitation igen')
      ?.trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Invitationen er sendt igen.'))
    expect(fetchMock.mock.calls[3]?.[0])
      .toBe(`/api/associations/current/users/${invitedUser.id}/invitation`)

    await wrapper.get('#user-first-name').setValue('Grace')
    await wrapper.get('#user-last-name').setValue('Hopper')
    await wrapper.get('#user-user-name').setValue('grace.hopper')
    await wrapper.get('#user-email').setValue('grace@example.dk')
    await wrapper.get('#user-role').setValue('propManager')
    await wrapper.get('#association-user-form').trigger('submit')

    await vi.waitFor(() => expect(wrapper.text()).toContain('Invitationen er sendt.'))
    expect(wrapper.text()).toContain('Grace Hopper')
    expect(wrapper.text()).toContain('Afventer aktivering')
    expect(fetchMock.mock.calls[4]?.[0]).toBe('/api/associations/current/users')
    expect(fetchMock.mock.calls[4]?.[1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify({
        firstName: 'Grace',
        lastName: 'Hopper',
        userName: 'grace.hopper',
        email: 'grace@example.dk',
        role: 'propManager',
      }),
    })
  })

  it('explains invitation failures without exposing a server response-format error', async () => {
    sessionStorage.setItem('rekvisit-register.access-token', 'current-test-token')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(currentUserResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(associationResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ users: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response('<html>Server error</html>', { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(AdminView)

    await vi.waitFor(() => expect(wrapper.text()).toContain('Skarntyden'))
    await wrapper.findAll('nav[aria-label="Adminpanel-faner"] button')
      .find((button) => button.text() === 'Brugere')
      ?.trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Invitér en bruger'))
    await wrapper.get('#user-first-name').setValue('Grace')
    await wrapper.get('#user-last-name').setValue('Hopper')
    await wrapper.get('#user-user-name').setValue('grace.hopper')
    await wrapper.get('#user-email').setValue('grace@example.dk')
    await wrapper.get('#association-user-form').trigger('submit')

    await vi.waitFor(() => {
      expect(wrapper.get('[role="alert"]').text())
        .toContain('Brugeroprettelsen kunne ikke gennemføres på grund af en teknisk fejl.')
    })
    expect(wrapper.text()).not.toContain('Serveren returnerede et ugyldigt svar.')
  })

  it('loads and searches the association prop list', async () => {
    sessionStorage.setItem('rekvisit-register.access-token', 'current-test-token')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(
        JSON.stringify(currentUserResponse),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify(associationResponse),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify(associationPropsResponse),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(AdminView)

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Kontaktoplysninger')
    })
    expect(wrapper.findAll('nav button').find((button) => button.text() === 'Egne rekvisitter')
      ?.attributes('disabled')).toBeUndefined()
    await wrapper.findAll('button')
      .find((button) => button.text() === 'Egne rekvisitter')
      ?.trigger('click')

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Træstol')
      expect(wrapper.text()).toContain('Læderkuffert')
    })
    const firstProp = wrapper.get('[aria-label="Foreningens rekvisitter"] li')
    expect(firstProp.get('h3').text()).toBe('Træstol')
    expect(firstProp.get('[role="img"]').attributes('aria-label'))
      .toBe('Billedområde for Træstol')
    expect(firstProp.get('[role="img"]').classes()).toContain('h-[120px]')
    expect(firstProp.get('[role="img"]').classes()).toContain('overflow-hidden')
    expect(firstProp.classes()).toContain('hover:border-brand')
    expect(firstProp.classes()).toContain('hover:shadow-md')
    expect(wrapper.get('[aria-label="Foreningens rekvisitter"]').classes())
      .toContain('lg:grid-cols-4')
    expect(firstProp.text()).toContain('Mørk træstol med polstret sæde.')
    expect(firstProp.text()).not.toContain('God stand med lette brugsspor')
    expect(wrapper.get('input[type="search"]').attributes('aria-label'))
      .toBe('Søg i egne rekvisitter')
    await wrapper.get('input[type="search"]').setValue('rejse')
    expect(wrapper.text()).toContain('Læderkuffert')
    expect(wrapper.text()).not.toContain('Træstol')
    expect(wrapper.text()).toContain('1 af 2 rekvisitter')
    expect(fetchMock.mock.calls[2]?.[0]).toBe('/api/associations/current/props')
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({
      headers: { Authorization: 'Bearer current-test-token' },
    })
  })

  it('opens the prop creation form from the overview', async () => {
    sessionStorage.setItem('rekvisit-register.access-token', 'current-test-token')
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(currentUserResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(associationResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ props: [] }), { status: 200 })))
    const wrapper = mount(AdminView)
    await vi.waitFor(() => expect(wrapper.text()).toContain('Kontaktoplysninger'))
    await wrapper.findAll('button').find((button) => button.text() === 'Egne rekvisitter')?.trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Tilføj rekvisit'))
    await wrapper.findAll('button').find((button) => button.text() === 'Tilføj rekvisit')?.trigger('click')
    expect(routerPush).toHaveBeenCalledWith({ name: 'admin-prop-create' })
  })

  it('creates a prop and opens its detail page', async () => {
    sessionStorage.setItem('rekvisit-register.access-token', 'current-test-token')
    const createdProp = associationPropsResponse.props[0]
    if (!createdProp) throw new Error('Testrekvisit mangler.')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(currentUserResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(associationResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ prop: createdProp }), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(PropDetailView, { props: { mode: 'create' } })
    await vi.waitFor(() => expect(wrapper.find('#prop-name').exists()).toBe(true))
    expect(wrapper.get('label[for="prop-create-images"]').text()).toBe('Tilføj billeder')
    expect(wrapper.find('#prop-image-upload').exists()).toBe(false)
    await wrapper.get('#prop-name').setValue('Træstol')
    await wrapper.get('#prop-description').setValue(createdProp.description)
    await wrapper.get('input[aria-label="Højde"]').setValue('90')
    await wrapper.get('input[aria-label="Bredde"]').setValue('45')
    await wrapper.get('input[aria-label="Dybde"]').setValue('45')
    await wrapper.get('#prop-storage-location').setValue(createdProp.storageLocationId)
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(routerPush).toHaveBeenCalledWith({
      name: 'admin-prop-detail',
      params: { propId: createdProp.id },
    }))
    expect(fetchMock.mock.calls[2]?.[0]).toBe('/api/associations/current/props')
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify({
        name: 'Træstol',
        description: createdProp.description,
        storageLocationId: createdProp.storageLocationId,
        availability: true,
        dimensions: { height: 90, width: 45, depth: 45, unit: 'cm' },
        quantity: 1, colour: '', placement: '', tags: [], condition: '', historicalPeriod: '',
      }),
    })
  })

  it('allows prop managers to create a prop', async () => {
    sessionStorage.setItem('rekvisit-register.access-token', 'current-test-token')
    const createdProp = associationPropsResponse.props[0]
    if (!createdProp) throw new Error('Testrekvisit mangler.')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        user: { ...currentUserResponse.user, role: 'propManager' },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(associationResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ prop: createdProp }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        message: 'Reservationen er oprettet.',
        reservation: {
          id: '222222222222222222222222',
          propId: createdProp.id,
          startDate: '2026-12-10',
          endDate: '2026-12-12',
          createdAt: '2026-11-24T10:00:00.000Z',
        },
      }), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(PropDetailView, { props: { mode: 'create' } })

    await vi.waitFor(() => expect(wrapper.find('#prop-name').exists()).toBe(true))
    await wrapper.get('#prop-name').setValue('Træstol')
    await wrapper.get('#prop-description').setValue(createdProp.description)
    await wrapper.get('input[aria-label="Højde"]').setValue('90')
    await wrapper.get('input[aria-label="Bredde"]').setValue('45')
    await wrapper.get('input[aria-label="Dybde"]').setValue('45')
    await wrapper.get('#prop-storage-location').setValue(createdProp.storageLocationId)
    await wrapper.get('#reservation-start-date').setValue('2026-12-10')
    await wrapper.get('#reservation-end-date').setValue('2026-12-12')
    await wrapper.get('form').trigger('submit')

    await vi.waitFor(() => expect(routerPush).toHaveBeenCalledWith({
      name: 'admin-prop-detail',
      params: { propId: createdProp.id },
    }))
    expect(fetchMock.mock.calls[2]?.[0]).toBe('/api/associations/current/props')
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({ method: 'POST' })
    expect(fetchMock.mock.calls[3]?.[0]).toBe(
      `/api/associations/current/props/${createdProp.id}/reservations`,
    )
    expect(fetchMock.mock.calls[3]?.[1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ startDate: '2026-12-10', endDate: '2026-12-12' }),
    })
  })

  it('uploads selected images after creating the prop', async () => {
    sessionStorage.setItem('rekvisit-register.access-token', 'current-test-token')
    const createdProp = associationPropsResponse.props[0]
    if (!createdProp) throw new Error('Testrekvisit mangler.')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(currentUserResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(associationResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ prop: createdProp }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ imageId: '1234567890abcdef12345678' }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ imageId: 'abcdef123456789012345678' }), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(PropDetailView, { props: { mode: 'create' } })
    await vi.waitFor(() => expect(wrapper.find('#prop-create-images').exists()).toBe(true))
    const input = wrapper.get<HTMLInputElement>('#prop-create-images')
    const files = [
      new File(['first'], 'first.png', { type: 'image/png' }),
      new File(['second'], 'second.jpg', { type: 'image/jpeg' }),
    ]
    Object.defineProperty(input.element, 'files', { configurable: true, value: files })
    await input.trigger('change')
    expect(wrapper.get('[aria-label="Valgte billeder"]').text()).toContain('first.png')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(routerPush).toHaveBeenCalledWith({
      name: 'admin-prop-detail', params: { propId: createdProp.id },
    }))
    expect(fetchMock.mock.calls[3]?.[0]).toBe(`/api/associations/current/props/${createdProp.id}/images`)
    expect(fetchMock.mock.calls[3]?.[1]).toMatchObject({ method: 'POST', body: files[0] })
    expect(fetchMock.mock.calls[4]?.[1]).toMatchObject({ method: 'POST', body: files[1] })
  })

  it('shows failed image upload without creating a duplicate prop', async () => {
    sessionStorage.setItem('rekvisit-register.access-token', 'current-test-token')
    const createdProp = associationPropsResponse.props[0]
    if (!createdProp) throw new Error('Testrekvisit mangler.')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(currentUserResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(associationResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ prop: createdProp }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ imageId: '1234567890abcdef12345678' }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Ugyldigt billede.' }), { status: 400 }))
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(PropDetailView, { props: { mode: 'create' } })
    await vi.waitFor(() => expect(wrapper.find('#prop-create-images').exists()).toBe(true))
    const input = wrapper.get<HTMLInputElement>('#prop-create-images')
    Object.defineProperty(input.element, 'files', {
      configurable: true,
      value: [
        new File(['ok'], 'good.png', { type: 'image/png' }),
        new File(['bad'], 'bad.png', { type: 'image/png' }),
      ],
    })
    await input.trigger('change')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.get('[role="alert"]').text()).toContain('Rekvisitten er oprettet'))
    expect(wrapper.get('[role="alert"]').text()).toContain('bad.png')
    expect(wrapper.get('[role="alert"]').text()).toContain('1 af 2 billeder blev bekræftet')
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    await wrapper.get('form').trigger('submit')
    expect(fetchMock).toHaveBeenCalledTimes(5)
    await wrapper.findAll('button').find((button) => button.text() === 'Åbn den oprettede rekvisit')?.trigger('click')
    expect(routerPush).toHaveBeenCalledWith({ name: 'admin-prop-detail', params: { propId: createdProp.id } })
  })

  it('validates and removes selected images before creating a prop', async () => {
    sessionStorage.setItem('rekvisit-register.access-token', 'current-test-token')
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(currentUserResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(associationResponse), { status: 200 })))
    const wrapper = mount(PropDetailView, { props: { mode: 'create' } })
    await vi.waitFor(() => expect(wrapper.find('#prop-create-images').exists()).toBe(true))
    const input = wrapper.get<HTMLInputElement>('#prop-create-images')
    const choose = async (files: File[]) => {
      Object.defineProperty(input.element, 'files', { configurable: true, value: files })
      await input.trigger('change')
    }
    await choose([new File(['bad'], 'bad.svg', { type: 'image/svg+xml' })])
    expect(wrapper.get('[role="alert"]').text()).toContain('JPEG, PNG eller WebP')
    await choose([new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' })])
    expect(wrapper.get('[role="alert"]').text()).toContain('5 MB')
    await choose(Array.from({ length: 11 }, (_, i) => new File(['x'], `${i}.png`, { type: 'image/png' })))
    expect(wrapper.get('[role="alert"]').text()).toContain('højst have 10')
    await choose([new File(['x'], 'valid.png', { type: 'image/png' })])
    expect(wrapper.get('[aria-label="Valgte billeder"]').text()).toContain('valid.png')
    await wrapper.get('button[aria-label="Fjern valid.png"]').trigger('click')
    expect(wrapper.find('[aria-label="Valgte billeder"]').exists()).toBe(false)
  })

  it('shows creation errors and allows cancelling', async () => {
    sessionStorage.setItem('rekvisit-register.access-token', 'current-test-token')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(currentUserResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(associationResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Ugyldige oplysninger.' }), { status: 400 }))
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(PropDetailView, { props: { mode: 'create' } })
    await vi.waitFor(() => expect(wrapper.find('#prop-name').exists()).toBe(true))
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.get('[role="alert"]').text()).toBe('Ugyldige oplysninger.'))
    await wrapper.findAll('button').find((button) => button.text() === 'Annullér')?.trigger('click')
    expect(routerPush).toHaveBeenCalledWith({ name: 'admin', query: { tab: 'props', q: 'stol' } })
  })

  it('explains that a warehouse is needed before creating a prop', async () => {
    sessionStorage.setItem('rekvisit-register.access-token', 'current-test-token')
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(currentUserResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        association: { ...associationResponse.association, storageLocations: [] },
      }), { status: 200 })))
    const wrapper = mount(PropDetailView, { props: { mode: 'create' } })
    await vi.waitFor(() => expect(wrapper.find('#prop-name').exists()).toBe(true))
    expect(wrapper.get('[role="alert"]').text()).toContain('Tilføj først en lageradresse')
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
  })

  it('navigates from a prop card to its detail view', async () => {
    sessionStorage.setItem('rekvisit-register.access-token', 'current-test-token')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(
        JSON.stringify(currentUserResponse),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify(associationResponse),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify(associationPropsResponse),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(AdminView)

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Kontaktoplysninger')
    })
    await wrapper.findAll('button')
      .find((button) => button.text() === 'Egne rekvisitter')
      ?.trigger('click')
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Træstol')
    })
    await wrapper.get('button[aria-label="Åbn rekvisit Træstol"]').trigger('click')

    expect(routerPush).toHaveBeenCalledWith({
      name: 'admin-prop-detail',
      params: { propId: '6b002a5c3c49f74ff7188de8' },
    })
  })

  it('shows complete prop details and returns to the searched prop list', async () => {
    sessionStorage.setItem('rekvisit-register.access-token', 'current-test-token')
    routeState.query.q = 'stol'
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(
        JSON.stringify(currentUserResponse),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify(associationResponse),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify(associationPropsResponse),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(PropDetailView)

    await vi.waitFor(() => {
      expect(wrapper.get('#prop-detail-heading').text()).toBe('Træstol')
    })
    expect(wrapper.text()).toContain('Adminpanel')
    expect(wrapper.get('nav[aria-label="Adminpanel-faner"]').text()).toContain('Egne rekvisitter')
    expect(wrapper.findAll('#prop-detail-heading')).toHaveLength(1)
    expect(wrapper.text()).toContain('Mørk træstol med polstret sæde.')
    expect(wrapper.text()).toContain('God stand med lette brugsspor')
    expect(wrapper.text()).toContain('90 × 45 × 45 cm')
    expect(wrapper.text()).toContain('Industrivej 7, 6740 Bramming')
    expect(wrapper.text()).toContain('Reol 3')
    expect(wrapper.text()).toContain('stol')
    expect(wrapper.findAll('button').some((button) => button.text() === 'Slet rekvisit')).toBe(true)
    expect(wrapper.get('[role="img"]').attributes('aria-label'))
      .toBe('Billedområde for Træstol')

    await wrapper.findAll('nav button')
      .find((button) => button.text() === 'Lån')
      ?.trigger('click')
    expect(routerPush).toHaveBeenCalledWith({ name: 'admin', query: { tab: 'loans' } })

    await wrapper.findAll('button')
      .find((button) => button.text().includes('Tilbage til egne rekvisitter'))
      ?.trigger('click')
    expect(routerPush).toHaveBeenCalledWith({
      name: 'admin',
      query: { tab: 'props', q: 'stol' },
    })
  })

  it('lets prop managers edit and delete props but not manage association details', async () => {
    sessionStorage.setItem('rekvisit-register.access-token', 'current-test-token')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        user: { ...currentUserResponse.user, role: 'propManager' },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify(associationResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(associationPropsResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ reservations: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        message: 'Rekvisitten er opdateret.',
        prop: { ...associationPropsResponse.props[0], name: 'Manager-updated prop' },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ message: 'Rekvisitten er slettet.' }),
        { status: 200 },
      ))
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(PropDetailView)

    await vi.waitFor(() => {
      expect(wrapper.get('#prop-detail-heading').text()).toBe('Træstol')
    })
    expect(wrapper.findAll('button').some((button) => button.text() === 'Redigér')).toBe(true)
    expect(wrapper.get('nav[aria-label="Adminpanel-faner"]').text()).toContain('Egne rekvisitter')
    expect(wrapper.get('nav[aria-label="Adminpanel-faner"]').text()).not.toContain('Generelt')

    await wrapper.findAll('button')
      .find((button) => button.text() === 'Redigér')
      ?.trigger('click')
    expect(wrapper.get('form').text()).toContain('Redigér rekvisit')
    expect(wrapper.find('#prop-image-upload').exists()).toBe(true)
    await wrapper.get('#prop-name').setValue('Manager-updated prop')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => {
      expect(wrapper.get('#prop-detail-heading').text()).toBe('Manager-updated prop')
    })
    expect(fetchMock.mock.calls[4]?.[1]).toMatchObject({ method: 'PATCH' })

    const deleteButton = wrapper.findAll('button')
      .find((button) => button.text() === 'Slet rekvisit')
    expect(deleteButton).toBeDefined()
    await deleteButton?.trigger('click')
    expect(wrapper.get('[role="dialog"]').text())
      .toContain('Er du sikker på, at du vil slette rekvisitten "Manager-updated prop"?')
    expect(fetchMock).toHaveBeenCalledTimes(5)

    await wrapper.findAll('[role="dialog"] button')
      .find((button) => button.text() === 'Slet rekvisit')
      ?.trigger('click')
    await vi.waitFor(() => {
      expect(routerPush).toHaveBeenCalledWith({
        name: 'admin',
        query: { tab: 'props', q: 'stol' },
      })
    })
    expect(fetchMock.mock.calls[5]?.[0]).toBe(
      '/api/associations/current/props/6b002a5c3c49f74ff7188de8',
    )
    expect(fetchMock.mock.calls[5]?.[1]).toMatchObject({ method: 'DELETE' })
  })

  it('lets prop managers add and remove reservation periods while editing', async () => {
    sessionStorage.setItem('rekvisit-register.access-token', 'current-test-token')
    const existingReservation = {
      id: '111111111111111111111111',
      propId: associationPropsResponse.props[0]?.id,
      startDate: '2026-12-01',
      endDate: '2026-12-02',
      createdAt: '2026-11-24T10:00:00.000Z',
    }
    const newReservation = {
      id: '222222222222222222222222',
      propId: associationPropsResponse.props[0]?.id,
      startDate: '2026-12-10',
      endDate: '2026-12-12',
      createdAt: '2026-11-24T10:00:00.000Z',
    }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        user: { ...currentUserResponse.user, role: 'propManager' },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(associationResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(associationPropsResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        reservations: [existingReservation],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        message: 'Rekvisitten er opdateret.',
        prop: associationPropsResponse.props[0],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        message: 'Reservationen er oprettet.',
        reservation: newReservation,
      }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        message: 'Reservationen er fjernet.',
      }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(PropDetailView)

    await vi.waitFor(() => {
      expect(wrapper.get('#prop-detail-heading').text()).toBe('Træstol')
      expect(wrapper.get('[aria-label="Reservationer for rekvisitten"]').text())
        .toContain('1. december 2026')
    })
    await wrapper.findAll('button')
      .find((button) => button.text() === 'Redigér')
      ?.trigger('click')
    await wrapper.get('#reservation-start-date').setValue('2026-12-10')
    await wrapper.get('#reservation-end-date').setValue('2026-12-12')
    await wrapper.get('form').trigger('submit')

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Rekvisitten er opdateret, og reservationen er oprettet.')
      expect(wrapper.get('[aria-label="Reservationer for rekvisitten"]').text())
        .toContain('10. december 2026')
    })
    expect(fetchMock.mock.calls[5]?.[0]).toBe(
      '/api/associations/current/props/6b002a5c3c49f74ff7188de8/reservations',
    )
    expect(fetchMock.mock.calls[5]?.[1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ startDate: '2026-12-10', endDate: '2026-12-12' }),
    })

    await wrapper.findAll('[aria-label="Reservationer for rekvisitten"] button')[0]?.trigger('click')
    await vi.waitFor(() => {
      expect(wrapper.findAll('[aria-label="Reservationer for rekvisitten"] li')).toHaveLength(1)
    })
    expect(fetchMock.mock.calls[6]?.[0]).toBe(
      '/api/associations/current/props/6b002a5c3c49f74ff7188de8/reservations/111111111111111111111111',
    )
    expect(fetchMock.mock.calls[6]?.[1]).toMatchObject({ method: 'DELETE' })
  })

  it('lets an association admin edit and save a prop', async () => {
    sessionStorage.setItem('rekvisit-register.access-token', 'current-test-token')
    const updatedProp = {
      ...associationPropsResponse.props[0],
      name: 'Træstol restaureret',
      description: 'Nyligt restaureret træstol.',
      tags: ['stol', 'restaureret'],
    }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(
        JSON.stringify(currentUserResponse),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify(associationResponse),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify(associationPropsResponse),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ reservations: [] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ message: 'Rekvisitten er opdateret.', prop: updatedProp }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(PropDetailView)

    await vi.waitFor(() => {
      expect(wrapper.get('#prop-detail-heading').text()).toBe('Træstol')
    })
    await wrapper.findAll('button')
      .find((button) => button.text() === 'Redigér')
      ?.trigger('click')
    await wrapper.get('#prop-name').setValue('Træstol restaureret')
    await wrapper.get('#prop-description').setValue('Nyligt restaureret træstol.')
    await wrapper.get('#prop-tags').setValue('stol, restaureret')
    await wrapper.get('form').trigger('submit')

    await vi.waitFor(() => {
      expect(wrapper.get('#prop-detail-heading').text()).toBe('Træstol restaureret')
      expect(wrapper.text()).toContain('Rekvisitten er opdateret.')
    })
    expect(fetchMock.mock.calls[4]?.[0]).toBe(
      '/api/associations/current/props/6b002a5c3c49f74ff7188de8',
    )
    expect(fetchMock.mock.calls[4]?.[1]).toMatchObject({
      method: 'PATCH',
      body: JSON.stringify({
        name: 'Træstol restaureret',
        description: 'Nyligt restaureret træstol.',
        storageLocationId: '6afebf6344bf850bfc30a250',
        availability: true,
        dimensions: { height: 90, width: 45, depth: 45, unit: 'cm' },
        quantity: 1,
        colour: 'Mørkebrun',
        placement: 'Reol 3',
        tags: ['stol', 'restaureret'],
        condition: 'God stand med lette brugsspor',
        historicalPeriod: '1920’erne',
      }),
    })
  })

  it('uploads and removes a prop image and rejects unsupported files', async () => {
    sessionStorage.setItem('rekvisit-register.access-token', 'current-test-token')
    const imageId = '1234567890abcdef12345678'
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(currentUserResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(associationResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(associationPropsResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ reservations: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ imageId }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Billedet er fjernet.' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(PropDetailView, { global: { stubs: { PropImage: true } } })
    await vi.waitFor(() => expect(wrapper.find('#prop-detail-heading').text()).toBe('Træstol'))
    expect(wrapper.find('#prop-image-upload').exists()).toBe(false)
    await wrapper.findAll('button')
      .find((button) => button.text() === 'Redigér')
      ?.trigger('click')
    expect(wrapper.get('form').text()).toContain('Redigér rekvisit')
    expect(wrapper.get('label[for="prop-image-upload"]').text()).toBe('Tilføj billede')
    expect(wrapper.get('#prop-image-help').text()).toContain('Billeder gemmes straks')

    const input = wrapper.get<HTMLInputElement>('#prop-image-upload')
    Object.defineProperty(input.element, 'files', {
      configurable: true,
      value: [new File(['test'], 'image.svg', { type: 'image/svg+xml' })],
    })
    await input.trigger('change')
    expect(wrapper.text()).toContain('Vælg et billede i JPEG, PNG eller WebP.')
    expect(fetchMock).toHaveBeenCalledTimes(4)

    Object.defineProperty(input.element, 'files', {
      configurable: true,
      value: [new File(['image'], 'image.png', { type: 'image/png' })],
    })
    await input.trigger('change')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Billedet er tilføjet.'))
    expect(fetchMock.mock.calls[4]?.[0]).toBe(
      '/api/associations/current/props/6b002a5c3c49f74ff7188de8/images',
    )
    expect(fetchMock.mock.calls[4]?.[1]).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'image/png' },
    })
    expect(wrapper.find('form').exists()).toBe(true)
    await wrapper.findAll('button').find((button) => button.text() === 'Annullér')?.trigger('click')
    expect(wrapper.find('prop-image-stub').exists()).toBe(true)
    expect(wrapper.find('#prop-image-upload').exists()).toBe(false)
    expect(wrapper.findAll('button').some((button) => button.text() === 'Fjern billede')).toBe(false)
    await wrapper.findAll('button').find((button) => button.text() === 'Redigér')?.trigger('click')
    await wrapper.findAll('button').find((button) => button.text() === 'Fjern billede')?.trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Billedet er fjernet.'))
    expect(fetchMock.mock.calls[5]?.[0]).toBe(
      `/api/associations/current/props/6b002a5c3c49f74ff7188de8/images/${imageId}`,
    )
  })

  it('displays the first prop image and allows browsing the gallery', async () => {
    sessionStorage.setItem('rekvisit-register.access-token', 'current-test-token')
    const imageIds = ['1234567890abcdef12345678', 'abcdef123456789012345678']
    const propsWithImages = {
      props: [{ ...associationPropsResponse.props[0], imageIds }],
    }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(currentUserResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(associationResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(propsWithImages), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ reservations: [] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(PropDetailView, { global: { stubs: { PropImage: true } } })
    await vi.waitFor(() => expect(wrapper.find('prop-image-stub').exists()).toBe(true))
    expect(wrapper.getComponent(PropImage).props('imageId')).toBe(imageIds[0])
    expect(wrapper.text()).toContain('1 / 2')
    await wrapper.findAll('button').find((button) => button.text() === 'Næste')?.trigger('click')
    expect(wrapper.getComponent(PropImage).props('imageId')).toBe(imageIds[1])
    expect(wrapper.text()).toContain('2 / 2')
  })

  it('navigates from a prop card to its detail view', async () => {
    sessionStorage.setItem('rekvisit-register.access-token', 'current-test-token')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(
        JSON.stringify(currentUserResponse),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify(associationResponse),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify(associationPropsResponse),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ reservations: [] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(AdminView)

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Kontaktoplysninger')
    })
    await wrapper.findAll('button')
      .find((button) => button.text() === 'Egne rekvisitter')
      ?.trigger('click')
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Træstol')
    })
    await wrapper.get('button[aria-label="Åbn rekvisit Træstol"]').trigger('click')

    expect(routerPush).toHaveBeenCalledWith({
      name: 'admin-prop-detail',
      params: { propId: '6b002a5c3c49f74ff7188de8' },
    })
  })

  it('shows complete prop details and returns to the searched prop list', async () => {
    sessionStorage.setItem('rekvisit-register.access-token', 'current-test-token')
    routeState.query.q = 'stol'
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(
        JSON.stringify(currentUserResponse),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify(associationResponse),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify(associationPropsResponse),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(PropDetailView)

    await vi.waitFor(() => {
      expect(wrapper.get('#prop-detail-heading').text()).toBe('Træstol')
    })
    expect(wrapper.text()).toContain('Adminpanel')
    expect(wrapper.get('nav[aria-label="Adminpanel-faner"]').text()).toContain('Egne rekvisitter')
    expect(wrapper.findAll('#prop-detail-heading')).toHaveLength(1)
    expect(wrapper.text()).toContain('Mørk træstol med polstret sæde.')
    expect(wrapper.text()).toContain('God stand med lette brugsspor')
    expect(wrapper.text()).toContain('90 × 45 × 45 cm')
    expect(wrapper.text()).toContain('Industrivej 7, 6740 Bramming')
    expect(wrapper.text()).toContain('Reol 3')
    expect(wrapper.text()).toContain('stol')
    expect(wrapper.get('[role="img"]').attributes('aria-label'))
      .toBe('Billedområde for Træstol')

    await wrapper.findAll('button')
      .find((button) => button.text().includes('Tilbage til egne rekvisitter'))
      ?.trigger('click')
    expect(routerPush).toHaveBeenCalledWith({
      name: 'admin',
      query: { tab: 'props', q: 'stol' },
    })
  })

  it('shows a styled deletion dialog that can be cancelled or confirmed', async () => {
    sessionStorage.setItem('rekvisit-register.access-token', 'current-test-token')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(currentUserResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(associationResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(associationPropsResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ reservations: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ message: 'Rekvisitten er slettet.' }),
        { status: 200 },
      ))
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(PropDetailView)

    await vi.waitFor(() => {
      expect(wrapper.get('#prop-detail-heading').text()).toBe('Træstol')
    })
    const openButton = wrapper.findAll('button')
      .find((button) => button.text() === 'Slet rekvisit')
    await openButton?.trigger('click')

    const dialog = wrapper.get('[role="dialog"]')
    expect(dialog.attributes('aria-modal')).toBe('true')
    expect(dialog.text()).toContain('Er du sikker på, at du vil slette rekvisitten "Træstol"?')
    expect(dialog.text()).toContain('Det kan ikke fortrydes.')
    expect(fetchMock).toHaveBeenCalledTimes(4)

    await dialog.get('button').trigger('click')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(4)

    await openButton?.trigger('click')
    await wrapper.findAll('[role="dialog"] button')
      .find((button) => button.text() === 'Slet rekvisit')
      ?.trigger('click')
    await vi.waitFor(() => {
      expect(routerPush).toHaveBeenCalledWith({
        name: 'admin',
        query: { tab: 'props', q: 'stol' },
      })
    })
    expect(fetchMock.mock.calls[4]?.[1]).toMatchObject({ method: 'DELETE' })
  })

  it('lets an association admin add a warehouse address', async () => {
    sessionStorage.setItem('rekvisit-register.access-token', 'current-test-token')
    const newLocation = {
      id: '6afebf6344bf850bfc30a252',
      address: 'Havnevej 9',
      postalCode: '8000',
      city: 'Aarhus',
    }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(
        JSON.stringify(currentUserResponse),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify(associationResponse),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({
          message: 'Lageradressen er tilføjet.',
          association: {
            ...associationResponse.association,
            storageLocations: [...associationResponse.association.storageLocations, newLocation],
          },
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      ))
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(AdminView)

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Thomas Boulund Meng Hansen')
    })
    await wrapper.findAll('button')
      .find((button) => button.text().includes('Tilføj lager'))
      ?.trigger('click')
    await wrapper.get('input[name="address"]').setValue('Havnevej 9')
    await wrapper.get('input[name="postalCode"]').setValue('8000')
    await wrapper.get('input[name="city"]').setValue('Aarhus')
    await wrapper.get('#storage-location-form').trigger('submit')

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Lageradressen er tilføjet.')
      expect(wrapper.text()).toContain('Havnevej 9')
    })
    expect(fetchMock.mock.calls[2]?.[0]).toBe('/api/associations/current/storage-locations')
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({
      method: 'POST',
      headers: {
        Authorization: 'Bearer current-test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        address: 'Havnevej 9',
        postalCode: '8000',
        city: 'Aarhus',
      }),
    })
  })

  it('lets an association admin edit a warehouse address', async () => {
    sessionStorage.setItem('rekvisit-register.access-token', 'current-test-token')
    const updatedAssociation = {
      ...associationResponse.association,
      storageLocations: [
        {
          ...associationResponse.association.storageLocations[0],
          address: 'Industrivej 9',
        },
        associationResponse.association.storageLocations[1],
      ],
    }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(
        JSON.stringify(currentUserResponse),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify(associationResponse),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({
          message: 'Lageradressen er opdateret.',
          association: updatedAssociation,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(AdminView)

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Industrivej 7')
    })
    const firstLocation = wrapper.get('[aria-label="Foreningens lageradresser"] li')
    expect(firstLocation.get('button').classes()).toContain('text-brand')
    expect(firstLocation.get('button').classes()).toContain('underline')
    expect(firstLocation.get('button').classes()).toContain('cursor-pointer')
    expect(firstLocation.get('button:last-child').classes()).toContain('text-brand')
    expect(firstLocation.get('button:last-child').classes()).toContain('underline')
    expect(firstLocation.get('button:last-child').classes()).toContain('cursor-pointer')
    await firstLocation.get('button').trigger('click')
    await firstLocation.get('input[name="editAddress"]').setValue('Industrivej 9')
    await firstLocation.get('form').trigger('submit')

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Lageradressen er opdateret.')
      expect(wrapper.text()).toContain('Industrivej 9')
    })
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      '/api/associations/current/storage-locations/6afebf6344bf850bfc30a250',
    )
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer current-test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        address: 'Industrivej 9',
        postalCode: '6740',
        city: 'Bramming',
      }),
    })
  })

  it('asks before removing a warehouse address and updates the list', async () => {
    sessionStorage.setItem('rekvisit-register.access-token', 'current-test-token')
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))
    const updatedAssociation = {
      ...associationResponse.association,
      storageLocations: [associationResponse.association.storageLocations[1]],
    }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(
        JSON.stringify(currentUserResponse),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify(associationResponse),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({
          message: 'Lageradressen er fjernet.',
          association: updatedAssociation,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(AdminView)

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Industrivej 7')
    })
    const firstLocation = wrapper.get('[aria-label="Foreningens lageradresser"] li')
    await firstLocation.get('button:last-child').trigger('click')

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Lageradressen er fjernet.')
      expect(wrapper.text()).not.toContain('Industrivej 7')
    })
    expect(window.confirm).toHaveBeenCalledWith(
      'Er du sikker på, at du vil fjerne denne lageradresse?',
    )
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      '/api/associations/current/storage-locations/6afebf6344bf850bfc30a250',
    )
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({
      method: 'DELETE',
      headers: { Authorization: 'Bearer current-test-token' },
    })
  })

  it('lets an association admin edit the association and its general contact person', async () => {
    sessionStorage.setItem('rekvisit-register.access-token', 'current-test-token')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(
        JSON.stringify(currentUserResponse),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify(associationResponse),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({
          association: {
            name: 'Skarntyden Theatre',
            contactPerson: {
              name: 'Updated Contact',
              email: 'updated@example.dk',
              phone: '+45 12345678',
            },
            storageLocations: associationResponse.association.storageLocations,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(AdminView)

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Thomas Boulund Meng Hansen')
    })
    expect(
      wrapper.get('section[aria-labelledby="contacts-heading"] button').classes(),
    ).toContain('underline')
    await wrapper.get('section[aria-labelledby="contacts-heading"] button').trigger('click')
    await wrapper.get('input[name="associationName"]').setValue('Skarntyden Theatre')
    await wrapper.get('input[name="contactName"]').setValue('Updated Contact')
    await wrapper.get('input[name="contactEmail"]').setValue('updated@example.dk')
    await wrapper.get('input[name="contactPhone"]').setValue('+45 12345678')
    await wrapper.get('#association-info-form').trigger('submit')

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Foreningens oplysninger er opdateret.')
    })
    expect(fetchMock.mock.calls[2]?.[0]).toBe('/api/associations/current')
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer current-test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Skarntyden Theatre',
        contactPerson: {
          name: 'Updated Contact',
          email: 'updated@example.dk',
          phone: '+45 12345678',
        },
      }),
    })
    expect(wrapper.text()).toContain('Updated Contact')
  })

  it('lets prop managers access and create from only the props overview', async () => {
    sessionStorage.setItem('rekvisit-register.access-token', 'current-test-token')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        user: { ...currentUserResponse.user, role: 'propManager' },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify(associationResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(associationPropsResponse), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(AdminView)

    await vi.waitFor(() => {
      expect(wrapper.get('#props-heading').text()).toBe('Egne rekvisitter')
    })
    expect(wrapper.get('h1').text()).toBe('Rekvisitoversigt')
    expect(wrapper.find('#contacts-heading').exists()).toBe(false)
    expect(wrapper.findAll('nav button').some((button) => button.text() === 'Lån')).toBe(false)
    expect(wrapper.findAll('button').some((button) => button.text() === 'Tilføj rekvisit')).toBe(true)
    expect(wrapper.text()).toContain('Træstol')
    await wrapper.findAll('button')
      .find((button) => button.text() === 'Tilføj rekvisit')
      ?.trigger('click')
    expect(routerPush).toHaveBeenCalledWith({ name: 'admin-prop-create' })
  })

  it('shows actual loans and lending in separate tabs', async () => {
    sessionStorage.setItem('rekvisit-register.access-token', 'current-test-token')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(currentUserResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(associationResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ loans: [
        { id: 'aaaaaaaaaaaaaaaaaaaaaaaa', type: 'loan', propName: 'Lånt kuffert', associationName: 'Ejerforeningen', startDate: '2026-11-12', endDate: '2026-11-19', status: 'Godkendt' },
        { id: 'bbbbbbbbbbbbbbbbbbbbbbbb', type: 'lending', propName: 'Udlånt radio', associationName: 'Lånerforeningen', startDate: '2026-12-01', endDate: '2026-12-08', status: 'Afventer svar' },
      ] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(AdminView)

    await vi.waitFor(() => expect(wrapper.find('#contacts-heading').exists()).toBe(true))
    const loanTab = wrapper.findAll('nav button').find((button) => button.text() === 'Lån')
    await loanTab?.trigger('click')

    expect(loanTab?.attributes('aria-current')).toBe('page')
    expect(wrapper.get('#loans-heading').text()).toBe('Lån og udlån')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Lånt kuffert'))
    expect(wrapper.text()).not.toContain('forhåndsvisning')
    const subnav = wrapper.get('nav[aria-label="Oversigt over lån og udlån"]')
    const loanButton = subnav.findAll('button').find((button) => button.text() === 'Lån')
    const lendingButton = subnav.findAll('button').find((button) => button.text() === 'Udlån')
    expect(loanButton?.attributes('aria-pressed')).toBe('true')
    expect(wrapper.findAll('tbody tr')).toHaveLength(1)
    expect(wrapper.get('tbody').text()).toContain('Ejerforeningen')
    expect(wrapper.get('tbody').text()).toContain('12. nov. 2026')
    expect(wrapper.get('tbody').text()).toContain('Godkendt')
    expect(wrapper.get('tbody button').attributes('disabled')).toBeUndefined()
    await lendingButton?.trigger('click')
    expect(lendingButton?.attributes('aria-pressed')).toBe('true')
    expect(loanButton?.attributes('aria-pressed')).toBe('false')
    expect(wrapper.findAll('tbody tr')).toHaveLength(1)
    expect(wrapper.get('tbody').text()).toContain('Udlånt radio')
    expect(wrapper.get('tbody').text()).toContain('Lånerforeningen')
    expect(wrapper.get('tbody').text()).not.toContain('Lånt kuffert')
    await loanButton?.trigger('click')
    expect(wrapper.findAll('tbody tr')).toHaveLength(1)
    expect(wrapper.get('tbody').text()).toContain('Lånt kuffert')
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock).toHaveBeenLastCalledWith('/api/associations/current/loans', {
      headers: { Authorization: 'Bearer current-test-token' },
    })
  })

  it('uses the correct status colors in both the overview and details', async () => {
    sessionStorage.setItem('rekvisit-register.access-token', 'current-test-token')
    routeState.query.tab = 'loans'
    const statuses = [
      ['Afventer svar', 'bg-yellow-100', 'text-yellow-800'],
      ['Godkendt', 'bg-green-100', 'text-green-800'],
      ['Afvist', 'bg-red-100', 'text-red-800'],
      ['Afleveret', 'bg-blue-100', 'text-blue-800'],
      ['Annulleret', 'bg-gray-100', 'text-gray-800'],
    ] as const
    const loans = statuses.map(([status], index) => ({
      id: `${index}`.repeat(24), type: 'loan', propName: `Rekvisit ${index}`,
      associationName: 'Ejerforening', startDate: '2026-11-12', endDate: '2026-11-19', status,
    }))
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(currentUserResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(associationResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ loans }), { status: 200 }))
    for (const loan of loans) {
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ loan: { ...loan, borrowerMessage: null } }), { status: 200 }))
    }
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(AdminView)
    await vi.waitFor(() => expect(wrapper.findAll('tbody tr')).toHaveLength(statuses.length))

    for (const [index, [status, background, text]] of statuses.entries()) {
      const row = wrapper.findAll('tbody tr')[index]!
      const badge = row.findAll('span').find((span) => span.text() === status)!
      expect(badge.classes()).toEqual(expect.arrayContaining([background, text]))
      await row.get('button').trigger('click')
      await vi.waitFor(() => expect(wrapper.find('dd span').exists()).toBe(true))
      expect(wrapper.get('dd span').text()).toBe(status)
      expect(wrapper.get('dd span').classes()).toEqual(expect.arrayContaining([background, text]))
      await wrapper.findAll('button').find((button) => button.text().includes('Tilbage til lån'))?.trigger('click')
    }
  })

  it('opens loan details for each direction and returns to the selected tab', async () => {
    sessionStorage.setItem('rekvisit-register.access-token', 'current-test-token')
    const borrowed = { id: 'aaaaaaaaaaaaaaaaaaaaaaaa', type: 'loan', propName: 'Lånt kuffert', associationName: 'Ejerforeningen', startDate: '2026-11-12', endDate: '2026-11-19', status: 'Godkendt' }
    const lent = { id: 'bbbbbbbbbbbbbbbbbbbbbbbb', type: 'lending', propName: 'Udlånt radio', associationName: 'Lånerforeningen', startDate: '2026-12-01', endDate: '2026-12-08', status: 'Afventer svar' }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(currentUserResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(associationResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ loans: [borrowed, lent] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ loan: { ...borrowed, borrowerMessage: 'En besked' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ loan: { ...lent, borrowerMessage: null } }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    routeState.query.tab = 'loans'
    const wrapper = mount(AdminView)
    await vi.waitFor(() => expect(wrapper.find('tbody button').exists()).toBe(true))
    await wrapper.get('tbody button').trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('En besked'))
    expect(wrapper.findAll('button').some((button) => button.text() === 'Godkend')).toBe(false)
    expect(wrapper.get('#loans-heading').text()).toBe('Lånedetaljer')
    expect(wrapper.text()).toContain('Ejerforening')
    expect(wrapper.text()).toContain('Ejerforeningen')
    expect(wrapper.text()).toContain('Godkendt')
    expect(wrapper.text()).toContain('12. nov. 2026')
    expect(fetchMock).toHaveBeenLastCalledWith(`/api/associations/current/loans/${borrowed.id}`, {
      headers: { Authorization: 'Bearer current-test-token' },
    })
    await wrapper.findAll('button').find((button) => button.text().includes('Tilbage til lån'))?.trigger('click')
    await wrapper.get('nav[aria-label="Oversigt over lån og udlån"]').findAll('button')[1]?.trigger('click')
    await wrapper.get('tbody button').trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Ingen besked'))
    expect(wrapper.findAll('button').some((button) => button.text() === 'Godkend')).toBe(true)
    expect(wrapper.findAll('button').some((button) => button.text() === 'Afvis')).toBe(true)
    expect(wrapper.text()).toContain('Lånerforening')
    expect(wrapper.text()).toContain('Lånerforeningen')
    await wrapper.findAll('button').find((button) => button.text().includes('Tilbage til udlån'))?.trigger('click')
    expect(wrapper.get('tbody').text()).toContain('Udlånt radio')
  })

  it.each([
    ['Godkend', 'Godkendt', 'Lånet er godkendt.'],
    ['Afvis', 'Afvist', 'Lånet er afvist.'],
  ] as const)('allows the owner to choose %s and updates the overview', async (action, status, message) => {
    sessionStorage.setItem('rekvisit-register.access-token', 'current-test-token')
    routeState.query.tab = 'loans'
    const loan = { id: 'bbbbbbbbbbbbbbbbbbbbbbbb', type: 'lending', propName: 'Radio', associationName: 'Lånerforening', startDate: '2026-11-12', endDate: '2026-11-19', status: 'Afventer svar' }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(currentUserResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(associationResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ loans: [loan] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ loan: { ...loan, borrowerMessage: null } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(AdminView)
    await vi.waitFor(() => expect(wrapper.text()).toContain('Foreningen har ingen lån.'))
    await wrapper.get('nav[aria-label="Oversigt over lån og udlån"]').findAll('button')[1]?.trigger('click')
    await wrapper.get('tbody button').trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Ingen besked'))
    await wrapper.findAll('button').find((button) => button.text() === action)?.trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain(message))
    expect(fetchMock).toHaveBeenLastCalledWith(`/api/associations/current/loans/${loan.id}`, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer current-test-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    expect(wrapper.findAll('button').some((button) => button.text() === 'Godkend' || button.text() === 'Afvis')).toBe(false)
    await wrapper.findAll('button').find((button) => button.text().includes('Tilbage til udlån'))?.trigger('click')
    expect(wrapper.get('tbody').text()).toContain(status)
  })

  it('displays a decision conflict and reloads the actual status', async () => {
    sessionStorage.setItem('rekvisit-register.access-token', 'current-test-token')
    routeState.query.tab = 'loans'
    const loan = { id: 'bbbbbbbbbbbbbbbbbbbbbbbb', type: 'lending', propName: 'Radio', associationName: 'Låner', startDate: '2026-11-12', endDate: '2026-11-19', status: 'Afventer svar', borrowerMessage: null }
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(currentUserResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(associationResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ loans: [loan] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ loan }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Perioden overlapper en reservation.' }), { status: 409 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ loan: { ...loan, status: 'Afvist' } }), { status: 200 })))
    const wrapper = mount(AdminView)
    await vi.waitFor(() => expect(wrapper.text()).toContain('Foreningen har ingen lån.'))
    await wrapper.get('nav[aria-label="Oversigt over lån og udlån"]').findAll('button')[1]?.trigger('click')
    await wrapper.get('tbody button').trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Ingen besked'))
    await wrapper.findAll('button').find((button) => button.text() === 'Godkend')?.trigger('click')
    await vi.waitFor(() => expect(wrapper.get('[role="alert"]').text()).toContain('Perioden overlapper'))
    expect(wrapper.text()).toContain('Afventer svar')
    await wrapper.findAll('button').find((button) => button.text() === 'Opdatér lånet')?.trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Afvist'))
    expect(wrapper.findAll('button').some((button) => button.text() === 'Godkend')).toBe(false)
    await wrapper.findAll('button').find((button) => button.text().includes('Tilbage til udlån'))?.trigger('click')
    expect(wrapper.get('tbody').text()).toContain('Afvist')
  })

  it('does not offer decisions for a borrower with a pending loan', async () => {
    sessionStorage.setItem('rekvisit-register.access-token', 'current-test-token')
    routeState.query.tab = 'loans'
    const loan = { id: 'aaaaaaaaaaaaaaaaaaaaaaaa', type: 'loan', propName: 'Kuffert', associationName: 'Ejer', startDate: '2026-11-12', endDate: '2026-11-19', status: 'Afventer svar', borrowerMessage: null }
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(currentUserResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(associationResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ loans: [loan] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ loan }), { status: 200 })))
    const wrapper = mount(AdminView)
    await vi.waitFor(() => expect(wrapper.find('tbody button').exists()).toBe(true))
    await wrapper.get('tbody button').trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Ingen besked'))
    expect(wrapper.findAll('button').some((button) => button.text() === 'Godkend' || button.text() === 'Afvis')).toBe(false)
  })

  it('shows detail errors and retries without losing the overview', async () => {
    sessionStorage.setItem('rekvisit-register.access-token', 'current-test-token')
    routeState.query.tab = 'loans'
    const loan = { id: 'aaaaaaaaaaaaaaaaaaaaaaaa', type: 'loan', propName: 'Kuffert', associationName: 'Forening', startDate: '2026-11-12', endDate: '2026-11-19', status: 'Godkendt' }
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(currentUserResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(associationResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ loans: [loan] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Lånet blev ikke fundet.' }), { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ loan: { ...loan, borrowerMessage: 'Hej' } }), { status: 200 })))
    const wrapper = mount(AdminView)
    await vi.waitFor(() => expect(wrapper.find('tbody button').exists()).toBe(true))
    await wrapper.get('tbody button').trigger('click')
    await vi.waitFor(() => expect(wrapper.get('[role="alert"]').text()).toContain('Lånet blev ikke fundet.'))
    await wrapper.findAll('button').find((button) => button.text() === 'Prøv igen')?.trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Hej'))
    await wrapper.findAll('button').find((button) => button.text().includes('Tilbage til lån'))?.trigger('click')
    expect(wrapper.get('tbody').text()).toContain('Kuffert')
  })

  it('rejects invalid loan details and redirects after session expiry', async () => {
    sessionStorage.setItem('rekvisit-register.access-token', 'current-test-token')
    routeState.query.tab = 'loans'
    const loan = { id: 'aaaaaaaaaaaaaaaaaaaaaaaa', type: 'loan', propName: 'Kuffert', associationName: 'Forening', startDate: '2026-11-12', endDate: '2026-11-19', status: 'Godkendt' }
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(currentUserResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(associationResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ loans: [loan] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ loan: { ...loan, borrowerMessage: 123 } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 })))
    const wrapper = mount(AdminView)
    await vi.waitFor(() => expect(wrapper.find('tbody button').exists()).toBe(true))
    await wrapper.get('tbody button').trigger('click')
    await vi.waitFor(() => expect(wrapper.get('[role="alert"]').text()).toContain('Lånet kunne ikke indlæses'))
    await wrapper.findAll('button').find((button) => button.text() === 'Prøv igen')?.trigger('click')
    await vi.waitFor(() => expect(routerReplace).toHaveBeenCalledWith({ name: 'login' }))
    expect(sessionStorage.getItem('rekvisit-register.access-token')).toBeNull()
  })

  it('opens the loans overview through the admin tab query and shows empty states', async () => {
    routeState.query.tab = 'loans'
    sessionStorage.setItem('rekvisit-register.access-token', 'current-test-token')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(currentUserResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(associationResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ loans: [] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(AdminView)

    await vi.waitFor(() => expect(wrapper.find('#loans-heading').exists()).toBe(true))
    await vi.waitFor(() => expect(wrapper.text()).toContain('Foreningen har ingen lån.'))
    await wrapper.get('nav[aria-label="Oversigt over lån og udlån"]').findAll('button')[1]?.trigger('click')
    expect(wrapper.text()).toContain('Foreningen har ingen udlån.')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('shows loan errors and retries without showing examples', async () => {
    routeState.query.tab = 'loans'
    sessionStorage.setItem('rekvisit-register.access-token', 'current-test-token')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(currentUserResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(associationResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'En rekvisit kunne ikke findes.' }), { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ loans: [] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(AdminView)

    await vi.waitFor(() => expect(wrapper.get('[role="alert"]').text()).toContain('En rekvisit kunne ikke findes.'))
    expect(wrapper.text()).not.toContain('Gammel læderkuffert')
    await wrapper.findAll('button').find((button) => button.text() === 'Prøv igen')?.trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Foreningen har ingen lån.'))
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('rejects malformed loan responses and redirects when the session expires', async () => {
    routeState.query.tab = 'loans'
    sessionStorage.setItem('rekvisit-register.access-token', 'current-test-token')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(currentUserResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(associationResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ loans: [{
        id: 'aaaaaaaaaaaaaaaaaaaaaaaa', type: 'loan', propName: 'Kuffert',
        associationName: 'Forening', startDate: '2026-02-30', endDate: '2026-03-01', status: 'Godkendt',
      }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(AdminView)

    await vi.waitFor(() => expect(wrapper.get('[role="alert"]').text()).toContain('kunne ikke indlæses'))
    await wrapper.findAll('button').find((button) => button.text() === 'Prøv igen')?.trigger('click')
    await vi.waitFor(() => expect(routerReplace).toHaveBeenCalledWith({ name: 'login' }))
    expect(sessionStorage.getItem('rekvisit-register.access-token')).toBeNull()
  })

  it('redirects search users away from the props overview', async () => {
    sessionStorage.setItem('rekvisit-register.access-token', 'current-test-token')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({
        user: { ...currentUserResponse.user, role: 'searchUser' },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))
    mount(AdminView)

    await vi.waitFor(() => {
      expect(routerReplace).toHaveBeenCalledWith({ name: 'profile' })
    })
  })
})

describe('ResetPasswordView', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    sessionStorage.clear()
  })

  it('submits the token and matching new password', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ message: 'Adgangskoden er nulstillet. Du kan nu logge ind.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ))
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(ResetPasswordView)

    await wrapper.get('input[name="newPassword"]').setValue('a-new-safe-passphrase')
    await wrapper.get('input[name="repeatPassword"]').setValue('a-new-safe-passphrase')
    await wrapper.get('form').trigger('submit')

    await vi.waitFor(() => {
      expect(wrapper.get('[role="status"]').text()).toContain('Adgangskoden er nulstillet')
    })
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: 'a'.repeat(64),
        newPassword: 'a-new-safe-passphrase',
      }),
    })
  })
})

describe('AcceptInvitationView', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    sessionStorage.clear()
  })

  it('activates an invited account with the one-time token and chosen password', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ message: 'Kontoen er aktiveret. Du kan nu logge ind.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ))
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(AcceptInvitationView)

    await wrapper.get('#invitation-password').setValue('a-new-safe-passphrase')
    await wrapper.get('#invitation-password-repeat').setValue('a-new-safe-passphrase')
    await wrapper.get('form').trigger('submit')

    await vi.waitFor(() => {
      expect(wrapper.get('[role="status"]').text()).toContain('Kontoen er aktiveret')
    })
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/accept-invitation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: 'a'.repeat(64),
        newPassword: 'a-new-safe-passphrase',
      }),
    })
  })
})

describe('ProfileView', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    routerReplace.mockReset()
    sessionStorage.clear()
  })

  it('loads the signed-in user and renders profile information', async () => {
    sessionStorage.setItem('rekvisit-register.access-token', 'current-test-token')
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify(currentUserResponse),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ))
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(ProfileView)

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Ada Lovelace')
    })
    expect(wrapper.text()).toContain('Min profil')
    expect(wrapper.text()).toContain('Personlige oplysninger')
    expect(wrapper.text()).toContain('Adgangskode')
    expect(wrapper.text()).toContain('Forening og rolle')
    expect(wrapper.text()).toContain('Skarntyden')
    expect(wrapper.text()).toContain('Foreningsansvarlig')
    expect(wrapper.get('input[name="email"]').attributes('type')).toBe('email')
    expect(wrapper.get('input[name="email"]').element).toHaveProperty('value', 'ada@example.dk')
    expect(wrapper.findAll('input[autocomplete="new-password"]')).toHaveLength(2)
    expect(wrapper.text()).toContain('Log ud')
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/me', {
      headers: { Authorization: 'Bearer current-test-token' },
    })
  })

  it('updates and saves the email address', async () => {
    sessionStorage.setItem('rekvisit-register.access-token', 'current-test-token')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(
        JSON.stringify(currentUserResponse),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ message: 'E-mailadressen er opdateret.', emailVerified: false }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(ProfileView)

    await vi.waitFor(() => {
      expect(wrapper.get('input[name="email"]').element).toHaveProperty('value', 'ada@example.dk')
    })
    await wrapper.get('input[name="email"]').setValue('new@example.dk')
    await wrapper.get('section[aria-labelledby="personal-heading"] form').trigger('submit')

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('E-mailadressen er opdateret.')
    })
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/auth/profile', {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer current-test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: 'new@example.dk' }),
    })
    expect(wrapper.get('input[name="email"]').element).toHaveProperty('value', 'new@example.dk')
  })

  it('lets an unverified user request a verification email', async () => {
    sessionStorage.setItem('rekvisit-register.access-token', 'current-test-token')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(
        JSON.stringify({
          user: {
            ...currentUserResponse.user,
            emailVerified: false,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ message: 'Bekræftelseslink afsendt.' }),
        { status: 202, headers: { 'Content-Type': 'application/json' } },
      ))
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(ProfileView)

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('E-mailadressen er ikke bekræftet endnu')
    })
    await wrapper.get('button[type="button"]').trigger('click')

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('sender vi et link til din e-mail')
    })
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/auth/email-verification')
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: 'POST' })
  })

  it('only confirms an email after the user clicks the confirmation button', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ message: 'E-mailadressen er bekræftet.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ))
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(VerifyEmailView)

    expect(wrapper.text()).toContain('Bekræft, at denne e-mailadresse tilhører dig.')
    expect(fetchMock).not.toHaveBeenCalled()
    await wrapper.get('button').trigger('click')

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Din e-mailadresse er nu bekræftet.')
    })
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/confirm-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'a'.repeat(64) }),
    })
  })

  it('toggles visibility for the current password', async () => {
    sessionStorage.setItem('rekvisit-register.access-token', 'current-test-token')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify(currentUserResponse),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))
    const wrapper = mount(ProfileView)

    await vi.waitFor(() => {
      expect(wrapper.find('button[aria-label="Vis nuværende adgangskode"]').exists()).toBe(true)
    })
    await wrapper.get('button[aria-label="Vis nuværende adgangskode"]').trigger('click')

    expect(wrapper.get('input[name="currentPassword"]').attributes('type')).toBe('text')
    expect(wrapper.find('button[aria-label="Skjul nuværende adgangskode"]').exists()).toBe(true)
  })

  it('changes the password, clears the fields, and shows confirmation', async () => {
    sessionStorage.setItem('rekvisit-register.access-token', 'current-test-token')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(
        JSON.stringify(currentUserResponse),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ message: 'Adgangskoden er opdateret.' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(ProfileView)

    await vi.waitFor(() => {
      expect(wrapper.find('input[name="currentPassword"]').exists()).toBe(true)
    })
    await wrapper.get('input[name="currentPassword"]').setValue('old-passphrase')
    await wrapper.get('input[name="newPassword"]').setValue('new-passphrase-123')
    await wrapper.get('input[name="repeatPassword"]').setValue('new-passphrase-123')
    await wrapper.get('section[aria-labelledby="password-heading"] form').trigger('submit')

    await vi.waitFor(() => {
      expect(wrapper.get('[role="status"]').text()).toContain('Adgangskoden er opdateret.')
    })
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/auth/password', {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer current-test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        currentPassword: 'old-passphrase',
        newPassword: 'new-passphrase-123',
      }),
    })
    expect(wrapper.get('input[name="currentPassword"]').element).toHaveProperty('value', '')
    expect(wrapper.get('input[name="newPassword"]').element).toHaveProperty('value', '')
    expect(wrapper.get('input[name="repeatPassword"]').element).toHaveProperty('value', '')
  })

  it('rejects mismatched new passwords without calling the backend', async () => {
    sessionStorage.setItem('rekvisit-register.access-token', 'current-test-token')
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify(currentUserResponse),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ))
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(ProfileView)

    await vi.waitFor(() => {
      expect(wrapper.find('input[name="currentPassword"]').exists()).toBe(true)
    })
    await wrapper.get('input[name="currentPassword"]').setValue('old-passphrase')
    await wrapper.get('input[name="newPassword"]').setValue('new-passphrase-123')
    await wrapper.get('input[name="repeatPassword"]').setValue('different-passphrase')
    await wrapper.get('section[aria-labelledby="password-heading"] form').trigger('submit')

    expect(wrapper.get('[role="alert"]').text()).toContain('De nye adgangskoder er ikke ens.')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('clears an invalid session and redirects to login', async () => {
    sessionStorage.setItem('rekvisit-register.access-token', 'expired-token')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: 'Dit login er udløbet.' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )))
    mount(ProfileView)

    await vi.waitFor(() => {
      expect(routerReplace).toHaveBeenCalledWith({ name: 'login' })
    })
    expect(sessionStorage.getItem('rekvisit-register.access-token')).toBeNull()
  })

  it('clears the access token and redirects to login on logout', async () => {
    sessionStorage.setItem('rekvisit-register.access-token', 'current-test-token')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify(currentUserResponse),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))
    const wrapper = mount(ProfileView)

    await vi.waitFor(() => {
      expect(wrapper.find('button[aria-label="Vis nuværende adgangskode"]').exists()).toBe(true)
    })
    await wrapper.get('button[aria-label="Log ud"]').trigger('click')

    expect(sessionStorage.getItem('rekvisit-register.access-token')).toBeNull()
    expect(routerReplace).toHaveBeenCalledWith({ name: 'login' })
  })
})

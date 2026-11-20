import { afterEach, describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import AdminView from '../views/AdminView.vue'
import LoginView from '../views/LoginView.vue'
import ProfileView from '../views/ProfileView.vue'
import ResetPasswordView from '../views/ResetPasswordView.vue'
import VerifyEmailView from '../views/VerifyEmailView.vue'

const { routerPush, routerReplace } = vi.hoisted(() => ({
  routerPush: vi.fn(),
  routerReplace: vi.fn(),
}))

vi.mock('vue-router', () => ({
  RouterLink: { template: '<a><slot /></a>' },
  useRouter: () => ({ push: routerPush, replace: routerReplace }),
  useRoute: () => ({ query: { token: 'a'.repeat(64) } }),
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
    routerReplace.mockReset()
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
    expect(wrapper.find('button:disabled').exists()).toBe(true)
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
    expect(wrapper.find('button[disabled]').text()).not.toContain('Egne rekvisitter')
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

  it('redirects users who are not association admins', async () => {
    sessionStorage.setItem('rekvisit-register.access-token', 'current-test-token')
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({
        user: { ...currentUserResponse.user, role: 'propManager' },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ))
    vi.stubGlobal('fetch', fetchMock)
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

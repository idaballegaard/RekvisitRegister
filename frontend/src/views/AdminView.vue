<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  createAssociationStorageLocation,
  deleteAssociationStorageLocation,
  getCurrentAssociation,
  updateAssociationStorageLocation,
  updateCurrentAssociation,
  type AssociationProfile,
} from '../services/association.service'
import {
  clearAuthSession,
  getCurrentUser,
  UnauthorizedError,
  type CurrentUserProfile,
} from '../services/auth.service'

const router = useRouter()
const profile = ref<CurrentUserProfile | null>(null)
const association = ref<AssociationProfile | null>(null)
const isLoading = ref(true)
const isEditing = ref(false)
const isSaving = ref(false)
const errorMessage = ref('')
const saveErrorMessage = ref('')
const saveSuccessMessage = ref('')
const isAddingLocation = ref(false)
const isSavingLocation = ref(false)
const editingLocationId = ref<string | null>(null)
const isUpdatingLocation = ref(false)
const deletingLocationId = ref<string | null>(null)
const locationErrorMessage = ref('')
const locationSuccessMessage = ref('')
const editForm = reactive({
  name: '',
  contactPersonName: '',
  contactPersonEmail: '',
  contactPersonPhone: '',
})
const locationForm = reactive({
  address: '',
  postalCode: '',
  city: '',
})
const roleNames: Record<CurrentUserProfile['role'], string> = {
  associationAdmin: 'Foreningsansvarlig',
  propManager: 'Rekvisitansvarlig',
  searchUser: 'Søgebruger',
}

async function logout(): Promise<void> {
  clearAuthSession()
  await router.replace({ name: 'login' })
}

function startEditing(): void {
  if (!association.value || profile.value?.role !== 'associationAdmin') {
    return
  }
  editForm.name = association.value.name
  editForm.contactPersonName = association.value.contactPerson?.name ?? ''
  editForm.contactPersonEmail = association.value.contactPerson?.email ?? ''
  editForm.contactPersonPhone = association.value.contactPerson?.phone ?? ''
  saveErrorMessage.value = ''
  saveSuccessMessage.value = ''
  isEditing.value = true
}

function cancelEditing(): void {
  isEditing.value = false
  saveErrorMessage.value = ''
}

async function saveAssociation(): Promise<void> {
  if (profile.value?.role !== 'associationAdmin') {
    return
  }
  saveErrorMessage.value = ''
  saveSuccessMessage.value = ''
  isSaving.value = true
  try {
    association.value = await updateCurrentAssociation({
      name: editForm.name,
      contactPerson: {
        name: editForm.contactPersonName,
        email: editForm.contactPersonEmail,
        phone: editForm.contactPersonPhone,
      },
    })
    isEditing.value = false
    saveSuccessMessage.value = 'Foreningens oplysninger er opdateret.'
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      await router.replace({ name: 'login' })
      return
    }
    saveErrorMessage.value = error instanceof Error
      ? error.message
      : 'Foreningens oplysninger kunne ikke gemmes.'
  } finally {
    isSaving.value = false
  }
}

function startAddingLocation(): void {
  if (profile.value?.role !== 'associationAdmin') {
    return
  }
  locationForm.address = ''
  locationForm.postalCode = ''
  locationForm.city = ''
  locationErrorMessage.value = ''
  locationSuccessMessage.value = ''
  isAddingLocation.value = true
}

function cancelAddingLocation(): void {
  isAddingLocation.value = false
  locationErrorMessage.value = ''
}

function startEditingLocation(locationId: string): void {
  if (profile.value?.role !== 'associationAdmin' || !association.value) {
    return
  }
  const location = association.value.storageLocations.find(({ id }) => id === locationId)
  if (!location) {
    return
  }
  locationForm.address = location.address
  locationForm.postalCode = location.postalCode
  locationForm.city = location.city
  locationErrorMessage.value = ''
  locationSuccessMessage.value = ''
  editingLocationId.value = locationId
}

function cancelEditingLocation(): void {
  editingLocationId.value = null
  locationErrorMessage.value = ''
}

async function saveStorageLocation(): Promise<void> {
  if (profile.value?.role !== 'associationAdmin') {
    return
  }
  locationErrorMessage.value = ''
  locationSuccessMessage.value = ''
  isSavingLocation.value = true
  try {
    association.value = await createAssociationStorageLocation({
      address: locationForm.address,
      postalCode: locationForm.postalCode,
      city: locationForm.city,
    })
    isAddingLocation.value = false
    locationSuccessMessage.value = 'Lageradressen er tilføjet.'
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      await router.replace({ name: 'login' })
      return
    }
    locationErrorMessage.value = error instanceof Error
      ? error.message
      : 'Lageradressen kunne ikke tilføjes.'
  } finally {
    isSavingLocation.value = false
  }
}

async function saveEditedStorageLocation(): Promise<void> {
  const locationId = editingLocationId.value
  if (profile.value?.role !== 'associationAdmin' || !locationId) {
    return
  }
  locationErrorMessage.value = ''
  locationSuccessMessage.value = ''
  isUpdatingLocation.value = true
  try {
    association.value = await updateAssociationStorageLocation(locationId, {
      address: locationForm.address,
      postalCode: locationForm.postalCode,
      city: locationForm.city,
    })
    editingLocationId.value = null
    locationSuccessMessage.value = 'Lageradressen er opdateret.'
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      await router.replace({ name: 'login' })
      return
    }
    locationErrorMessage.value = error instanceof Error
      ? error.message
      : 'Lageradressen kunne ikke opdateres.'
  } finally {
    isUpdatingLocation.value = false
  }
}

async function removeStorageLocation(locationId: string): Promise<void> {
  if (
    profile.value?.role !== 'associationAdmin'
    || !association.value
    || !window.confirm('Er du sikker på, at du vil fjerne denne lageradresse?')
  ) {
    return
  }
  locationErrorMessage.value = ''
  locationSuccessMessage.value = ''
  deletingLocationId.value = locationId
  try {
    association.value = await deleteAssociationStorageLocation(locationId)
    if (editingLocationId.value === locationId) {
      editingLocationId.value = null
    }
    locationSuccessMessage.value = 'Lageradressen er fjernet.'
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      await router.replace({ name: 'login' })
      return
    }
    locationErrorMessage.value = error instanceof Error
      ? error.message
      : 'Lageradressen kunne ikke fjernes.'
  } finally {
    deletingLocationId.value = null
  }
}

onMounted(async () => {
  try {
    const currentUser = await getCurrentUser()
    if (currentUser.role !== 'associationAdmin') {
      await router.replace({ name: 'profile' })
      return
    }
    profile.value = currentUser
    association.value = await getCurrentAssociation()
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      await router.replace({ name: 'login' })
      return
    }
    errorMessage.value = error instanceof Error
      ? error.message
      : 'Adminpanelet kunne ikke hentes.'
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <div class="min-h-screen min-h-[100svh] bg-white font-sans text-gray-dark">
    <main class="px-[4.3%] pt-[27px] pb-8 max-[540px]:px-5 max-[540px]:pt-6">
      <header class="border-b border-[#e2e0e0] pb-[22px]">
        <div class="flex items-start justify-between gap-6">
          <div>
            <p class="mb-1.5 text-[10px] font-bold tracking-[0.16em] text-brand uppercase">
              {{ association?.name ?? profile?.associationName ?? 'Forening' }}
            </p>
            <h1 class="text-2xl leading-[1.2] font-bold">Adminpanel</h1>
            <p class="mt-2 text-sm text-gray-medium">
              Administrér din forenings oplysninger, rekvisitter og lån.
            </p>
          </div>
          <p v-if="profile" class="mt-3 text-xs text-gray-medium max-[540px]:hidden">
            {{ roleNames[profile.role] }}
          </p>
        </div>
        <p v-if="isLoading" class="mt-4 text-xs text-gray-medium" role="status">
          Henter foreningsoplysninger…
        </p>
        <p v-else-if="errorMessage" class="mt-4 text-xs text-brand" role="alert">
          {{ errorMessage }}
        </p>
      </header>

      <nav class="border-b border-[#e2e0e0]" aria-label="Adminpanel-faner">
        <ul class="-mb-px flex flex-wrap gap-8 max-[540px]:gap-6">
          <li>
            <a
              class="inline-flex h-[49px] items-center border-b-2 border-brand px-0.5 text-sm font-bold text-brand"
              href="#generelt"
              aria-current="page"
            >
              Generelt
            </a>
          </li>
          <li>
            <button
              class="h-[49px] cursor-not-allowed px-0.5 text-sm text-gray-medium/60"
              type="button"
              disabled
              title="Denne fane er ikke tilgængelig endnu"
            >
              Egne rekvisitter
            </button>
          </li>
          <li>
            <button
              class="h-[49px] cursor-not-allowed px-0.5 text-sm text-gray-medium/60"
              type="button"
              disabled
              title="Denne fane er ikke tilgængelig endnu"
            >
              Brugere
            </button>
          </li>
          <li>
            <button
              class="h-[49px] cursor-not-allowed px-0.5 text-sm text-gray-medium/60"
              type="button"
              disabled
              title="Denne fane er ikke tilgængelig endnu"
            >
              Lån
            </button>
          </li>
        </ul>
      </nav>

      <div v-if="profile && association" id="generelt">
        <form id="association-info-form" @submit.prevent="saveAssociation">
        <div
          class="grid grid-cols-2 gap-10 border-b border-[#e2e0e0] py-[38px] max-[700px]:grid-cols-1"
        >
          <section aria-labelledby="association-heading">
            <div class="mb-7 flex items-center justify-between gap-4">
              <h2 id="association-heading" class="text-base font-bold text-brand">
                Foreningens oplysninger
              </h2>
              <button
                v-if="profile.role === 'associationAdmin' && !isEditing"
                class="text-sm text-brand underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                @click="startEditing"
              >
                Redigér
              </button>
            </div>
            <dl class="grid grid-cols-2 gap-x-8 gap-y-6 max-[540px]:grid-cols-1">
              <div class="col-span-2 max-[540px]:col-span-1">
                <dt class="mb-1.5 text-xs text-gray-medium">
                  <label for="association-name">Forening</label>
                </dt>
                <dd v-if="!isEditing" class="text-sm">{{ association.name }}</dd>
                <input
                  v-else
                  id="association-name"
                  v-model.trim="editForm.name"
                  class="h-9 w-full rounded border border-gray-light px-2 text-sm focus-visible:outline-2 focus-visible:outline-brand"
                  name="associationName"
                  maxlength="120"
                  required
                />
              </div>
              <div>
                <dt class="mb-1.5 text-xs text-gray-medium">E-mail</dt>
                <dd v-if="!isEditing" class="text-sm">
                  <a
                    v-if="association.contactPerson?.email"
                    class="hover:text-brand"
                    :href="`mailto:${association.contactPerson.email}`"
                  >
                    {{ association.contactPerson.email }}
                  </a>
                  <span v-else class="text-gray-medium">Ikke angivet</span>
                </dd>
                <input
                  v-else
                  id="association-contact-email"
                  v-model.trim="editForm.contactPersonEmail"
                  class="h-9 w-full rounded border border-gray-light px-2 text-sm focus-visible:outline-2 focus-visible:outline-brand"
                  name="contactEmail"
                  type="email"
                  maxlength="254"
                  required
                />
              </div>
              <div>
                <dt class="mb-1.5 text-xs text-gray-medium">Telefon</dt>
                <dd v-if="!isEditing" class="text-sm">
                  <a
                    v-if="association.contactPerson?.phone"
                    class="hover:text-brand"
                    :href="`tel:${association.contactPerson.phone}`"
                  >
                    {{ association.contactPerson.phone }}
                  </a>
                  <span v-else class="text-gray-medium">Ikke angivet</span>
                </dd>
                <input
                  v-else
                  id="association-contact-phone"
                  v-model.trim="editForm.contactPersonPhone"
                  class="h-9 w-full rounded border border-gray-light px-2 text-sm focus-visible:outline-2 focus-visible:outline-brand"
                  name="contactPhone"
                  type="tel"
                  maxlength="50"
                />
              </div>
            </dl>
          </section>

          <section aria-labelledby="contacts-heading">
            <h2 id="contacts-heading" class="mb-7 text-base font-bold text-brand">
              Kontaktpersoner
            </h2>
            <div class="flex items-center gap-4">
              <div
                class="grid size-11 shrink-0 place-items-center rounded-full bg-[#f5eded] text-base text-brand"
                aria-hidden="true"
              >
                {{ (association.contactPerson?.name || '?').charAt(0).toUpperCase() }}
              </div>
              <div class="min-w-0">
                <p v-if="!isEditing" class="text-sm font-bold">
                  {{ association.contactPerson?.name || 'Ikke angivet' }}
                </p>
                <label v-else class="sr-only" for="association-contact-name">
                  Kontaktpersonens navn
                </label>
                <input
                  v-if="isEditing"
                  id="association-contact-name"
                  v-model.trim="editForm.contactPersonName"
                  class="h-9 w-full rounded border border-gray-light px-2 text-sm focus-visible:outline-2 focus-visible:outline-brand"
                  name="contactName"
                  maxlength="120"
                  required
                />
                <p class="mt-1 text-xs text-gray-medium">
                  Kontaktperson for foreningen
                </p>
              </div>
            </div>
            <p class="mt-6 text-xs text-gray-medium">
              Kontaktoplysningerne vises under Teaterforeninger.
            </p>
            <button
              class="mt-2 text-sm text-brand underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              disabled
              title="Brugeradministration bliver tilgængelig senere"
            >
              Administrér brugere →
            </button>
          </section>
        </div>
        </form>

        <section class="py-[30px]" aria-labelledby="warehouses-heading">
          <div class="mb-3 flex items-center justify-between gap-5">
            <div>
              <h2 id="warehouses-heading" class="text-base font-bold text-brand">
                Lageradresser
              </h2>
              <p class="mt-1.5 text-xs text-gray-medium">
                Vælg et lager, når du registrerer en rekvisit.
              </p>
            </div>
            <button
              v-if="profile.role === 'associationAdmin' && !isAddingLocation && !editingLocationId"
              class="h-10 shrink-0 rounded border border-[#d8d5d5] px-4 text-sm text-brand disabled:cursor-not-allowed disabled:opacity-60 max-[540px]:px-3"
              type="button"
              @click="startAddingLocation"
            >
              + Tilføj lager
            </button>
          </div>
          <form
            v-if="isAddingLocation"
            id="storage-location-form"
            class="mb-5 grid gap-4 rounded border border-[#e2e0e0] p-4 sm:grid-cols-3"
            @submit.prevent="saveStorageLocation"
          >
            <label class="grid gap-1.5 text-xs text-gray-medium" for="storage-address">
              Adresse
              <input
                id="storage-address"
                v-model.trim="locationForm.address"
                class="h-9 rounded border border-gray-light px-2 text-sm text-gray-dark focus-visible:outline-2 focus-visible:outline-brand"
                name="address"
                maxlength="200"
                autocomplete="street-address"
                required
              />
            </label>
            <label class="grid gap-1.5 text-xs text-gray-medium" for="storage-postal-code">
              Postnummer
              <input
                id="storage-postal-code"
                v-model.trim="locationForm.postalCode"
                class="h-9 rounded border border-gray-light px-2 text-sm text-gray-dark focus-visible:outline-2 focus-visible:outline-brand"
                name="postalCode"
                maxlength="20"
                autocomplete="postal-code"
                required
              />
            </label>
            <label class="grid gap-1.5 text-xs text-gray-medium" for="storage-city">
              By
              <input
                id="storage-city"
                v-model.trim="locationForm.city"
                class="h-9 rounded border border-gray-light px-2 text-sm text-gray-dark focus-visible:outline-2 focus-visible:outline-brand"
                name="city"
                maxlength="100"
                autocomplete="address-level2"
                required
              />
            </label>
            <div class="flex flex-wrap gap-3 sm:col-span-3">
              <button
                class="h-9 rounded bg-brand px-4 text-sm text-white disabled:opacity-60"
                type="submit"
                :disabled="isSavingLocation"
              >
                {{ isSavingLocation ? 'Gemmer…' : 'Gem lageradresse' }}
              </button>
              <button
                class="h-9 rounded border border-gray-light px-4 text-sm disabled:opacity-60"
                type="button"
                :disabled="isSavingLocation"
                @click="cancelAddingLocation"
              >
                Annullér
              </button>
            </div>
          </form>
          <p
            v-if="locationErrorMessage"
            class="mb-4 text-sm text-brand"
            role="alert"
          >
            {{ locationErrorMessage }}
          </p>
          <p
            v-if="locationSuccessMessage"
            class="mb-4 text-sm text-green-700"
            role="status"
          >
            {{ locationSuccessMessage }}
          </p>
          <ul v-if="association.storageLocations.length" aria-label="Foreningens lageradresser">
            <li
              v-for="location in association.storageLocations"
              :key="location.id"
              class="flex flex-wrap items-center gap-4 border-b border-[#e2e0e0] py-5"
            >
              <svg
                class="size-5 shrink-0 text-gray-medium"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                aria-hidden="true"
              >
                <path d="M3 10.5 12 4l9 6.5V21H3z" />
                <path d="M9 21v-7h6v7M7 10h.01M17 10h.01" />
              </svg>
              <form
                v-if="editingLocationId === location.id"
                class="grid min-w-0 flex-1 gap-3 sm:grid-cols-3"
                :aria-label="`Redigér lageradresse ${location.address}`"
                @submit.prevent="saveEditedStorageLocation"
              >
                <label class="grid gap-1 text-xs text-gray-medium">
                  Adresse
                  <input
                    v-model.trim="locationForm.address"
                    class="h-9 rounded border border-gray-light px-2 text-sm text-gray-dark focus-visible:outline-2 focus-visible:outline-brand"
                    name="editAddress"
                    maxlength="200"
                    required
                  />
                </label>
                <label class="grid gap-1 text-xs text-gray-medium">
                  Postnummer
                  <input
                    v-model.trim="locationForm.postalCode"
                    class="h-9 rounded border border-gray-light px-2 text-sm text-gray-dark focus-visible:outline-2 focus-visible:outline-brand"
                    name="editPostalCode"
                    maxlength="20"
                    required
                  />
                </label>
                <label class="grid gap-1 text-xs text-gray-medium">
                  By
                  <input
                    v-model.trim="locationForm.city"
                    class="h-9 rounded border border-gray-light px-2 text-sm text-gray-dark focus-visible:outline-2 focus-visible:outline-brand"
                    name="editCity"
                    maxlength="100"
                    required
                  />
                </label>
                <div class="flex flex-wrap gap-3 sm:col-span-3">
                  <button
                    class="h-9 rounded bg-brand px-4 text-sm text-white disabled:opacity-60"
                    type="submit"
                    :disabled="isUpdatingLocation"
                  >
                    {{ isUpdatingLocation ? 'Gemmer…' : 'Gem adresse' }}
                  </button>
                  <button
                    class="h-9 rounded border border-gray-light px-4 text-sm disabled:opacity-60"
                    type="button"
                    :disabled="isUpdatingLocation"
                    @click="cancelEditingLocation"
                  >
                    Annullér
                  </button>
                </div>
              </form>
              <div v-else class="min-w-0 flex-1">
                <p class="text-sm">{{ location.address }}</p>
                <p class="mt-1 text-sm text-gray-medium">
                  {{ location.postalCode }} {{ location.city }}
                </p>
              </div>
              <div
                v-if="profile.role === 'associationAdmin' && !isAddingLocation && !editingLocationId"
                class="flex shrink-0 gap-4"
              >
                <button
                  class="text-sm text-brand underline underline-offset-2"
                  type="button"
                  :disabled="deletingLocationId !== null"
                  @click="startEditingLocation(location.id)"
                >
                  Redigér
                </button>
                <button
                  class="text-sm text-brand underline underline-offset-2 disabled:opacity-60"
                  type="button"
                  :disabled="deletingLocationId !== null"
                  @click="removeStorageLocation(location.id)"
                >
                  {{ deletingLocationId === location.id ? 'Fjerner…' : 'Fjern' }}
                </button>
              </div>
            </li>
          </ul>
          <p v-else class="border-b border-[#e2e0e0] py-6 text-sm text-gray-medium">
            Der er endnu ikke tilføjet nogen lageradresser.
          </p>
        </section>
        <div v-if="isEditing" class="flex flex-wrap items-center gap-3 border-b border-[#e2e0e0] py-5">
          <button
            class="h-9 rounded bg-brand px-4 text-sm text-white disabled:opacity-60"
            type="submit"
            form="association-info-form"
            :disabled="isSaving"
          >
            {{ isSaving ? 'Gemmer…' : 'Gem ændringer' }}
          </button>
          <button
            class="h-9 rounded border border-gray-light px-4 text-sm"
            type="button"
            :disabled="isSaving"
            @click="cancelEditing"
          >
            Annullér
          </button>
        </div>
        <p v-if="saveErrorMessage" class="border-b border-[#e2e0e0] py-4 text-sm text-brand" role="alert">
          {{ saveErrorMessage }}
        </p>
        <p v-if="saveSuccessMessage" class="border-b border-[#e2e0e0] py-4 text-sm text-green-700" role="status">
          {{ saveSuccessMessage }}
        </p>
      </div>

      <footer class="flex justify-end border-t border-[#e2e0e0] pt-4">
        <button
          class="text-xs text-gray-medium underline underline-offset-2 hover:text-brand"
          type="button"
          @click="logout"
        >
          Log ud
        </button>
      </footer>
    </main>
  </div>
</template>

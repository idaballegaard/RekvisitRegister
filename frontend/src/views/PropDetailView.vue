<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PropImage from '../components/PropImage.vue'
import {
  deletePropImage,
  createCurrentAssociationProp,
  createCurrentPropReservation,
  deleteCurrentAssociationProp,
  deleteCurrentPropReservation,
  getCurrentAssociation,
  getCurrentAssociationProps,
  getCurrentPropReservations,
  uploadPropImage,
  updateCurrentAssociationProp,
  type AssociationProfile,
  type AssociationProp,
  type AssociationReservation,
} from '../services/association.service'
import {
  clearAuthSession,
  getCurrentUser,
  UnauthorizedError,
  type CurrentUserProfile,
} from '../services/auth.service'

const viewProps = defineProps<{ mode?: 'create' }>()
const isCreating = viewProps.mode === 'create'
const route = useRoute()
const router = useRouter()
const profile = ref<CurrentUserProfile | null>(null)
const association = ref<AssociationProfile | null>(null)
const props = ref<AssociationProp[] | null>(null)
const isLoading = ref(true)
const errorMessage = ref('')
const isEditing = ref(isCreating)
const isSaving = ref(false)
const createdPropId = ref('')
const saveErrorMessage = ref('')
const saveSuccessMessage = ref('')
const imageIndex = ref(0)
const isUpdatingImage = ref(false)
const imageErrorMessage = ref('')
const imageSuccessMessage = ref('')
const reservations = ref<AssociationReservation[]>([])
const isLoadingReservations = ref(false)
const reservationsLoadErrorMessage = ref('')
const isUpdatingReservation = ref(false)
const reservationErrorMessage = ref('')
const reservationStartDate = ref('')
const reservationEndDate = ref('')
const isDeleting = ref(false)
const deleteErrorMessage = ref('')
const isDeleteConfirmationOpen = ref(false)
const cancelDeleteButton = ref<HTMLButtonElement | null>(null)
let deleteTrigger: HTMLElement | null = null
const selectedImages = ref<File[]>([])
const editForm = reactive({
  name: '',
  description: '',
  storageLocationId: '',
  availability: true,
  height: '' as number | '',
  width: '' as number | '',
  depth: '' as number | '',
  unit: 'cm',
  quantity: 1,
  colour: '',
  placement: '',
  tags: '',
  condition: '',
  historicalPeriod: '',
})
const propId = computed(() => (
  typeof route.params.propId === 'string' ? route.params.propId : ''
))
const newProp: AssociationProp = {
  id: '', name: '', description: '', storageLocationId: '', availability: true,
  dimensions: { height: 0, width: 0, depth: 0, unit: 'cm' }, quantity: 1,
  colour: '', placement: '', tags: [], condition: '', historicalPeriod: '',
}
const prop = computed(() => isCreating && association.value
  ? newProp
  : props.value?.find(({ id }) => id === propId.value) ?? null)
const currentImageId = computed(() => prop.value?.imageIds?.[imageIndex.value])
const roleNames: Record<CurrentUserProfile['role'], string> = {
  associationAdmin: 'Foreningsansvarlig',
  propManager: 'Rekvisitansvarlig',
  searchUser: 'Søgebruger',
}

function getStorageLocationLabel(locationId: string): string {
  const location = association.value?.storageLocations.find(({ id }) => id === locationId)
  return location
    ? `${location.address}, ${location.postalCode} ${location.city}`
    : 'Lageradresse ikke fundet'
}

function formatReservationDate(date: string): string {
  return new Intl.DateTimeFormat('da-DK', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00.000Z`))
}

function getReservationInputError(availability: boolean): string {
  const hasStartDate = reservationStartDate.value !== ''
  const hasEndDate = reservationEndDate.value !== ''
  if (hasStartDate !== hasEndDate) {
    return 'Angiv både start- og slutdato for reservationen.'
  }
  if (hasStartDate && !availability) {
    return 'Markér rekvisitten som tilgængelig for at kunne reservere den.'
  }
  if (hasStartDate && reservationEndDate.value < reservationStartDate.value) {
    return 'Slutdatoen skal være samme dag som eller efter startdatoen.'
  }
  return ''
}

async function removeReservation(reservation: AssociationReservation): Promise<void> {
  if (!prop.value || isUpdatingReservation.value) {
    return
  }
  isUpdatingReservation.value = true
  reservationErrorMessage.value = ''
  try {
    await deleteCurrentPropReservation(prop.value.id, reservation.id)
    reservations.value = reservations.value.filter(({ id }) => id !== reservation.id)
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      await router.replace({ name: 'login' })
      return
    }
    reservationErrorMessage.value = error instanceof Error
      ? error.message
      : 'Reservationen kunne ikke fjernes.'
  } finally {
    isUpdatingReservation.value = false
  }
}

function selectImages(event: Event): void {
  const input = event.target
  if (!(input instanceof HTMLInputElement)) return
  const files = Array.from(input.files ?? [])
  input.value = ''
  if (!files.length) return
  imageErrorMessage.value = ''
  if (selectedImages.value.length + files.length > 10) {
    imageErrorMessage.value = 'En rekvisit kan højst have 10 billeder.'
    return
  }
  if (files.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) {
    imageErrorMessage.value = 'Vælg billeder i JPEG, PNG eller WebP.'
    return
  }
  if (files.some((file) => file.size === 0 || file.size > 5 * 1024 * 1024)) {
    imageErrorMessage.value = 'Hvert billede skal være mellem 1 byte og 5 MB.'
    return
  }
  selectedImages.value.push(...files)
}

function removeSelectedImage(index: number): void {
  selectedImages.value.splice(index, 1)
  imageErrorMessage.value = ''
}

async function uploadImage(event: Event): Promise<void> {
  const input = event.target
  if (!(input instanceof HTMLInputElement)) return
  const file = input.files?.[0]
  input.value = ''
  if (!file || !prop.value) return
  imageErrorMessage.value = ''
  imageSuccessMessage.value = ''
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    imageErrorMessage.value = 'Vælg et billede i JPEG, PNG eller WebP.'
    return
  }
  if (file.size === 0 || file.size > 5 * 1024 * 1024) {
    imageErrorMessage.value = 'Billedet skal være mellem 1 byte og 5 MB.'
    return
  }
  isUpdatingImage.value = true
  try {
    const imageId = await uploadPropImage(prop.value.id, file)
    prop.value.imageIds = [...(prop.value.imageIds ?? []), imageId]
    imageIndex.value = prop.value.imageIds.length - 1
    imageSuccessMessage.value = 'Billedet er tilføjet.'
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      await router.replace({ name: 'login' })
      return
    }
    imageErrorMessage.value = error instanceof Error ? error.message : 'Billedet kunne ikke tilføjes.'
  } finally {
    isUpdatingImage.value = false
  }
}

async function removeImage(): Promise<void> {
  if (!prop.value || !currentImageId.value) return
  isUpdatingImage.value = true
  imageErrorMessage.value = ''
  imageSuccessMessage.value = ''
  try {
    await deletePropImage(prop.value.id, currentImageId.value)
    prop.value.imageIds = (prop.value.imageIds ?? []).filter((id) => id !== currentImageId.value)
    imageIndex.value = Math.max(0, Math.min(imageIndex.value, prop.value.imageIds.length - 1))
    imageSuccessMessage.value = 'Billedet er fjernet.'
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      await router.replace({ name: 'login' })
      return
    }
    imageErrorMessage.value = error instanceof Error ? error.message : 'Billedet kunne ikke fjernes.'
  } finally {
    isUpdatingImage.value = false
  }
}

async function openDeleteConfirmation(event: MouseEvent): Promise<void> {
  if (!prop.value || !['associationAdmin', 'propManager'].includes(profile.value?.role ?? '')) {
    return
  }
  deleteTrigger = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
  isDeleteConfirmationOpen.value = true
  await nextTick()
  cancelDeleteButton.value?.focus()
}

async function closeDeleteConfirmation(): Promise<void> {
  isDeleteConfirmationOpen.value = false
  await nextTick()
  deleteTrigger?.focus()
  deleteTrigger = null
}

function handleDeleteDialogKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    void closeDeleteConfirmation()
    return
  }
  if (event.key !== 'Tab') {
    return
  }
  const buttons = Array.from(
    event.currentTarget instanceof HTMLElement
      ? event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
      : [],
  )
  const firstButton = buttons[0]
  const lastButton = buttons[buttons.length - 1]
  if (event.shiftKey && document.activeElement === firstButton) {
    event.preventDefault()
    lastButton?.focus()
  } else if (!event.shiftKey && document.activeElement === lastButton) {
    event.preventDefault()
    firstButton?.focus()
  }
}

async function deleteProp(): Promise<void> {
  if (!prop.value || !['associationAdmin', 'propManager'].includes(profile.value?.role ?? '')
    || isDeleting.value) {
    return
  }
  isDeleting.value = true
  deleteErrorMessage.value = ''
  try {
    await deleteCurrentAssociationProp(prop.value.id)
    isDeleteConfirmationOpen.value = false
    await backToProps()
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      await router.replace({ name: 'login' })
      return
    }
    deleteErrorMessage.value = error instanceof Error
      ? error.message
      : 'Rekvisitten kunne ikke slettes.'
    await closeDeleteConfirmation()
  } finally {
    isDeleting.value = false
  }
}

function startEditing(): void {
  if (!prop.value || !['associationAdmin', 'propManager'].includes(profile.value?.role ?? '')) {
    return
  }
  reservationStartDate.value = ''
  reservationEndDate.value = ''
  reservationErrorMessage.value = ''
  editForm.name = prop.value.name
  editForm.description = prop.value.description
  editForm.storageLocationId = prop.value.storageLocationId
  editForm.availability = prop.value.availability
  editForm.height = prop.value.dimensions.height
  editForm.width = prop.value.dimensions.width
  editForm.depth = prop.value.dimensions.depth
  editForm.unit = prop.value.dimensions.unit
  editForm.quantity = prop.value.quantity
  editForm.colour = prop.value.colour
  editForm.placement = prop.value.placement
  editForm.tags = prop.value.tags.join(', ')
  editForm.condition = prop.value.condition
  editForm.historicalPeriod = prop.value.historicalPeriod
  saveErrorMessage.value = ''
  saveSuccessMessage.value = ''
  imageErrorMessage.value = ''
  imageSuccessMessage.value = ''
  isEditing.value = true
}

function cancelEditing(): void {
  if (isCreating) {
    void backToProps()
    return
  }
  isEditing.value = false
  saveErrorMessage.value = ''
}

async function saveProp(): Promise<void> {
  if (!prop.value || !['associationAdmin', 'propManager'].includes(profile.value?.role ?? '')
    || createdPropId.value) {
    return
  }
  const reservationInputError = getReservationInputError(editForm.availability)
  if (reservationInputError) {
    saveErrorMessage.value = reservationInputError
    return
  }
  saveErrorMessage.value = ''
  saveSuccessMessage.value = ''
  isSaving.value = true
  try {
    const input = {
      name: editForm.name,
      description: editForm.description,
      storageLocationId: editForm.storageLocationId,
      availability: editForm.availability,
      dimensions: {
        height: Number(editForm.height),
        width: Number(editForm.width),
        depth: Number(editForm.depth),
        unit: editForm.unit,
      },
      quantity: Number(editForm.quantity),
      colour: editForm.colour,
      placement: editForm.placement,
      tags: editForm.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      condition: editForm.condition,
      historicalPeriod: editForm.historicalPeriod,
    }
    if (isCreating) {
      const createdProp = await createCurrentAssociationProp(input)
      createdPropId.value = createdProp.id
      for (const [index, file] of selectedImages.value.entries()) {
        try {
          await uploadPropImage(createdProp.id, file)
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Ukendt fejl.'
          saveErrorMessage.value = `Rekvisitten er oprettet, men upload af "${file.name}" fejlede: ${message} ${index} af ${selectedImages.value.length} billeder blev bekræftet. Åbn rekvisitten for at kontrollere og tilføje de manglende billeder.`
          return
        }
      }
      if (reservationStartDate.value && reservationEndDate.value) {
        try {
          await createCurrentPropReservation(createdProp.id, {
            startDate: reservationStartDate.value,
            endDate: reservationEndDate.value,
          })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Ukendt fejl.'
          saveErrorMessage.value = `Rekvisitten er oprettet, men reservationen kunne ikke oprettes: ${message} Åbn rekvisitten for at prøve igen.`
          return
        }
      }
      await openCreatedProp()
      return
    }
    const updatedProp = await updateCurrentAssociationProp(prop.value.id, input)
    props.value = (props.value ?? []).map((item) => item.id === updatedProp.id ? updatedProp : item)
    if (reservationStartDate.value && reservationEndDate.value) {
      try {
        const reservation = await createCurrentPropReservation(updatedProp.id, {
          startDate: reservationStartDate.value,
          endDate: reservationEndDate.value,
        })
        reservations.value = [...reservations.value, reservation]
        reservationStartDate.value = ''
        reservationEndDate.value = ''
        isEditing.value = false
        saveSuccessMessage.value = 'Rekvisitten er opdateret, og reservationen er oprettet.'
        return
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Ukendt fejl.'
        saveErrorMessage.value = `Rekvisitten er opdateret, men reservationen kunne ikke oprettes: ${message}`
        return
      }
    }
    isEditing.value = false
    saveSuccessMessage.value = 'Rekvisitten er opdateret.'
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      await router.replace({ name: 'login' })
      return
    }
    saveErrorMessage.value = error instanceof Error
      ? error.message
      : 'Rekvisitten kunne ikke gemmes.'
  } finally {
    isSaving.value = false
  }
}

async function openCreatedProp(): Promise<void> {
  try {
    const failure = await router.push({
      name: 'admin-prop-detail',
      params: { propId: createdPropId.value },
    })
    if (failure) {
      saveErrorMessage.value = 'Rekvisitten er oprettet, men detaljesiden kunne ikke åbnes.'
    }
  } catch {
    saveErrorMessage.value = 'Rekvisitten er oprettet, men detaljesiden kunne ikke åbnes.'
  }
}

async function backToProps(): Promise<void> {
  await router.push({
    name: 'admin',
    query: {
      tab: 'props',
      ...(typeof route.query.q === 'string' ? { q: route.query.q } : {}),
    },
  })
}

async function openGeneralTab(): Promise<void> {
  await router.push({ name: 'admin', query: { tab: 'general' } })
}

async function openLoansTab(): Promise<void> {
  await router.push({ name: 'admin', query: { tab: 'loans' } })
}

async function logout(): Promise<void> {
  clearAuthSession()
  await router.replace({ name: 'login' })
}

onMounted(async () => {
  try {
    const currentUser = await getCurrentUser()
    if (isCreating
      ? !['associationAdmin', 'propManager'].includes(currentUser.role)
      : !['associationAdmin', 'propManager'].includes(currentUser.role)) {
      await router.replace({ name: 'profile' })
      return
    }
    profile.value = currentUser
    if (isCreating) {
      association.value = await getCurrentAssociation()
    } else {
      const [currentAssociation, currentProps] = await Promise.all([
        getCurrentAssociation(),
        getCurrentAssociationProps(),
      ])
      association.value = currentAssociation
      props.value = currentProps
      if (currentProps.some(({ id }) => id === propId.value)) {
        isLoadingReservations.value = true
        try {
          reservations.value = await getCurrentPropReservations(propId.value)
        } catch (error) {
          if (error instanceof UnauthorizedError) {
            await router.replace({ name: 'login' })
            return
          }
          reservationsLoadErrorMessage.value = error instanceof Error
            ? error.message
            : 'Reservationerne kunne ikke hentes.'
        } finally {
          isLoadingReservations.value = false
        }
      }
    }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      await router.replace({ name: 'login' })
      return
    }
    errorMessage.value = error instanceof Error
      ? error.message
      : 'Rekvisitten kunne ikke hentes.'
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <div class="min-h-screen min-h-[100svh] bg-white font-sans text-gray-dark">
    <main
      class="mx-auto w-full max-w-[1250px] px-0 pt-[68px] pb-8 max-[1080px]:px-5 max-[700px]:pt-6"
    >
      <header class="border-b border-[#e2e0e0] pb-[22px]">
        <div class="flex items-start justify-between gap-6">
          <div>
            <p class="mb-2 text-base font-bold tracking-[0.16em] text-brand uppercase">
              {{ association?.name ?? profile?.associationName ?? 'Forening' }}
            </p>
            <h1 class="text-4xl leading-[1.15] font-bold max-[540px]:text-3xl">Adminpanel</h1>
            <p class="mt-3 text-lg text-gray-medium">
              Administrér din forenings oplysninger, rekvisitter og lån.
            </p>
          </div>
          <p v-if="profile" class="mt-4 text-sm text-gray-medium max-[540px]:hidden">
            {{ roleNames[profile.role] }}
          </p>
        </div>
      </header>

      <nav class="border-b border-[#e2e0e0]" aria-label="Adminpanel-faner">
        <ul class="-mb-px flex flex-wrap gap-8 max-[540px]:gap-6">
          <li v-if="profile?.role === 'associationAdmin'">
            <button
              class="inline-flex h-[54px] items-center border-b-2 border-transparent px-0.5 text-base text-gray-medium hover:text-brand"
              type="button"
              @click="openGeneralTab"
            >
              Generelt
            </button>
          </li>
          <li v-if="profile?.role === 'associationAdmin' || profile?.role === 'propManager'">
            <button
              class="inline-flex h-[54px] items-center border-b-2 border-brand px-0.5 text-base font-bold text-brand"
              type="button"
              aria-current="page"
              @click="backToProps"
            >
              Egne rekvisitter
            </button>
          </li>
          <li v-if="profile?.role === 'associationAdmin'">
            <button
              class="h-[54px] cursor-not-allowed px-0.5 text-base text-gray-medium/60"
              type="button"
              disabled
              title="Denne fane er ikke tilgængelig endnu"
            >
              Brugere
            </button>
          </li>
          <li v-if="profile?.role === 'associationAdmin' || profile?.role === 'propManager'">
            <button
              class="inline-flex h-[54px] items-center border-b-2 border-transparent px-0.5 text-base text-gray-medium hover:text-brand"
              type="button"
              @click="openLoansTab"
            >
              Lån
            </button>
          </li>
        </ul>
      </nav>

      <button
        class="mt-8 cursor-pointer text-base font-semibold text-brand hover:text-[#7d0202] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        type="button"
        @click="backToProps"
      >
        ← Tilbage til egne rekvisitter
      </button>
      <p v-if="isLoading" class="py-10 text-base text-gray-medium" role="status">
        Henter rekvisit…
      </p>
      <p v-else-if="errorMessage" class="py-6 text-base text-brand" role="alert">
        {{ errorMessage }}
      </p>
      <p v-else-if="!prop" class="py-10 text-base text-gray-medium" role="status">
        Rekvisitten blev ikke fundet.
      </p>
      <article
        v-else
        class="mt-4 grid gap-8 md:grid-cols-[minmax(0,1fr)_360px]"
        aria-labelledby="prop-detail-heading"
      >
        <div class="min-w-0">
          <div v-if="!isEditing" class="flex flex-wrap items-start justify-between gap-4">
            <h2 id="prop-detail-heading" class="text-2xl font-bold">{{ prop.name }}</h2>
            <div class="flex flex-wrap items-center gap-3">
              <span
                class="rounded-full px-3 py-1 text-sm font-semibold"
                :class="prop.availability
                  ? 'bg-green-50 text-green-800'
                  : 'bg-gray-100 text-gray-medium'"
              >
                {{ prop.availability ? 'Tilgængelig' : 'Ikke tilgængelig' }}
              </span>
              <button
                v-if="profile?.role === 'associationAdmin' || profile?.role === 'propManager'"
                class="h-10 rounded-[4px] border-0 bg-brand px-4 text-base font-semibold text-white hover:bg-[#7d0202] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                type="button"
                @click="startEditing"
              >
                Redigér
              </button>
              <button
                v-if="profile?.role === 'associationAdmin' || profile?.role === 'propManager'"
                class="h-10 rounded-[4px] border border-brand px-4 text-base font-semibold text-brand hover:bg-[#f5eded] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                :disabled="isDeleting"
                @click="openDeleteConfirmation"
              >
                {{ isDeleting ? 'Sletter…' : 'Slet rekvisit' }}
              </button>
            </div>
          </div>
          <p v-if="deleteErrorMessage" class="mt-4 text-base text-brand" role="alert">
            {{ deleteErrorMessage }}
          </p>
          <form v-if="isEditing" class="mt-5 grid gap-5" @submit.prevent="saveProp">
            <h2 id="prop-detail-heading" class="text-2xl font-bold">
              {{ isCreating ? 'Tilføj rekvisit' : 'Redigér rekvisit' }}
            </h2>
            <p v-if="isCreating && association?.storageLocations.length === 0" class="text-base text-brand" role="alert">
              Tilføj først en lageradresse under Generelt, før du opretter en rekvisit.
            </p>
            <fieldset :disabled="isSaving || !!createdPropId" class="grid gap-5">
            <div class="grid gap-2">
              <label for="prop-name" class="text-base text-gray-medium">Navn</label>
              <input
                id="prop-name"
                v-model.trim="editForm.name"
                class="h-11 rounded border border-gray-light px-3 text-base focus-visible:outline-2 focus-visible:outline-brand"
                maxlength="120"
                required
              />
            </div>
            <div class="grid gap-2">
              <label for="prop-description" class="text-base text-gray-medium">Beskrivelse</label>
              <textarea
                id="prop-description"
                v-model.trim="editForm.description"
                class="min-h-24 rounded border border-gray-light p-3 text-base focus-visible:outline-2 focus-visible:outline-brand"
                maxlength="2000"
              />
            </div>
            <div class="grid grid-cols-2 gap-4 max-[700px]:grid-cols-1">
              <div class="grid gap-2">
                <label for="prop-condition" class="text-base text-gray-medium">Stand</label>
                <input
                  id="prop-condition"
                  v-model.trim="editForm.condition"
                  class="h-11 rounded border border-gray-light px-3 text-base focus-visible:outline-2 focus-visible:outline-brand"
                  maxlength="500"
                />
              </div>
              <fieldset class="grid gap-2">
                <legend class="text-base text-gray-medium">Mål (h × b × d)</legend>
                <div class="grid grid-cols-3 gap-2">
                  <input
                    v-model.number="editForm.height"
                    class="h-11 min-w-0 rounded border border-gray-light px-2 text-base focus-visible:outline-2 focus-visible:outline-brand"
                    type="number"
                    min="0"
                    step="any"
                    aria-label="Højde"
                    required
                  />
                  <input
                    v-model.number="editForm.width"
                    class="h-11 min-w-0 rounded border border-gray-light px-2 text-base focus-visible:outline-2 focus-visible:outline-brand"
                    type="number"
                    min="0"
                    step="any"
                    aria-label="Bredde"
                    required
                  />
                  <input
                    v-model.number="editForm.depth"
                    class="h-11 min-w-0 rounded border border-gray-light px-2 text-base focus-visible:outline-2 focus-visible:outline-brand"
                    type="number"
                    min="0"
                    step="any"
                    aria-label="Dybde"
                    required
                  />
                </div>
              </fieldset>
              <div class="grid gap-2">
                <label for="prop-unit" class="text-base text-gray-medium">Måleenhed</label>
                <input
                  id="prop-unit"
                  v-model.trim="editForm.unit"
                  class="h-11 rounded border border-gray-light px-3 text-base focus-visible:outline-2 focus-visible:outline-brand"
                  maxlength="20"
                  required
                />
              </div>
              <div class="grid gap-2">
                <label for="prop-quantity" class="text-base text-gray-medium">Antal</label>
                <input
                  id="prop-quantity"
                  v-model.number="editForm.quantity"
                  class="h-11 rounded border border-gray-light px-3 text-base focus-visible:outline-2 focus-visible:outline-brand"
                  type="number"
                  min="1"
                  step="1"
                  required
                />
              </div>
              <div class="grid gap-2">
                <label for="prop-colour" class="text-base text-gray-medium">Farve</label>
                <input
                  id="prop-colour"
                  v-model.trim="editForm.colour"
                  class="h-11 rounded border border-gray-light px-3 text-base focus-visible:outline-2 focus-visible:outline-brand"
                  maxlength="80"
                />
              </div>
              <div class="grid gap-2">
                <label for="prop-period" class="text-base text-gray-medium">Tidsalder</label>
                <input
                  id="prop-period"
                  v-model.trim="editForm.historicalPeriod"
                  class="h-11 rounded border border-gray-light px-3 text-base focus-visible:outline-2 focus-visible:outline-brand"
                  maxlength="100"
                />
              </div>
              <div class="grid gap-2">
                <label for="prop-storage-location" class="text-base text-gray-medium">
                  Lageradresse
                </label>
                <select
                  id="prop-storage-location"
                  v-model="editForm.storageLocationId"
                  class="h-11 rounded border border-gray-light px-3 text-base focus-visible:outline-2 focus-visible:outline-brand"
                  required
                >
                  <option value="" disabled>Vælg lageradresse</option>
                  <option
                    v-for="location in association?.storageLocations ?? []"
                    :key="location.id"
                    :value="location.id"
                  >
                    {{ location.address }}, {{ location.postalCode }} {{ location.city }}
                  </option>
                </select>
              </div>
              <div class="grid gap-2">
                <label for="prop-placement" class="text-base text-gray-medium">Placering</label>
                <input
                  id="prop-placement"
                  v-model.trim="editForm.placement"
                  class="h-11 rounded border border-gray-light px-3 text-base focus-visible:outline-2 focus-visible:outline-brand"
                  maxlength="120"
                />
              </div>
              <div class="grid gap-2">
                <label for="prop-tags" class="text-base text-gray-medium">Tags (adskilt med komma)</label>
                <input
                  id="prop-tags"
                  v-model="editForm.tags"
                  class="h-11 rounded border border-gray-light px-3 text-base focus-visible:outline-2 focus-visible:outline-brand"
                  maxlength="1600"
                />
              </div>
            </div>
            <label class="flex items-center gap-3 text-base">
              <input v-model="editForm.availability" type="checkbox" class="size-4 accent-brand" />
              Tilgængelig
            </label>
            </fieldset>
            <section class="grid gap-3 rounded border border-gray-light p-4">
              <div>
                <h3 class="font-semibold">Reserver en periode</h3>
                <p class="mt-1 text-sm text-gray-medium">
                  En reservation blokerer hele rekvisitten i den valgte periode. Datoerne er
                  inklusive, og perioder må ikke overlappe.
                </p>
              </div>
              <div class="grid grid-cols-2 gap-4 max-[540px]:grid-cols-1">
                <div class="grid gap-2">
                  <label for="reservation-start-date" class="text-sm text-gray-medium">
                    Fra dato
                  </label>
                  <input
                    id="reservation-start-date"
                    v-model="reservationStartDate"
                    type="date"
                    :required="!!reservationEndDate"
                    class="h-11 rounded border border-gray-light px-3 text-base focus-visible:outline-2 focus-visible:outline-brand"
                  />
                </div>
                <div class="grid gap-2">
                  <label for="reservation-end-date" class="text-sm text-gray-medium">
                    Til dato
                  </label>
                  <input
                    id="reservation-end-date"
                    v-model="reservationEndDate"
                    type="date"
                    :required="!!reservationStartDate"
                    :min="reservationStartDate || undefined"
                    class="h-11 rounded border border-gray-light px-3 text-base focus-visible:outline-2 focus-visible:outline-brand"
                  />
                </div>
              </div>
            </section>
            <p v-if="saveErrorMessage" class="text-base text-brand" role="alert">
              {{ saveErrorMessage }}
            </p>
            <button
              v-if="createdPropId"
              type="button"
              class="justify-self-start text-brand underline"
              @click="openCreatedProp"
            >
              Åbn den oprettede rekvisit
            </button>
            <div class="flex flex-wrap gap-3">
              <button
                class="h-11 rounded-[4px] bg-brand px-5 text-base font-semibold text-white hover:bg-[#7d0202] disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
                :disabled="isSaving || isUpdatingImage || !!createdPropId || (isCreating && !association?.storageLocations.length)"
              >
                {{ isSaving ? 'Gemmer…' : isCreating ? 'Opret rekvisit' : 'Gem ændringer' }}
              </button>
              <button
                class="h-11 rounded border border-gray-light px-5 text-base disabled:opacity-60"
                type="button"
                :disabled="isSaving || isUpdatingImage"
                @click="cancelEditing"
              >
                Annullér
              </button>
            </div>
          </form>
          <div v-else>
            <p class="mt-4 whitespace-pre-line text-lg text-gray-medium">
              {{ prop.description || 'Ingen beskrivelse' }}
            </p>
            <dl class="mt-8 grid grid-cols-2 gap-x-8 gap-y-6 max-[700px]:grid-cols-1">
              <div>
                <dt class="text-base text-gray-medium">Stand</dt>
                <dd class="mt-1 text-lg">{{ prop.condition || 'Ikke angivet' }}</dd>
              </div>
              <div>
                <dt class="text-base text-gray-medium">Mål (h × b × d)</dt>
                <dd class="mt-1 text-lg">
                  {{ prop.dimensions.height }} × {{ prop.dimensions.width }} ×
                  {{ prop.dimensions.depth }} {{ prop.dimensions.unit }}
                </dd>
              </div>
              <div>
                <dt class="text-base text-gray-medium">Antal</dt>
                <dd class="mt-1 text-lg">{{ prop.quantity }}</dd>
              </div>
              <div>
                <dt class="text-base text-gray-medium">Farve</dt>
                <dd class="mt-1 text-lg">{{ prop.colour || 'Ikke angivet' }}</dd>
              </div>
              <div>
                <dt class="text-base text-gray-medium">Tidsalder</dt>
                <dd class="mt-1 text-lg">{{ prop.historicalPeriod || 'Ikke angivet' }}</dd>
              </div>
              <div>
                <dt class="text-base text-gray-medium">Lageradresse</dt>
                <dd class="mt-1 text-lg">{{ getStorageLocationLabel(prop.storageLocationId) }}</dd>
              </div>
              <div>
                <dt class="text-base text-gray-medium">Placering</dt>
                <dd class="mt-1 text-lg">{{ prop.placement || 'Ikke angivet' }}</dd>
              </div>
            </dl>
            <div v-if="prop.tags.length" class="mt-8">
              <h3 class="text-base font-semibold">Tags</h3>
              <ul class="mt-3 flex flex-wrap gap-2" aria-label="Mærkater">
                <li
                  v-for="tag in prop.tags"
                  :key="tag"
                  class="rounded bg-[#f5eded] px-3 py-1 text-sm text-brand"
                >
                  {{ tag }}
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div v-if="isCreating" class="w-full max-w-[360px] justify-self-end">
          <div class="grid aspect-square w-full place-items-center rounded border border-dashed border-gray-light bg-[#fafafa] p-4 text-center text-base text-gray-medium">
            Vælg billeder til rekvisitten
          </div>
          <div class="mt-4 grid gap-3">
            <input
              id="prop-create-images"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              :disabled="isSaving || !!createdPropId || selectedImages.length >= 10"
              aria-describedby="prop-create-images-help"
              class="peer sr-only"
              @change="selectImages"
            />
            <label
              for="prop-create-images"
              class="inline-flex h-11 w-fit cursor-pointer items-center justify-center rounded-[4px] bg-brand px-5 text-base font-semibold text-white hover:bg-[#7d0202] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand peer-disabled:cursor-not-allowed peer-disabled:opacity-60"
            >
              Tilføj billeder
            </label>
            <p id="prop-create-images-help" class="text-sm text-gray-medium">
              JPEG, PNG eller WebP. Højst 5 MB pr. billede og 10 billeder. Billederne uploades,
              når rekvisitten oprettes.
            </p>
            <p v-if="selectedImages.length >= 10" class="text-sm text-gray-medium">
              Du har valgt 10 billeder.
            </p>
            <ul v-if="selectedImages.length" aria-label="Valgte billeder" class="grid gap-2">
              <li v-for="(file, index) in selectedImages" :key="index" class="flex items-center justify-between gap-3">
                <span class="min-w-0 break-all text-sm">{{ file.name }}</span>
                <button
                  type="button"
                  class="shrink-0 text-sm text-brand underline disabled:opacity-50"
                  :aria-label="`Fjern ${file.name}`"
                  :disabled="isSaving || !!createdPropId"
                  @click="removeSelectedImage(index)"
                >
                  Fjern
                </button>
              </li>
            </ul>
            <p v-if="imageErrorMessage" class="text-base text-brand" role="alert">{{ imageErrorMessage }}</p>
          </div>
        </div>
        <div v-else class="w-full max-w-[360px] justify-self-end">
          <div
            class="grid aspect-square w-full place-items-center overflow-hidden rounded border border-dashed border-gray-light bg-[#fafafa] p-2 text-base text-gray-medium"
          >
            <PropImage
              v-if="currentImageId"
              :prop-id="prop.id"
              :image-id="currentImageId"
              :alt="`Billede af ${prop.name}`"
            />
            <span v-else role="img" :aria-label="`Billedområde for ${prop.name}`">
              Billede vises her
            </span>
          </div>
          <div v-if="(prop.imageIds?.length ?? 0) > 1" class="mt-3 flex items-center justify-between gap-3">
            <button type="button" class="text-brand underline disabled:opacity-50" :disabled="imageIndex === 0" @click="imageIndex--">Forrige</button>
            <span>{{ imageIndex + 1 }} / {{ prop.imageIds?.length }}</span>
            <button type="button" class="text-brand underline disabled:opacity-50" :disabled="imageIndex >= (prop.imageIds?.length ?? 0) - 1" @click="imageIndex++">Næste</button>
          </div>
          <div
            v-if="isEditing && (profile?.role === 'associationAdmin' || profile?.role === 'propManager')"
            class="mt-4 grid gap-3"
          >
            <input
              id="prop-image-upload"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              :disabled="isSaving || isUpdatingImage || (prop.imageIds?.length ?? 0) >= 10"
              aria-describedby="prop-image-help"
              class="peer sr-only"
              @change="uploadImage"
            />
            <label
              for="prop-image-upload"
              class="inline-flex h-11 w-fit cursor-pointer items-center justify-center rounded-[4px] bg-brand px-5 text-base font-semibold text-white hover:bg-[#7d0202] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand peer-disabled:cursor-not-allowed peer-disabled:opacity-60"
            >
              {{ isUpdatingImage ? 'Behandler billede…' : 'Tilføj billede' }}
            </label>
            <p id="prop-image-help" class="text-sm text-gray-medium">
              JPEG, PNG eller WebP. Højst 5 MB pr. billede og 10 billeder. Billeder gemmes
              straks, uafhængigt af ændringer i formularen.
            </p>
            <p v-if="(prop.imageIds?.length ?? 0) >= 10" class="text-sm text-gray-medium">
              Du har nået grænsen på 10 billeder.
            </p>
            <button
              v-if="currentImageId"
              type="button"
              class="justify-self-start text-base text-brand underline disabled:opacity-50"
              :disabled="isSaving || isUpdatingImage"
              @click="removeImage"
            >
              Fjern billede
            </button>
            <p v-if="imageErrorMessage" class="text-base text-brand" role="alert">{{ imageErrorMessage }}</p>
            <p v-if="imageSuccessMessage" class="text-base text-green-800" role="status">{{ imageSuccessMessage }}</p>
          </div>
        </div>
      </article>
      <section
        v-if="!isCreating && prop"
        class="mt-8 border-t border-[#e2e0e0] pt-6"
        aria-labelledby="reservations-heading"
      >
        <h2 id="reservations-heading" class="text-xl font-bold text-brand">
          Reservationer
        </h2>
        <p v-if="isLoadingReservations" class="mt-3 text-sm text-gray-medium" role="status">
          Henter reservationer…
        </p>
        <p v-else-if="reservationsLoadErrorMessage" class="mt-3 text-sm text-brand" role="alert">
          {{ reservationsLoadErrorMessage }}
        </p>
        <p v-if="reservationErrorMessage" class="mt-3 text-sm text-brand" role="alert">
          {{ reservationErrorMessage }}
        </p>
        <p v-if="!isLoadingReservations && !reservationsLoadErrorMessage && reservations.length === 0" class="mt-3 text-sm text-gray-medium">
          Der er ingen reservationer på rekvisitten.
        </p>
        <ul
          v-if="!isLoadingReservations && !reservationsLoadErrorMessage && reservations.length"
          class="mt-4 grid gap-3"
          aria-label="Reservationer for rekvisitten"
        >
          <li
            v-for="reservation in reservations"
            :key="reservation.id"
            class="flex flex-wrap items-center justify-between gap-3 rounded border border-gray-light p-3"
          >
            <p class="text-sm">
              {{ formatReservationDate(reservation.startDate) }} –
              {{ formatReservationDate(reservation.endDate) }}
            </p>
            <button
              type="button"
              class="text-sm text-brand underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="isUpdatingReservation"
              @click="removeReservation(reservation)"
            >
              {{ isUpdatingReservation ? 'Fjerner…' : 'Fjern reservation' }}
            </button>
          </li>
        </ul>
      </section>
      <p v-if="saveSuccessMessage" class="mt-5 text-base text-green-800" role="status">
        {{ saveSuccessMessage }}
      </p>

      <div
        v-if="isDeleteConfirmationOpen && prop"
        class="fixed inset-0 z-50 flex items-center justify-center bg-gray-dark/60 px-4 py-6"
        @click.self="closeDeleteConfirmation"
        @keydown="handleDeleteDialogKeydown"
      >
        <section
          class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-prop-title"
          aria-describedby="delete-prop-description"
        >
          <h2 id="delete-prop-title" class="text-xl font-bold text-brand">
            Slet rekvisit?
          </h2>
          <p id="delete-prop-description" class="mt-3 text-base leading-6 text-gray-dark">
            Er du sikker på, at du vil slette rekvisitten
            <span class="font-semibold">"{{ prop.name }}"</span>? Det kan ikke fortrydes.
          </p>
          <div class="mt-6 flex justify-end gap-3">
            <button
              ref="cancelDeleteButton"
              class="h-10 rounded-[4px] border border-gray-light px-4 text-sm font-semibold text-gray-dark hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              :disabled="isDeleting"
              @click="closeDeleteConfirmation"
            >
              Annuller
            </button>
            <button
              class="h-10 rounded-[4px] bg-brand px-4 text-sm font-semibold text-white hover:bg-[#7d0202] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              :disabled="isDeleting"
              @click="deleteProp"
            >
              {{ isDeleting ? 'Sletter…' : 'Slet rekvisit' }}
            </button>
          </div>
        </section>
      </div>

      <footer class="mt-8 flex justify-end border-t border-[#e2e0e0] pt-4">
        <button
          class="flex h-11 shrink-0 items-center gap-4 rounded-[4px] border-0 bg-brand px-5 text-base font-semibold text-white hover:bg-[#7d0202] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          type="button"
          aria-label="Log ud"
          @click="logout"
        >
          Log ud <span aria-hidden="true">→</span>
        </button>
      </footer>
    </main>
  </div>
</template>

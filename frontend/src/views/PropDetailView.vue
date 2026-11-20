<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  getCurrentAssociation,
  getCurrentAssociationProps,
  updateCurrentAssociationProp,
  type AssociationProfile,
  type AssociationProp,
} from '../services/association.service'
import {
  clearAuthSession,
  getCurrentUser,
  UnauthorizedError,
  type CurrentUserProfile,
} from '../services/auth.service'

const route = useRoute()
const router = useRouter()
const profile = ref<CurrentUserProfile | null>(null)
const association = ref<AssociationProfile | null>(null)
const props = ref<AssociationProp[] | null>(null)
const isLoading = ref(true)
const errorMessage = ref('')
const isEditing = ref(false)
const isSaving = ref(false)
const saveErrorMessage = ref('')
const saveSuccessMessage = ref('')
const editForm = reactive({
  name: '',
  description: '',
  storageLocationId: '',
  availability: true,
  height: 0,
  width: 0,
  depth: 0,
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
const prop = computed(() => props.value?.find(({ id }) => id === propId.value) ?? null)
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

function startEditing(): void {
  if (!prop.value || profile.value?.role !== 'associationAdmin') {
    return
  }
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
  isEditing.value = true
}

function cancelEditing(): void {
  isEditing.value = false
  saveErrorMessage.value = ''
}

async function saveProp(): Promise<void> {
  if (!prop.value || profile.value?.role !== 'associationAdmin') {
    return
  }
  saveErrorMessage.value = ''
  saveSuccessMessage.value = ''
  isSaving.value = true
  try {
    const updatedProp = await updateCurrentAssociationProp(prop.value.id, {
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
    })
    props.value = (props.value ?? []).map((item) => item.id === updatedProp.id ? updatedProp : item)
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

async function logout(): Promise<void> {
  clearAuthSession()
  await router.replace({ name: 'login' })
}

onMounted(async () => {
  try {
    const currentUser = await getCurrentUser()
    if (currentUser.role !== 'associationAdmin') {
      await router.replace({ name: 'profile' })
      return
    }
    profile.value = currentUser
    const [currentAssociation, currentProps] = await Promise.all([
      getCurrentAssociation(),
      getCurrentAssociationProps(),
    ])
    association.value = currentAssociation
    props.value = currentProps
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
          <li>
            <button
              class="inline-flex h-[54px] items-center border-b-2 border-transparent px-0.5 text-base text-gray-medium hover:text-brand"
              type="button"
              @click="openGeneralTab"
            >
              Generelt
            </button>
          </li>
          <li>
            <button
              class="inline-flex h-[54px] items-center border-b-2 border-brand px-0.5 text-base font-bold text-brand"
              type="button"
              aria-current="page"
              @click="backToProps"
            >
              Egne rekvisitter
            </button>
          </li>
          <li>
            <button
              class="h-[54px] cursor-not-allowed px-0.5 text-base text-gray-medium/60"
              type="button"
              disabled
              title="Denne fane er ikke tilgængelig endnu"
            >
              Brugere
            </button>
          </li>
          <li>
            <button
              class="h-[54px] cursor-not-allowed px-0.5 text-base text-gray-medium/60"
              type="button"
              disabled
              title="Denne fane er ikke tilgængelig endnu"
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
                v-if="profile?.role === 'associationAdmin'"
                class="h-10 rounded-[4px] border-0 bg-brand px-4 text-base font-semibold text-white hover:bg-[#7d0202] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                type="button"
                @click="startEditing"
              >
                Redigér
              </button>
            </div>
          </div>
          <form v-if="isEditing" class="mt-5 grid gap-5" @submit.prevent="saveProp">
            <h2 id="prop-detail-heading" class="text-2xl font-bold">Redigér rekvisit</h2>
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
            <p v-if="saveErrorMessage" class="text-base text-brand" role="alert">
              {{ saveErrorMessage }}
            </p>
            <div class="flex flex-wrap gap-3">
              <button
                class="h-11 rounded-[4px] bg-brand px-5 text-base font-semibold text-white hover:bg-[#7d0202] disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
                :disabled="isSaving"
              >
                {{ isSaving ? 'Gemmer…' : 'Gem ændringer' }}
              </button>
              <button
                class="h-11 rounded border border-gray-light px-5 text-base disabled:opacity-60"
                type="button"
                :disabled="isSaving"
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
        <div
          class="grid aspect-square w-full max-w-[360px] justify-self-end place-items-center overflow-y-auto overscroll-contain rounded border border-dashed border-gray-light bg-[#fafafa] p-2 text-base text-gray-medium"
          role="img"
          :aria-label="`Billedområde for ${prop.name}`"
        >
          Billede vises her
        </div>
      </article>
      <p v-if="saveSuccessMessage" class="mt-5 text-base text-green-800" role="status">
        {{ saveSuccessMessage }}
      </p>

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

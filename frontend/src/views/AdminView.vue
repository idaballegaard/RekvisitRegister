<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  getCurrentAssociation,
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
const editForm = reactive({
  name: '',
  contactPersonName: '',
  contactPersonEmail: '',
  contactPersonPhone: '',
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

      <form v-if="profile && association" id="generelt" @submit.prevent="saveAssociation">
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
              class="h-10 shrink-0 rounded border border-[#d8d5d5] px-4 text-sm text-brand disabled:cursor-not-allowed disabled:opacity-60 max-[540px]:px-3"
              type="button"
              disabled
              title="Lageradresser kan tilføjes senere"
            >
              + Tilføj lager
            </button>
          </div>
          <p class="border-b border-[#e2e0e0] py-6 text-sm text-gray-medium">
            Der er endnu ikke tilføjet nogen lageradresser.
          </p>
        </section>
        <div v-if="isEditing" class="flex flex-wrap items-center gap-3 border-b border-[#e2e0e0] py-5">
          <button
            class="h-9 rounded bg-brand px-4 text-sm text-white disabled:opacity-60"
            type="submit"
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
      </form>

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

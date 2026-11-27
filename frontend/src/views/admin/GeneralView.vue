<script setup lang="ts">
import type { AssociationProfile } from '../../services/association.service'
import type { CurrentUserProfile } from '../../services/auth.service'
import type { useAssociationGeneral } from '../../composables/admin/useAssociationGeneral'

const { state, profile, association } = defineProps<{
  state: ReturnType<typeof useAssociationGeneral>
  profile: CurrentUserProfile
  association: AssociationProfile
}>()
const {
  isEditing, isSaving, saveErrorMessage, saveSuccessMessage, isAddingLocation,
  isSavingLocation, editingLocationId, isUpdatingLocation, deletingLocationId,
  locationErrorMessage, locationSuccessMessage, editForm, locationForm,
  startEditing, cancelEditing, saveAssociation, startAddingLocation, cancelAddingLocation,
  startEditingLocation, cancelEditingLocation, saveStorageLocation, saveEditedStorageLocation,
  removeStorageLocation,
} = state
</script>

<template>
  <div id="generelt">
    <form id="association-info-form" @submit.prevent="saveAssociation">
      <section
        class="border-b border-[#e2e0e0] pt-10 pb-12 max-[700px]:py-8"
        aria-labelledby="contacts-heading"
      >
        <div class="mb-6 flex items-center justify-between gap-4">
          <h2 id="contacts-heading" class="text-2xl font-bold text-brand">
            Kontaktoplysninger
          </h2>
          <button
            v-if="profile.role === 'associationAdmin' && !isEditing"
            class="shrink-0 cursor-pointer text-base text-brand underline underline-offset-2 hover:text-[#7d0202] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            type="button"
            @click="startEditing"
          >
            Redigér
          </button>
        </div>
        <dl class="grid grid-cols-[7fr_6fr_4fr] gap-8 max-[700px]:grid-cols-1">
          <div v-if="isEditing" class="col-span-3 max-[700px]:col-span-1">
            <dt class="mb-1.5 text-base text-gray-medium">
              <label for="association-name">Forening</label>
            </dt>
            <input
              id="association-name"
              v-model.trim="editForm.name"
              class="h-11 w-full rounded border border-gray-light px-3 text-base focus-visible:outline-2 focus-visible:outline-brand"
              name="associationName"
              maxlength="120"
              required
            />
          </div>
          <div>
            <dt class="mb-1.5 text-base text-gray-medium">
              <label for="association-contact-name">Kontaktperson</label>
            </dt>
            <dd v-if="!isEditing" class="text-lg">
              {{ association.contactPerson?.name || 'Ikke angivet' }}
            </dd>
            <input
              v-else
              id="association-contact-name"
              v-model.trim="editForm.contactPersonName"
              class="h-11 w-full rounded border border-gray-light px-3 text-base focus-visible:outline-2 focus-visible:outline-brand"
              name="contactName"
              maxlength="120"
              required
            />
          </div>
          <div>
            <dt class="mb-1.5 text-base text-gray-medium">
              <label for="association-contact-email">E-mail</label>
            </dt>
            <dd v-if="!isEditing" class="text-lg">
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
              class="h-11 w-full rounded border border-gray-light px-3 text-base focus-visible:outline-2 focus-visible:outline-brand"
              name="contactEmail"
              type="email"
              maxlength="254"
              required
            />
          </div>
          <div>
            <dt class="mb-1.5 text-base text-gray-medium">
              <label for="association-contact-phone">Telefon</label>
            </dt>
            <dd v-if="!isEditing" class="text-lg">
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
              class="h-11 w-full rounded border border-gray-light px-3 text-base focus-visible:outline-2 focus-visible:outline-brand"
              name="contactPhone"
              type="tel"
              maxlength="50"
            />
          </div>
        </dl>
        <p class="mt-6 text-sm text-gray-medium">
          Kontaktoplysningerne vises under Teaterforeninger.
        </p>
      </section>
      <div v-if="isEditing" class="flex flex-wrap items-center gap-3 pt-5">
        <button
          class="h-11 rounded-[4px] border-0 bg-brand px-5 text-base font-semibold text-white hover:bg-[#7d0202] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
          :disabled="isSaving"
        >
          {{ isSaving ? 'Gemmer…' : 'Gem ændringer' }}
        </button>
        <button
          class="h-10 rounded border border-gray-light px-4 text-base"
          type="button"
          :disabled="isSaving"
          @click="cancelEditing"
        >
          Annullér
        </button>
      </div>
      <p v-if="saveErrorMessage" class="border-b border-[#e2e0e0] py-4 text-base text-brand" role="alert">
        {{ saveErrorMessage }}
      </p>
      <p v-if="saveSuccessMessage" class="border-b border-[#e2e0e0] py-4 text-base text-green-700" role="status">
        {{ saveSuccessMessage }}
      </p>
    </form>

    <section class="py-8" aria-labelledby="warehouses-heading">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-5">
        <div>
          <h2 id="warehouses-heading" class="text-2xl font-bold text-brand">
            Lageradresser
          </h2>
          <p class="mt-2 text-sm text-gray-medium">
            Vælg et lager, når du registrerer en rekvisit.
          </p>
        </div>
        <button
          v-if="profile.role === 'associationAdmin' && !isAddingLocation && !editingLocationId"
          class="h-11 shrink-0 rounded-[4px] border-0 bg-brand px-5 text-base font-semibold text-white hover:bg-[#7d0202] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          @click="startAddingLocation"
        >
          + Tilføj lager
        </button>
      </div>
      <form
        v-if="isAddingLocation"
        id="storage-location-form"
        class="mb-5 grid max-w-4xl gap-4 rounded border border-[#e2e0e0] p-5 sm:grid-cols-3"
        @submit.prevent="saveStorageLocation"
      >
        <label class="grid gap-2 text-sm text-gray-medium" for="storage-address">
          Adresse
          <input
            id="storage-address"
            v-model.trim="locationForm.address"
            class="h-11 rounded border border-gray-light px-3 text-base text-gray-dark focus-visible:outline-2 focus-visible:outline-brand"
            name="address"
            maxlength="200"
            autocomplete="street-address"
            required
          />
        </label>
        <label class="grid gap-2 text-sm text-gray-medium" for="storage-postal-code">
          Postnummer
          <input
            id="storage-postal-code"
            v-model.trim="locationForm.postalCode"
            class="h-11 rounded border border-gray-light px-3 text-base text-gray-dark focus-visible:outline-2 focus-visible:outline-brand"
            name="postalCode"
            maxlength="20"
            autocomplete="postal-code"
            required
          />
        </label>
        <label class="grid gap-2 text-sm text-gray-medium" for="storage-city">
          By
          <input
            id="storage-city"
            v-model.trim="locationForm.city"
            class="h-11 rounded border border-gray-light px-3 text-base text-gray-dark focus-visible:outline-2 focus-visible:outline-brand"
            name="city"
            maxlength="100"
            autocomplete="address-level2"
            required
          />
        </label>
        <div class="flex flex-wrap gap-3 sm:col-span-3">
          <button
            class="h-11 rounded-[4px] border-0 bg-brand px-5 text-base font-semibold text-white hover:bg-[#7d0202] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            :disabled="isSavingLocation"
          >
            {{ isSavingLocation ? 'Gemmer…' : 'Gem lageradresse' }}
          </button>
          <button
            class="h-11 rounded border border-gray-light px-4 text-base disabled:opacity-60"
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
        class="mb-4 text-lg text-brand"
        role="alert"
      >
        {{ locationErrorMessage }}
      </p>
      <p
        v-if="locationSuccessMessage"
        class="mb-4 text-lg text-green-700"
        role="status"
      >
        {{ locationSuccessMessage }}
      </p>
      <ul v-if="association.storageLocations.length" aria-label="Foreningens lageradresser">
        <li
          v-for="location in association.storageLocations"
          :key="location.id"
          class="flex items-center gap-4 border-b border-[#e2e0e0] py-5"
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
            class="grid w-full min-w-0 gap-4 sm:flex-1 sm:grid-cols-3"
            :aria-label="`Redigér lageradresse ${location.address}`"
            @submit.prevent="saveEditedStorageLocation"
          >
            <label class="grid gap-2 text-sm text-gray-medium">
              Adresse
              <input
                v-model.trim="locationForm.address"
                class="h-11 rounded border border-gray-light px-3 text-base text-gray-dark focus-visible:outline-2 focus-visible:outline-brand"
                name="editAddress"
                maxlength="200"
                required
              />
            </label>
            <label class="grid gap-2 text-sm text-gray-medium">
              Postnummer
              <input
                v-model.trim="locationForm.postalCode"
                class="h-11 rounded border border-gray-light px-3 text-base text-gray-dark focus-visible:outline-2 focus-visible:outline-brand"
                name="editPostalCode"
                maxlength="20"
                required
              />
            </label>
            <label class="grid gap-2 text-sm text-gray-medium">
              By
              <input
                v-model.trim="locationForm.city"
                class="h-11 rounded border border-gray-light px-3 text-base text-gray-dark focus-visible:outline-2 focus-visible:outline-brand"
                name="editCity"
                maxlength="100"
                required
              />
            </label>
            <div class="flex flex-wrap gap-3 sm:col-span-3">
              <button
                class="h-11 rounded-[4px] border-0 bg-brand px-5 text-base font-semibold text-white hover:bg-[#7d0202] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
                :disabled="isUpdatingLocation"
              >
                {{ isUpdatingLocation ? 'Gemmer…' : 'Gem adresse' }}
              </button>
              <button
                class="h-11 rounded border border-gray-light px-4 text-base disabled:opacity-60"
                type="button"
                :disabled="isUpdatingLocation"
                @click="cancelEditingLocation"
              >
                Annullér
              </button>
            </div>
          </form>
          <div v-else class="min-w-0 flex-1">
            <p class="text-lg font-medium">{{ location.address }}</p>
            <p class="mt-1 text-lg text-gray-medium">
              {{ location.postalCode }} {{ location.city }}
            </p>
          </div>
          <div
            v-if="profile.role === 'associationAdmin' && !isAddingLocation && !editingLocationId"
            class="flex shrink-0 gap-4"
          >
            <button
              class="cursor-pointer text-base text-brand underline underline-offset-2 hover:text-[#7d0202] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              :disabled="deletingLocationId !== null"
              @click="startEditingLocation(location.id)"
            >
              Redigér
            </button>
            <button
              class="cursor-pointer text-base text-brand underline underline-offset-2 hover:text-[#7d0202] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              :disabled="deletingLocationId !== null"
              @click="removeStorageLocation(location.id)"
            >
              {{ deletingLocationId === location.id ? 'Fjerner…' : 'Fjern' }}
            </button>
          </div>
        </li>
      </ul>
      <p v-else class="border-b border-[#e2e0e0] py-6 text-base text-gray-medium">
        Der er endnu ikke tilføjet nogen lageradresser.
      </p>
    </section>
  </div>
</template>

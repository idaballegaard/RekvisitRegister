<script setup lang="ts">
import type { usePropDetail } from '../../../composables/admin/usePropDetail'
import ReservationFields from './ReservationFields.vue'

const { state, isCreating } = defineProps<{
  state: ReturnType<typeof usePropDetail>
  isCreating: boolean
}>()
const {
  association, isSaving, createdPropId, editForm, isUpdatingImage,
  saveErrorMessage, openCreatedProp, saveProp, cancelEditing,
} = state
</script>

<template>
  <form class="mt-5 grid gap-5" @submit.prevent="saveProp">
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
    <ReservationFields :state="state" />
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
</template>

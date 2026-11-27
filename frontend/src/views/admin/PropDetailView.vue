<script setup lang="ts">
import AdminLayout from '../../components/admin/AdminLayout.vue'
import type { AdminTab } from '../../composables/admin/adminTypes'
import { usePropDetail } from '../../composables/admin/usePropDetail'
import PropForm from '../../components/admin/props/PropForm.vue'
import PropImages from '../../components/admin/props/PropImages.vue'
import PropReservations from '../../components/admin/props/PropReservations.vue'
import DeletePropDialog from '../../components/admin/props/DeletePropDialog.vue'

const viewProps = defineProps<{ mode?: 'create' }>()
const isCreating = viewProps.mode === 'create'
const state = usePropDetail(isCreating)
const {
  profile, association, isLoading, errorMessage, isEditing, isDeleting, deleteErrorMessage,
  prop, openDeleteConfirmation, startEditing, getStorageLocationLabel,
  saveSuccessMessage, isDeleteConfirmationOpen, backToProps, openGeneralTab, openLoansTab,
} = state

function selectTab(tab: AdminTab): void {
  if (tab === 'general') void openGeneralTab()
  else if (tab === 'props') void backToProps()
  else if (tab === 'loans') void openLoansTab()
}
</script>

<template>
  <AdminLayout
    :profile="profile"
    :association-name="association?.name"
    active-tab="props"
    prop-page
    @select-tab="selectTab"
  >
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
        <PropForm v-if="isEditing" :state="state" :is-creating="isCreating" />
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
      <PropImages :state="state" :is-creating="isCreating" />
    </article>
    <PropReservations v-if="!isCreating && prop" :state="state" />
    <p v-if="saveSuccessMessage" class="mt-5 text-base text-green-800" role="status">
      {{ saveSuccessMessage }}
    </p>

    <DeletePropDialog v-if="isDeleteConfirmationOpen && prop" :state="state" />
  </AdminLayout>
</template>

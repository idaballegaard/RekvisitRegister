<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { usePropDetail } from '../../../composables/admin/usePropDetail'

const { state } = defineProps<{ state: ReturnType<typeof usePropDetail> }>()
const { prop, closeDeleteConfirmation, handleDeleteDialogKeydown, isDeleting, deleteProp } = state
const cancelDeleteButton = ref<HTMLButtonElement | null>(null)
onMounted(() => cancelDeleteButton.value?.focus())
</script>

<template>
  <div
    v-if="prop"
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
</template>

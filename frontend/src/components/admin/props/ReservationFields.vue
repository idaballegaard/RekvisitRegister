<script setup lang="ts">
import type { usePropDetail } from '../../../composables/admin/usePropDetail'

const { state } = defineProps<{
  state: ReturnType<typeof usePropDetail>
}>()
const { reservationStartDate, reservationEndDate } = state
</script>

<template>
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
</template>

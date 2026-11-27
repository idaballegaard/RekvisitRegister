<script setup lang="ts">
import type { usePropDetail } from '../../../composables/admin/usePropDetail'

const { state } = defineProps<{
  state: ReturnType<typeof usePropDetail>
}>()
const {
  isLoadingReservations, reservationsLoadErrorMessage, reservationErrorMessage, reservations,
  formatReservationDate, isUpdatingReservation, removeReservation,
} = state
</script>

<template>
  <section
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
</template>

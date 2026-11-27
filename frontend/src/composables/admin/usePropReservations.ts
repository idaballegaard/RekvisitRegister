import { ref } from 'vue'
import type { Ref } from 'vue'
import type { Router } from 'vue-router'
import type { AssociationProp } from '../../services/association.service'
import { UnauthorizedError } from '../../services/auth.service'
import { deleteCurrentPropReservation, type AssociationReservation } from '../../services/association.service'

export function usePropReservations(prop: Ref<AssociationProp | null>, router: Router) {
  const reservations = ref<AssociationReservation[]>([])
  const isLoadingReservations = ref(false)
  const reservationsLoadErrorMessage = ref('')
  const isUpdatingReservation = ref(false)
  const reservationErrorMessage = ref('')
  const reservationStartDate = ref('')
  const reservationEndDate = ref('')

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

  return {
    reservations, isLoadingReservations, reservationsLoadErrorMessage, isUpdatingReservation,
    reservationErrorMessage, reservationStartDate, reservationEndDate,
    formatReservationDate, getReservationInputError, removeReservation,
  }
}

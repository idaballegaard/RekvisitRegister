import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePropImages } from './usePropImages'
import { usePropReservations } from './usePropReservations'
import { usePropDeletion } from './usePropDeletion'
import {
  createCurrentAssociationProp,
  createCurrentPropReservation,
  getCurrentAssociation,
  getCurrentAssociationProps,
  getCurrentPropReservations,
  uploadPropImage,
  updateCurrentAssociationProp,
  type AssociationProfile,
  type AssociationProp,
} from '../../services/association.service'
import {
  getCurrentUser,
  UnauthorizedError,
  type CurrentUserProfile,
} from '../../services/auth.service'

export function usePropDetail(isCreating: boolean) {
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
  const {
    imageIndex, isUpdatingImage, imageErrorMessage, imageSuccessMessage, selectedImages,
    currentImageId, selectImages, removeSelectedImage, uploadImage, removeImage,
  } = usePropImages(prop, router)
  const {
    reservations, isLoadingReservations, reservationsLoadErrorMessage, isUpdatingReservation,
    reservationErrorMessage, reservationStartDate, reservationEndDate,
    formatReservationDate, getReservationInputError, removeReservation,
  } = usePropReservations(prop, router)
  const {
    isDeleting, deleteErrorMessage, isDeleteConfirmationOpen, openDeleteConfirmation,
    closeDeleteConfirmation, handleDeleteDialogKeydown, deleteProp,
  } = usePropDeletion(prop, profile, router, backToProps)
  function getStorageLocationLabel(locationId: string): string {
    const location = association.value?.storageLocations.find(({ id }) => id === locationId)
    return location
      ? `${location.address}, ${location.postalCode} ${location.city}`
      : 'Lageradresse ikke fundet'
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
  return {
    profile,
    association,
    isLoading,
    errorMessage,
    isEditing,
    isSaving,
    createdPropId,
    saveErrorMessage,
    saveSuccessMessage,
    imageIndex,
    isUpdatingImage,
    imageErrorMessage,
    imageSuccessMessage,
    reservations,
    isLoadingReservations,
    reservationsLoadErrorMessage,
    isUpdatingReservation,
    reservationErrorMessage,
    reservationStartDate,
    reservationEndDate,
    isDeleting,
    deleteErrorMessage,
    isDeleteConfirmationOpen,
    selectedImages,
    editForm,
    prop,
    currentImageId,
    getStorageLocationLabel,
    formatReservationDate,
    removeReservation,
    selectImages,
    removeSelectedImage,
    uploadImage,
    removeImage,
    openDeleteConfirmation,
    closeDeleteConfirmation,
    handleDeleteDialogKeydown,
    deleteProp,
    startEditing,
    cancelEditing,
    saveProp,
    openCreatedProp,
    backToProps,
    openGeneralTab,
    openLoansTab,
  }
}

import { reactive, ref, type Ref } from 'vue'
import type { Router } from 'vue-router'
import {
  createAssociationStorageLocation,
  deleteAssociationStorageLocation,
  updateAssociationStorageLocation,
  updateCurrentAssociation,
  type AssociationProfile,
} from '../../services/association.service'
import { UnauthorizedError, type CurrentUserProfile } from '../../services/auth.service'

export function useAssociationGeneral(
  association: Ref<AssociationProfile | null>,
  profile: Ref<CurrentUserProfile | null>,
  router: Router,
) {
  const isEditing = ref(false)
  const isSaving = ref(false)
  const saveErrorMessage = ref('')
  const saveSuccessMessage = ref('')
  const isAddingLocation = ref(false)
  const isSavingLocation = ref(false)
  const editingLocationId = ref<string | null>(null)
  const isUpdatingLocation = ref(false)
  const deletingLocationId = ref<string | null>(null)
  const locationErrorMessage = ref('')
  const locationSuccessMessage = ref('')
  const editForm = reactive({
    name: '',
    contactPersonName: '',
    contactPersonEmail: '',
    contactPersonPhone: '',
  })
  const locationForm = reactive({
    address: '',
    postalCode: '',
    city: '',
  })

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

  function startAddingLocation(): void {
    if (profile.value?.role !== 'associationAdmin') {
      return
    }
    locationForm.address = ''
    locationForm.postalCode = ''
    locationForm.city = ''
    locationErrorMessage.value = ''
    locationSuccessMessage.value = ''
    isAddingLocation.value = true
  }

  function cancelAddingLocation(): void {
    isAddingLocation.value = false
    locationErrorMessage.value = ''
  }

  function startEditingLocation(locationId: string): void {
    if (profile.value?.role !== 'associationAdmin' || !association.value) {
      return
    }
    const location = association.value.storageLocations.find(({ id }) => id === locationId)
    if (!location) {
      return
    }
    locationForm.address = location.address
    locationForm.postalCode = location.postalCode
    locationForm.city = location.city
    locationErrorMessage.value = ''
    locationSuccessMessage.value = ''
    editingLocationId.value = locationId
  }

  function cancelEditingLocation(): void {
    editingLocationId.value = null
    locationErrorMessage.value = ''
  }

  async function saveStorageLocation(): Promise<void> {
    if (profile.value?.role !== 'associationAdmin') {
      return
    }
    locationErrorMessage.value = ''
    locationSuccessMessage.value = ''
    isSavingLocation.value = true
    try {
      association.value = await createAssociationStorageLocation({
        address: locationForm.address,
        postalCode: locationForm.postalCode,
        city: locationForm.city,
      })
      isAddingLocation.value = false
      locationSuccessMessage.value = 'Lageradressen er tilføjet.'
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        await router.replace({ name: 'login' })
        return
      }
      locationErrorMessage.value = error instanceof Error
        ? error.message
        : 'Lageradressen kunne ikke tilføjes.'
    } finally {
      isSavingLocation.value = false
    }
  }

  async function saveEditedStorageLocation(): Promise<void> {
    const locationId = editingLocationId.value
    if (profile.value?.role !== 'associationAdmin' || !locationId) {
      return
    }
    locationErrorMessage.value = ''
    locationSuccessMessage.value = ''
    isUpdatingLocation.value = true
    try {
      association.value = await updateAssociationStorageLocation(locationId, {
        address: locationForm.address,
        postalCode: locationForm.postalCode,
        city: locationForm.city,
      })
      editingLocationId.value = null
      locationSuccessMessage.value = 'Lageradressen er opdateret.'
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        await router.replace({ name: 'login' })
        return
      }
      locationErrorMessage.value = error instanceof Error
        ? error.message
        : 'Lageradressen kunne ikke opdateres.'
    } finally {
      isUpdatingLocation.value = false
    }
  }

  async function removeStorageLocation(locationId: string): Promise<void> {
    if (
      profile.value?.role !== 'associationAdmin'
      || !association.value
      || !window.confirm('Er du sikker på, at du vil fjerne denne lageradresse?')
    ) {
      return
    }
    locationErrorMessage.value = ''
    locationSuccessMessage.value = ''
    deletingLocationId.value = locationId
    try {
      association.value = await deleteAssociationStorageLocation(locationId)
      if (editingLocationId.value === locationId) {
        editingLocationId.value = null
      }
      locationSuccessMessage.value = 'Lageradressen er fjernet.'
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        await router.replace({ name: 'login' })
        return
      }
      locationErrorMessage.value = error instanceof Error
        ? error.message
        : 'Lageradressen kunne ikke fjernes.'
    } finally {
      deletingLocationId.value = null
    }
  }
  return {
    isEditing, isSaving, saveErrorMessage, saveSuccessMessage, isAddingLocation,
    isSavingLocation, editingLocationId, isUpdatingLocation, deletingLocationId,
    locationErrorMessage, locationSuccessMessage, editForm, locationForm,
    startEditing, cancelEditing, saveAssociation, startAddingLocation, cancelAddingLocation,
    startEditingLocation, cancelEditingLocation, saveStorageLocation, saveEditedStorageLocation,
    removeStorageLocation,
  }
}

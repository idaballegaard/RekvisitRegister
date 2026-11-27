import { nextTick, ref } from 'vue'
import type { Ref } from 'vue'
import type { Router } from 'vue-router'
import type { AssociationProp } from '../../services/association.service'
import { UnauthorizedError } from '../../services/auth.service'
import { deleteCurrentAssociationProp } from '../../services/association.service'
import type { CurrentUserProfile } from '../../services/auth.service'

export function usePropDeletion(
  prop: Ref<AssociationProp | null>,
  profile: Ref<CurrentUserProfile | null>,
  router: Router,
  backToProps: () => Promise<void>,
) {
  const isDeleting = ref(false)
  const deleteErrorMessage = ref('')
  const isDeleteConfirmationOpen = ref(false)
  let deleteTrigger: HTMLElement | null = null

  function openDeleteConfirmation(event: MouseEvent): void {
    if (!prop.value || !['associationAdmin', 'propManager'].includes(profile.value?.role ?? '')) {
      return
    }
    deleteTrigger = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
    isDeleteConfirmationOpen.value = true
  }

  async function closeDeleteConfirmation(): Promise<void> {
    isDeleteConfirmationOpen.value = false
    await nextTick()
    deleteTrigger?.focus()
    deleteTrigger = null
  }

  function handleDeleteDialogKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault()
      void closeDeleteConfirmation()
      return
    }
    if (event.key !== 'Tab') {
      return
    }
    const buttons = Array.from(
      event.currentTarget instanceof HTMLElement
        ? event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
        : [],
    )
    const firstButton = buttons[0]
    const lastButton = buttons[buttons.length - 1]
    if (event.shiftKey && document.activeElement === firstButton) {
      event.preventDefault()
      lastButton?.focus()
    } else if (!event.shiftKey && document.activeElement === lastButton) {
      event.preventDefault()
      firstButton?.focus()
    }
  }

  async function deleteProp(): Promise<void> {
    if (!prop.value || !['associationAdmin', 'propManager'].includes(profile.value?.role ?? '')
      || isDeleting.value) {
      return
    }
    isDeleting.value = true
    deleteErrorMessage.value = ''
    try {
      await deleteCurrentAssociationProp(prop.value.id)
      isDeleteConfirmationOpen.value = false
      await backToProps()
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        await router.replace({ name: 'login' })
        return
      }
      deleteErrorMessage.value = error instanceof Error
        ? error.message
        : 'Rekvisitten kunne ikke slettes.'
      await closeDeleteConfirmation()
    } finally {
      isDeleting.value = false
    }
  }

  return {
    isDeleting, deleteErrorMessage, isDeleteConfirmationOpen, openDeleteConfirmation,
    closeDeleteConfirmation, handleDeleteDialogKeydown, deleteProp,
  }
}

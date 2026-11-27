import { reactive, ref, type Ref } from 'vue'
import type { Router } from 'vue-router'
import { createCurrentAssociationUser, getCurrentAssociationUsers, resendCurrentAssociationUserInvitation, type AssociationUser } from '../../services/association.service'
import { UnauthorizedError, type CurrentUserProfile } from '../../services/auth.service'
import type { AdminTab } from './adminTypes'

export function useAssociationUsers(
  profile: Ref<CurrentUserProfile | null>,
  activeTab: Ref<AdminTab>,
  router: Router,
) {
  const associationUsers = ref<AssociationUser[] | null>(null)
  const isLoadingUsers = ref(false)
  const usersErrorMessage = ref('')
  const userInvitationErrorMessage = ref('')
  const userInvitationSuccessMessage = ref('')
  const isInvitingUser = ref(false)
  const resendingUserId = ref<string | null>(null)
  const userInvitationForm = reactive({
    firstName: '',
    lastName: '',
    userName: '',
    email: '',
    role: 'propManager' as 'propManager' | 'searchUser',
  })

  async function openUsersTab(): Promise<void> {
    if (profile.value?.role !== 'associationAdmin') {
      return
    }
    activeTab.value = 'users'
    if (associationUsers.value !== null || isLoadingUsers.value) {
      return
    }
    usersErrorMessage.value = ''
    isLoadingUsers.value = true
    try {
      associationUsers.value = await getCurrentAssociationUsers()
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        await router.replace({ name: 'login' })
        return
      }
      usersErrorMessage.value = error instanceof Error
        ? error.message
        : 'Foreningens brugere kunne ikke hentes.'
    } finally {
      isLoadingUsers.value = false
    }
  }

  async function inviteUser(): Promise<void> {
    if (profile.value?.role !== 'associationAdmin') {
      return
    }
    userInvitationErrorMessage.value = ''
    userInvitationSuccessMessage.value = ''
    isInvitingUser.value = true
    try {
      const user = await createCurrentAssociationUser({
        firstName: userInvitationForm.firstName,
        lastName: userInvitationForm.lastName,
        userName: userInvitationForm.userName,
        email: userInvitationForm.email,
        role: userInvitationForm.role,
      })
      associationUsers.value = [...(associationUsers.value ?? []), user]
        .sort((left, right) => `${left.firstName} ${left.lastName}`
          .localeCompare(`${right.firstName} ${right.lastName}`, 'da'))
      userInvitationForm.firstName = ''
      userInvitationForm.lastName = ''
      userInvitationForm.userName = ''
      userInvitationForm.email = ''
      userInvitationForm.role = 'propManager'
      userInvitationSuccessMessage.value = 'Invitationen er sendt. Brugeren kan aktivere sin konto via e-mailen.'
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        await router.replace({ name: 'login' })
        return
      }
      userInvitationErrorMessage.value = error instanceof Error
        ? error.message
        : 'Brugeren kunne ikke inviteres.'
    } finally {
      isInvitingUser.value = false
    }
  }

  async function resendUserInvitation(userId: string): Promise<void> {
    if (profile.value?.role !== 'associationAdmin' || resendingUserId.value) {
      return
    }
    userInvitationErrorMessage.value = ''
    userInvitationSuccessMessage.value = ''
    resendingUserId.value = userId
    try {
      await resendCurrentAssociationUserInvitation(userId)
      userInvitationSuccessMessage.value = 'Invitationen er sendt igen.'
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        await router.replace({ name: 'login' })
        return
      }
      userInvitationErrorMessage.value = error instanceof Error
        ? error.message
        : 'Invitationen kunne ikke sendes igen.'
    } finally {
      resendingUserId.value = null
    }
  }
  return {
    associationUsers, isLoadingUsers, usersErrorMessage, userInvitationErrorMessage,
    userInvitationSuccessMessage, isInvitingUser, resendingUserId, userInvitationForm,
    openUsersTab, inviteUser, resendUserInvitation,
  }
}

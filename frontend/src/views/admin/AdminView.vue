<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AdminLayout from '../../components/admin/AdminLayout.vue'
import { roleNames } from '../../composables/admin/roleNames'
import GeneralView from './GeneralView.vue'
import LoansView from './LoansView.vue'
import PropsView from './PropsView.vue'
import UsersView from './UsersView.vue'
import { useAssociationGeneral } from '../../composables/admin/useAssociationGeneral'
import { useAssociationProps } from '../../composables/admin/useAssociationProps'
import { useAssociationUsers } from '../../composables/admin/useAssociationUsers'
import type { AdminTab } from '../../composables/admin/adminTypes'
import {
  getCurrentAssociation,
  type AssociationProfile,
} from '../../services/association.service'
import {
  getCurrentUser,
  UnauthorizedError,
  type CurrentUserProfile,
} from '../../services/auth.service'

const router = useRouter()
const route = useRoute()
const profile = ref<CurrentUserProfile | null>(null)
const association = ref<AssociationProfile | null>(null)
const activeTab = ref<AdminTab>('general')
const generalState = useAssociationGeneral(association, profile, router)
const propsState = useAssociationProps(association, activeTab, router)
const usersState = useAssociationUsers(profile, activeTab, router)
const { propSearch, openPropsTab } = propsState
const { openUsersTab } = usersState
const isLoading = ref(true)
const errorMessage = ref('')
function openGeneralTab(): void {
  activeTab.value = 'general'
}

function openLoansTab(): void {
  if (profile.value?.role === 'associationAdmin' || profile.value?.role === 'propManager') {
    activeTab.value = 'loans'
  }
}

function selectTab(tab: AdminTab): void {
  if (tab === 'general') openGeneralTab()
  else if (tab === 'props') void openPropsTab()
  else if (tab === 'users') void openUsersTab()
  else openLoansTab()
}

onMounted(async () => {
  try {
    const currentUser = await getCurrentUser()
    if (currentUser.role === 'searchUser') {
      await router.replace({ name: 'profile' })
      return
    }
    profile.value = currentUser
    association.value = await getCurrentAssociation()
    if (route.query.tab === 'loans') {
      openLoansTab()
    } else if (currentUser.role === 'propManager' || route.query.tab === 'props') {
      propSearch.value = typeof route.query.q === 'string' ? route.query.q : ''
      await openPropsTab()
    } else if (currentUser.role === 'associationAdmin' && route.query.tab === 'users') {
      await openUsersTab()
    }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      await router.replace({ name: 'login' })
      return
    }
    errorMessage.value = error instanceof Error
      ? error.message
      : 'Adminpanelet kunne ikke hentes.'
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <AdminLayout
    :profile="profile"
    :association-name="association?.name"
    :active-tab="activeTab"
    @select-tab="selectTab"
  >
    <template #header-status>
      <p v-if="isLoading" class="mt-4 text-sm text-gray-medium" role="status">
        Henter foreningsoplysninger…
      </p>
      <p v-else-if="errorMessage" class="mt-4 text-base text-brand" role="alert">
        {{ errorMessage }}
      </p>
    </template>

    <GeneralView
      v-if="profile && association && activeTab === 'general'"
      :state="generalState"
      :profile="profile"
      :association="association"
    />

    <LoansView v-if="profile && activeTab === 'loans'" :can-manage-decisions="profile.role === 'associationAdmin'" />

    <UsersView
      v-if="profile?.role === 'associationAdmin' && activeTab === 'users'"
      :state="usersState"
      :role-names="roleNames"
    />
    <PropsView
      v-if="profile && association && activeTab === 'props'"
      :state="propsState"
      :profile="profile"
    />
  </AdminLayout>
</template>

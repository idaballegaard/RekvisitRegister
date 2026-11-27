<script setup lang="ts">
import type { CurrentUserProfile } from '../../services/auth.service'
import type { useAssociationUsers } from '../../composables/admin/useAssociationUsers'

const { state, roleNames } = defineProps<{
  state: ReturnType<typeof useAssociationUsers>
  roleNames: Record<CurrentUserProfile['role'], string>
}>()
const {
  associationUsers, isLoadingUsers, usersErrorMessage, userInvitationErrorMessage,
  userInvitationSuccessMessage, isInvitingUser, resendingUserId, userInvitationForm,
  inviteUser, resendUserInvitation,
} = state
</script>

<template>
  <section
    class="py-10"
    aria-labelledby="users-heading"
  >
    <div class="mb-7">
      <h2 id="users-heading" class="text-2xl font-bold text-brand">Brugere</h2>
      <p class="mt-2 text-base text-gray-medium">
        Se foreningens brugere, og invitér nye brugere til at oprette deres adgangskode.
      </p>
    </div>

    <form
      id="association-user-form"
      class="mb-8 grid max-w-4xl gap-4 rounded border border-[#e2e0e0] p-5 sm:grid-cols-2"
      @submit.prevent="inviteUser"
    >
      <h3 class="text-lg font-bold text-brand sm:col-span-2">Invitér en bruger</h3>
      <label class="grid gap-2 text-sm text-gray-medium" for="user-first-name">
        Fornavn
        <input
          id="user-first-name"
          v-model.trim="userInvitationForm.firstName"
          class="h-11 rounded border border-gray-light px-3 text-base text-gray-dark focus-visible:outline-2 focus-visible:outline-brand"
          maxlength="120"
          autocomplete="given-name"
          required
        />
      </label>
      <label class="grid gap-2 text-sm text-gray-medium" for="user-last-name">
        Efternavn
        <input
          id="user-last-name"
          v-model.trim="userInvitationForm.lastName"
          class="h-11 rounded border border-gray-light px-3 text-base text-gray-dark focus-visible:outline-2 focus-visible:outline-brand"
          maxlength="120"
          autocomplete="family-name"
          required
        />
      </label>
      <label class="grid gap-2 text-sm text-gray-medium" for="user-user-name">
        Brugernavn
        <input
          id="user-user-name"
          v-model.trim="userInvitationForm.userName"
          class="h-11 rounded border border-gray-light px-3 text-base text-gray-dark focus-visible:outline-2 focus-visible:outline-brand"
          minlength="3"
          maxlength="32"
          autocomplete="off"
          required
        />
      </label>
      <label class="grid gap-2 text-sm text-gray-medium" for="user-email">
        E-mail
        <input
          id="user-email"
          v-model.trim="userInvitationForm.email"
          type="email"
          class="h-11 rounded border border-gray-light px-3 text-base text-gray-dark focus-visible:outline-2 focus-visible:outline-brand"
          maxlength="254"
          autocomplete="email"
          required
        />
      </label>
      <label class="grid gap-2 text-sm text-gray-medium" for="user-role">
        Rolle
        <select
          id="user-role"
          v-model="userInvitationForm.role"
          class="h-11 rounded border border-gray-light px-3 text-base text-gray-dark focus-visible:outline-2 focus-visible:outline-brand"
        >
          <option value="propManager">Rekvisitansvarlig</option>
          <option value="searchUser">Søgebruger</option>
        </select>
      </label>
      <p class="self-end text-sm text-gray-medium">
        Brugeren får en e-mail med et link, der udløber efter 24 timer, og vælger selv sin adgangskode.
      </p>
      <p
        v-if="userInvitationErrorMessage"
        class="text-sm text-brand sm:col-span-2"
        role="alert"
      >
        {{ userInvitationErrorMessage }}
      </p>
      <p
        v-if="userInvitationSuccessMessage"
        class="text-sm text-green-700 sm:col-span-2"
        role="status"
      >
        {{ userInvitationSuccessMessage }}
      </p>
      <button
        class="h-11 w-fit rounded-[4px] bg-brand px-5 text-base font-semibold text-white hover:bg-[#7d0202] disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2"
        type="submit"
        :disabled="isInvitingUser"
      >
        {{ isInvitingUser ? 'Sender invitation…' : 'Send invitation' }}
      </button>
    </form>

    <p v-if="isLoadingUsers" class="py-6 text-base text-gray-medium" role="status">
      Henter brugere…
    </p>
    <p v-else-if="usersErrorMessage" class="py-4 text-base text-brand" role="alert">
      {{ usersErrorMessage }}
    </p>
    <p v-else-if="associationUsers?.length === 0" class="py-6 text-base text-gray-medium">
      Der er endnu ikke registreret brugere i foreningen.
    </p>
    <ul v-else-if="associationUsers" class="grid gap-3" aria-label="Foreningens brugere">
      <li
        v-for="user in associationUsers"
        :key="user.id"
        class="flex flex-wrap items-center justify-between gap-3 rounded border border-[#e2e0e0] p-4"
      >
        <div>
          <h3 class="font-semibold">{{ user.firstName }} {{ user.lastName }}</h3>
          <p class="text-sm text-gray-medium">
            {{ user.userName }} · {{ user.email }}
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-3 text-sm">
          <span>{{ roleNames[user.role] }}</span>
          <span
            class="rounded-full px-3 py-1 font-semibold"
            :class="user.status === 'active'
              ? 'bg-green-50 text-green-800'
              : 'bg-amber-50 text-amber-800'"
          >
            {{
              user.status === 'active'
                ? 'Aktiv'
                : user.status === 'pending'
                  ? 'Afventer aktivering'
                  : 'E-mail ikke bekræftet'
            }}
          </span>
          <button
            v-if="user.status === 'pending'"
            class="text-brand underline underline-offset-2 disabled:opacity-60"
            type="button"
            :disabled="isInvitingUser || resendingUserId !== null"
            @click="resendUserInvitation(user.id)"
          >
            {{ resendingUserId === user.id ? 'Sender…' : 'Send invitation igen' }}
          </button>
        </div>
      </li>
    </ul>
  </section>
</template>

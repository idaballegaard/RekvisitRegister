<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { confirmEmail } from '../services/auth.service'

const route = useRoute()
const router = useRouter()
const isConfirming = ref(false)
const isConfirmed = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

async function submitConfirmation(): Promise<void> {
  errorMessage.value = ''
  isConfirming.value = true
  const token = typeof route.query.token === 'string' ? route.query.token : ''
  if (!token) {
    errorMessage.value = 'Bekræftelseslinket mangler eller er ugyldigt.'
    isConfirming.value = false
    return
  }

  try {
    await confirmEmail(token)
    isConfirmed.value = true
    successMessage.value = 'Din e-mailadresse er nu bekræftet.'
  } catch (error) {
    errorMessage.value = error instanceof Error
      ? error.message
      : 'E-mailadressen kunne ikke bekræftes.'
  } finally {
    isConfirming.value = false
  }
}
</script>

<template>
  <main class="grid min-h-screen min-h-[100svh] place-items-center bg-white px-6 font-sans text-gray-dark">
    <section class="w-full max-w-[340px]" aria-labelledby="verify-heading">
      <p class="mb-3 text-[11px] font-bold text-brand uppercase">Rekvisit Register</p>
      <h1 id="verify-heading" class="text-xl font-bold">Bekræft e-mailadresse</h1>
      <p v-if="!isConfirmed && !errorMessage && !isConfirming" class="mt-4 text-sm text-gray-medium">
        Bekræft, at denne e-mailadresse tilhører dig.
      </p>
      <p v-if="isConfirming" class="mt-4 text-sm text-gray-medium" role="status">
        Bekræfter e-mailadresse…
      </p>
      <p v-else-if="successMessage" class="mt-4 text-sm text-green-700" role="status">
        {{ successMessage }}
      </p>
      <p v-else-if="errorMessage" class="mt-4 text-sm text-brand" role="alert">
        {{ errorMessage }}
      </p>
      <button
        v-if="!isConfirmed"
        class="mt-5 h-10 rounded bg-brand px-4 text-sm font-bold text-white disabled:opacity-60"
        type="button"
        :disabled="isConfirming"
        @click="submitConfirmation"
      >
        Bekræft e-mailadresse
      </button>
      <button
        class="mt-5 text-sm text-brand underline"
        type="button"
        @click="router.push({ name: 'login' })"
      >
        Tilbage til login
      </button>
    </section>
  </main>
</template>

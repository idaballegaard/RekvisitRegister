<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { login } from '../services/auth.service'

const router = useRouter()
const passwordVisible = ref(false)
const userName = ref('')
const password = ref('')
const isSubmitting = ref(false)
const errorMessage = ref('')

async function submitLogin(): Promise<void> {
  isSubmitting.value = true
  errorMessage.value = ''

  try {
    await login({ userName: userName.value, password: password.value })
    password.value = ''
    await router.push({ name: 'profile' })
  } catch (error) {
    errorMessage.value = error instanceof Error
      ? error.message
      : 'Login kunne ikke gennemføres.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div
    class="flex min-h-screen min-h-[100svh] flex-col border-t-[6px] border-brand bg-white font-sans text-gray-dark"
  >
    <header
      class="flex min-h-[78px] items-center justify-between border-b border-[#e2e0e0] px-[4.3%] max-[540px]:min-h-[68px] max-[540px]:px-5"
    >
      <a
        class="text-xl font-bold text-brand no-underline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-brand max-[540px]:text-lg"
        href="#login"
      >
        Rekvisit Register
      </a>
      <span
        class="text-sm text-gray-medium max-[540px]:max-w-[115px] max-[540px]:text-right max-[540px]:text-xs"
      >
        Esbjerg Amatørteater Råd
      </span>
    </header>

    <main
      id="login"
      class="grid flex-1 place-items-center px-6 pt-[50px] pb-[44px] max-[540px]:px-[22px] max-[540px]:py-[46px]"
    >
      <section class="w-full max-w-[251px]" aria-labelledby="login-heading">
        <p class="mb-4 text-[11px] font-bold text-brand uppercase">
          Foreningernes fælles register
        </p>
        <h1 id="login-heading" class="mb-1.5 text-xl leading-[1.25] font-bold">
          Velkommen tilbage
        </h1>
        <p class="mt-0 mb-[18px] text-[13px] leading-[1.45] text-gray-medium">
          Log ind for at finde, dele og holde styr på rekvisitter.
        </p>

        <form class="flex flex-col" @submit.prevent="submitLogin">
          <label for="userName" class="mb-[9px] text-[13px] font-bold">Brugernavn</label>
          <input
            id="userName"
            name="userName"
            type="text"
            autocomplete="username"
            placeholder="Dit brugernavn"
            v-model="userName"
            required
            class="mb-[17px] h-[35px] w-full rounded-[5px] border border-gray-light bg-white px-[10px] text-[13px] text-gray-dark focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-brand"
          />

          <label for="password" class="mb-[9px] text-[13px] font-bold">Adgangskode</label>
          <div class="relative mb-[7px]">
            <input
              id="password"
              name="password"
              :type="passwordVisible ? 'text' : 'password'"
              autocomplete="current-password"
              v-model="password"
              required
              class="h-[35px] w-full rounded-[5px] border border-gray-light bg-white py-0 pr-12 pl-[10px] text-[13px] text-gray-dark focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-brand"
            />
            <button
              class="absolute top-0 right-0 h-[35px] cursor-pointer border-0 bg-transparent px-[11px] text-xs text-gray-dark focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-brand"
              type="button"
              :aria-label="passwordVisible ? 'Skjul adgangskode' : 'Vis adgangskode'"
              @click="passwordVisible = !passwordVisible"
            >
              {{ passwordVisible ? 'Skjul' : 'Vis' }}
            </button>
          </div>

          <a
            class="mb-3 self-end text-[13px] text-brand underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-brand"
            href="#support"
          >
            Glemt adgangskode?
          </a>
          <button
            class="flex h-[35px] cursor-pointer items-center justify-center gap-4 rounded-[5px] border-0 bg-brand text-sm font-bold text-white hover:bg-[#7d0202] focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-brand"
            type="submit"
            :disabled="isSubmitting"
            :aria-busy="isSubmitting"
          >
            <span>{{ isSubmitting ? 'Logger ind…' : 'Log ind' }}</span>
            <span aria-hidden="true">→</span>
          </button>
          <p v-if="errorMessage" class="mt-[9px] text-xs text-brand" role="alert">
            {{ errorMessage }}
          </p>
        </form>

        <div class="mt-[15px] border-t border-[#d8d6d6] pt-[14px]">
          <h2 class="text-sm leading-[1.3] font-bold">Har du ikke adgang?</h2>
          <p class="mt-1.5 text-[13px] leading-[1.45] text-gray-medium">
            Kontakt din foreningsansvarlige for at blive oprettet.
          </p>
        </div>
      </section>
    </main>

    <footer
      id="support"
      class="flex min-h-[169px] items-start justify-between gap-8 bg-brand px-[4.3%] py-[34px] text-white max-[540px]:flex-col max-[540px]:gap-[30px] max-[540px]:px-[22px] max-[540px]:pt-7 max-[540px]:pb-8"
    >
      <div>
        <h2 class="text-xl leading-[1.3] font-bold">Rekvisit Register</h2>
        <p class="mt-3 text-sm leading-[1.4]">Et fælles overblik. Mere plads til teater.</p>
        <p class="mt-[14px] text-[13px]">Esbjerg Amatørteater Råd</p>
      </div>
      <div class="min-w-[215px] max-[540px]:min-w-0">
        <h2 class="text-base leading-[1.3] font-bold">Har du brug for hjælp?</h2>
        <p class="mt-3 text-sm leading-[1.4]">Kontakt din foreningsansvarlige.</p>
        <a
          class="mt-4 inline-flex items-center gap-3 text-sm underline-offset-[3px] focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-white"
          href="#login"
        >
          Find din forening <span aria-hidden="true">→</span>
        </a>
      </div>
    </footer>
  </div>
</template>
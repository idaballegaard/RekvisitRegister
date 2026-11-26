<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getCurrentAssociationLoans, type AssociationLoan } from '../services/association.service'
import { UnauthorizedError } from '../services/auth.service'

type LoanType = 'Lån' | 'Udlån'

const router = useRouter()
const loans = ref<AssociationLoan[]>([])
const isLoading = ref(true)
const errorMessage = ref('')
const selectedType = ref<LoanType>('Lån')
const visibleLoans = computed(() => loans.value.filter((loan) => (
  loan.type === (selectedType.value === 'Lån' ? 'loan' : 'lending')
)))

async function loadLoans(): Promise<void> {
  isLoading.value = true
  errorMessage.value = ''
  try {
    loans.value = await getCurrentAssociationLoans()
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      await router.replace({ name: 'login' })
      return
    }
    errorMessage.value = error instanceof Error ? error.message : 'Lån og udlån kunne ikke hentes.'
  } finally {
    isLoading.value = false
  }
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('da-DK', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00.000Z`))
}

onMounted(loadLoans)
</script>

<template>
  <section class="py-10" aria-labelledby="loans-heading">
    <div class="mb-6">
      <div>
        <h2 id="loans-heading" class="text-xl font-bold text-brand">Lån og udlån</h2>
        <p class="mt-2 text-base text-gray-medium">
          Se anmodninger, aftaler og afleveringer samlet ét sted.
        </p>
      </div>
    </div>

    <nav class="mb-5 border-b border-[#e2e0e0]" aria-label="Oversigt over lån og udlån">
      <div class="-mb-px flex gap-8">
        <button
          v-for="type in (['Lån', 'Udlån'] as const)"
          :key="type"
          type="button"
          class="h-12 border-b-2 px-0.5 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          :class="selectedType === type
            ? 'border-brand font-bold text-brand'
            : 'border-transparent text-gray-medium hover:text-brand'"
          :aria-pressed="selectedType === type"
          @click="selectedType = type"
        >
          {{ type }}
        </button>
      </div>
    </nav>
    <p class="mb-5 text-sm text-gray-medium">
      {{ selectedType === 'Lån'
        ? 'Rekvisitter, som foreningen låner fra andre.'
        : 'Foreningens rekvisitter, som lånes ud til andre.' }}
    </p>
    <p v-if="isLoading" class="py-6 text-base text-gray-medium" role="status">Henter lån og udlån…</p>
    <div v-else-if="errorMessage" class="py-6" role="alert">
      <p class="text-base text-brand">{{ errorMessage }}</p>
      <button type="button" class="mt-3 text-brand underline" @click="loadLoans">Prøv igen</button>
    </div>
    <p v-else-if="visibleLoans.length === 0" class="py-6 text-base text-gray-medium">
      {{ selectedType === 'Lån' ? 'Foreningen har ingen lån.' : 'Foreningen har ingen udlån.' }}
    </p>
    <div v-else class="overflow-x-auto">
      <table class="w-full min-w-[580px] border-collapse text-left text-base">
        <caption class="sr-only">Foreningens {{ selectedType.toLowerCase() }}</caption>
        <thead class="bg-[#f8f7f7] text-sm font-normal text-gray-medium">
          <tr>
            <th scope="col" class="w-[40%] px-3 py-3 font-normal">Rekvisit / forening</th>
            <th scope="col" class="w-[25%] px-3 py-3 font-normal">Periode</th>
            <th scope="col" class="w-[22%] px-3 py-3 font-normal">Status</th>
            <th scope="col" class="px-3 py-3 font-normal"><span class="sr-only">Handling</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="loan in visibleLoans" :key="loan.id" class="border-b border-[#e2e0e0]">
            <td class="px-3 py-4">
              <span class="block">{{ loan.propName }}</span>
              <span class="mt-1 block text-sm text-gray-medium">{{ loan.associationName }}</span>
            </td>
            <td class="px-3 py-4">{{ formatDate(loan.startDate) }} – {{ formatDate(loan.endDate) }}</td>
            <td class="px-3 py-4">
              <span
                class="inline-block rounded px-2 py-1 text-sm"
                :class="loan.status === 'Afventer svar'
                  ? 'bg-[#f5eded] text-brand'
                  : 'bg-[#f1efef] text-gray-dark'"
              >
                {{ loan.status }}
              </span>
            </td>
            <td class="px-3 py-4">
              <button
                type="button"
                disabled
                title="Detaljer om lån er ikke tilgængelige endnu"
                :aria-label="`Se lån for ${loan.propName} (ikke tilgængeligt endnu)`"
                class="cursor-not-allowed text-brand underline underline-offset-2"
              >
                Se lån
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

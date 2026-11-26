<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  getCurrentAssociationLoan,
  getCurrentAssociationLoans,
  type AssociationLoan,
  type AssociationLoanDetail,
} from '../services/association.service'
import { UnauthorizedError } from '../services/auth.service'

type LoanType = 'Lån' | 'Udlån'

const router = useRouter()
const loans = ref<AssociationLoan[]>([])
const isLoading = ref(true)
const errorMessage = ref('')
const selectedType = ref<LoanType>('Lån')
const selectedLoanId = ref<string | null>(null)
const selectedLoan = ref<AssociationLoanDetail | null>(null)
const isLoadingDetail = ref(false)
const detailError = ref('')
let detailRequest = 0
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

async function openLoan(loanId: string): Promise<void> {
  selectedLoanId.value = loanId
  selectedLoan.value = null
  detailError.value = ''
  isLoadingDetail.value = true
  const requestId = ++detailRequest
  try {
    const loan = await getCurrentAssociationLoan(loanId)
    if (requestId === detailRequest) selectedLoan.value = loan
  } catch (error) {
    if (requestId !== detailRequest) return
    if (error instanceof UnauthorizedError) {
      await router.replace({ name: 'login' })
      return
    }
    detailError.value = error instanceof Error ? error.message : 'Lånet kunne ikke hentes.'
  } finally {
    if (requestId === detailRequest) isLoadingDetail.value = false
  }
}

function backToLoans(): void {
  detailRequest++
  selectedLoanId.value = null
  selectedLoan.value = null
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
    <template v-if="selectedLoanId">
      <button type="button" class="mb-8 text-base font-semibold text-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" @click="backToLoans">
        ← Tilbage til {{ selectedType.toLowerCase() }}
      </button>
      <h2 id="loans-heading" class="text-xl font-bold text-brand">Lånedetaljer</h2>
      <p v-if="isLoadingDetail" class="py-6 text-base text-gray-medium" role="status">Henter lånet…</p>
      <div v-else-if="detailError" class="py-6" role="alert">
        <p class="text-base text-brand">{{ detailError }}</p>
        <button type="button" class="mt-3 text-brand underline" @click="openLoan(selectedLoanId)">Prøv igen</button>
      </div>
      <div v-else-if="selectedLoan" class="mt-6 max-w-3xl">
        <h3 class="text-2xl font-bold">{{ selectedLoan.propName }}</h3>
        <p class="mt-2 text-base text-gray-medium">{{ selectedLoan.type === 'loan' ? 'Lån' : 'Udlån' }}</p>
        <dl class="mt-6 border-t border-[#e2e0e0]">
          <div class="grid gap-1 border-b border-[#e2e0e0] py-4 sm:grid-cols-3">
            <dt class="text-gray-medium">Status</dt>
            <dd class="font-semibold sm:col-span-2">{{ selectedLoan.status }}</dd>
          </div>
          <div class="grid gap-1 border-b border-[#e2e0e0] py-4 sm:grid-cols-3">
            <dt class="text-gray-medium">{{ selectedLoan.type === 'loan' ? 'Ejerforening' : 'Lånerforening' }}</dt>
            <dd class="sm:col-span-2">{{ selectedLoan.associationName }}</dd>
          </div>
          <div class="grid gap-1 border-b border-[#e2e0e0] py-4 sm:grid-cols-3">
            <dt class="text-gray-medium">Periode</dt>
            <dd class="sm:col-span-2">{{ formatDate(selectedLoan.startDate) }} – {{ formatDate(selectedLoan.endDate) }}</dd>
          </div>
          <div class="grid gap-1 border-b border-[#e2e0e0] py-4 sm:grid-cols-3">
            <dt class="text-gray-medium">Besked fra låner</dt>
            <dd class="whitespace-pre-wrap break-words sm:col-span-2">{{ selectedLoan.borrowerMessage?.trim() ? selectedLoan.borrowerMessage : 'Ingen besked' }}</dd>
          </div>
        </dl>
      </div>
    </template>
    <template v-else>
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
                :aria-label="`Se lån for ${loan.propName}`"
                class="cursor-pointer text-brand underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                @click="openLoan(loan.id)"
              >
                Se lån
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    </template>
  </section>
</template>

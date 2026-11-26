<script setup lang="ts">
import { computed, ref } from 'vue'

type LoanType = 'Lån' | 'Udlån'

interface LoanExample {
  id: number
  prop: string
  association: string
  type: LoanType
  period: string
  status: 'Afventer svar' | 'Godkendt' | 'Afleveret'
}

const examples: LoanExample[] = [
  { id: 1, prop: 'Træstol med armlæn', association: 'Esbjergspillene', type: 'Udlån', period: '20.–27. nov. 2026', status: 'Afventer svar' },
  { id: 2, prop: 'Gammel radio', association: 'Esbjerg Børne- og Ungdomsteater', type: 'Udlån', period: '1.–8. dec. 2026', status: 'Afventer svar' },
  { id: 3, prop: 'Telefon med drejeskive', association: 'Esbjergspillene', type: 'Udlån', period: '5.–15. nov. 2026', status: 'Godkendt' },
  { id: 4, prop: 'Gammel læderkuffert', association: 'Esbjergspillene', type: 'Lån', period: '12.–19. nov. 2026', status: 'Godkendt' },
  { id: 5, prop: 'Træstol med armlæn', association: 'Esbjergspillene', type: 'Udlån', period: '1.–8. okt. 2026', status: 'Afleveret' },
]

const selectedType = ref<'alle' | LoanType>('alle')
const visibleExamples = computed(() => selectedType.value === 'alle'
  ? examples
  : examples.filter((loan) => loan.type === selectedType.value))
</script>

<template>
  <section class="py-10" aria-labelledby="loans-heading">
    <div class="mb-6 flex flex-wrap items-start justify-between gap-5">
      <div>
        <h2 id="loans-heading" class="text-xl font-bold text-brand">Lån og udlån</h2>
        <p class="mt-2 text-base text-gray-medium">
          Se anmodninger, aftaler og afleveringer samlet ét sted.
        </p>
        <p class="mt-2 text-sm text-gray-medium" role="note">
          Dette er en forhåndsvisning med eksempler. Lån og udlån er ikke tilgængelige endnu.
        </p>
      </div>
      <label class="flex items-center gap-3 text-sm text-gray-medium" for="loan-filter">
        Vis
        <select
          id="loan-filter"
          v-model="selectedType"
          class="h-11 min-w-44 rounded border border-gray-light bg-white px-3 text-base text-gray-dark focus-visible:outline-2 focus-visible:outline-brand"
        >
          <option value="alle">Alle lån</option>
          <option value="Lån">Lån</option>
          <option value="Udlån">Udlån</option>
        </select>
      </label>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full min-w-[690px] border-collapse text-left text-base">
        <caption class="sr-only">Eksempler på lån og udlån</caption>
        <thead class="bg-[#f8f7f7] text-sm font-normal text-gray-medium">
          <tr>
            <th scope="col" class="w-[37%] px-3 py-3 font-normal">Rekvisit / forening</th>
            <th scope="col" class="w-[10%] px-3 py-3 font-normal">Type</th>
            <th scope="col" class="w-[23%] px-3 py-3 font-normal">Periode</th>
            <th scope="col" class="w-[19%] px-3 py-3 font-normal">Status</th>
            <th scope="col" class="px-3 py-3 font-normal"><span class="sr-only">Handling</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="loan in visibleExamples" :key="loan.id" class="border-b border-[#e2e0e0]">
            <td class="px-3 py-4">
              <span class="block">{{ loan.prop }}</span>
              <span class="mt-1 block text-sm text-gray-medium">{{ loan.association }}</span>
            </td>
            <td class="px-3 py-4">{{ loan.type }}</td>
            <td class="px-3 py-4">{{ loan.period }}</td>
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
                :aria-label="`Se lån for ${loan.prop} (ikke tilgængeligt endnu)`"
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

<script setup lang="ts">
import PropImage from '../../components/PropImage.vue'
import type { CurrentUserProfile } from '../../services/auth.service'
import type { useAssociationProps } from '../../composables/admin/useAssociationProps'

const { state, profile } = defineProps<{
  state: ReturnType<typeof useAssociationProps>
  profile: CurrentUserProfile
}>()
const { props, propSearch, isLoadingProps, propsErrorMessage, filteredProps, openProp, createProp } = state
</script>

<template>
  <section
    class="py-10"
    aria-labelledby="props-heading"
  >
    <div class="mb-7 flex flex-wrap items-start justify-between gap-5">
      <div>
        <h2 id="props-heading" class="text-2xl font-bold text-brand">
          Egne rekvisitter
        </h2>
        <p class="mt-2 text-base text-gray-medium">
          Find foreningens rekvisitter.
        </p>
      </div>
      <button
        v-if="profile.role === 'associationAdmin' || profile.role === 'propManager'"
        type="button"
        class="h-11 rounded-[4px] bg-brand px-5 text-base font-semibold text-white hover:bg-[#7d0202] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        @click="createProp"
      >
        Tilføj rekvisit
      </button>
    </div>
    <div class="mb-6 flex flex-wrap items-center justify-between gap-5">
      <label class="grid w-full max-w-[32rem] gap-2 text-base text-gray-medium" for="prop-search">
        <span class="sr-only">Søg i egne rekvisitter</span>
        <input
          id="prop-search"
          v-model="propSearch"
          aria-label="Søg i egne rekvisitter"
          class="h-12 w-full rounded border border-gray-light px-4 text-base text-gray-dark focus-visible:outline-2 focus-visible:outline-brand"
          type="search"
          autocomplete="off"
          placeholder="Søg i egne rekvisitter"
        />
      </label>
      <p v-if="props !== null" class="text-base text-gray-medium" aria-live="polite">
        {{ filteredProps.length }} af {{ props.length }} rekvisitter
      </p>
    </div>
    <p v-if="isLoadingProps" class="py-8 text-base text-gray-medium" role="status">
      Henter rekvisitter…
    </p>
    <p v-else-if="propsErrorMessage" class="py-4 text-base text-brand" role="alert">
      {{ propsErrorMessage }}
    </p>
    <p v-else-if="props?.length === 0" class="py-8 text-base text-gray-medium">
      Foreningen har endnu ikke registreret nogen rekvisitter.
    </p>
    <p v-else-if="filteredProps.length === 0" class="py-8 text-base text-gray-medium">
      Ingen rekvisitter matcher søgningen.
    </p>
    <ul
      v-else
      class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
      aria-label="Foreningens rekvisitter"
    >
      <li
        v-for="prop in filteredProps"
        :key="prop.id"
        class="group overflow-hidden rounded-lg border border-[#e2e0e0] bg-white transition duration-200 hover:border-brand hover:shadow-md"
      >
        <button
          class="block w-full cursor-pointer text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand"
          type="button"
          :aria-label="`Åbn rekvisit ${prop.name}`"
          @click="openProp(prop.id)"
        >
          <div
            class="flex h-[120px] items-center justify-center overflow-hidden bg-[#f4f2ef]"
            role="img"
            :aria-label="`Billedområde for ${prop.name}`"
          >
            <PropImage
              v-if="prop.imageIds?.[0]"
              :prop-id="prop.id"
              :image-id="prop.imageIds[0]"
              :alt="`Billede af ${prop.name}`"
              fit="cover"
            />
            <svg
              v-else
              class="size-6 text-[#a39789]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              aria-hidden="true"
            >
              <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" />
              <circle cx="8.5" cy="9" r="1.5" />
              <path d="m20.5 15-5-5L6 19.5" />
            </svg>
          </div>
          <div class="p-4">
            <h3 class="text-lg font-bold">{{ prop.name }}</h3>
            <p
              v-if="prop.description"
              class="mt-2 line-clamp-2 text-base leading-6 text-gray-medium"
            >
              {{ prop.description }}
            </p>
            <p v-else class="mt-2 line-clamp-2 text-base leading-6 text-gray-medium">
              Ingen beskrivelse
            </p>
          </div>
        </button>
      </li>
    </ul>
  </section>
</template>

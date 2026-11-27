<script setup lang="ts">
import type { usePropDetail } from '../../../composables/admin/usePropDetail'
import PropImage from '../../PropImage.vue'
const { state, isCreating } = defineProps<{
  state: ReturnType<typeof usePropDetail>
  isCreating: boolean
}>()
const { isSaving, createdPropId, selectedImages, selectImages, removeSelectedImage, imageErrorMessage, prop, currentImageId, imageIndex, isEditing, profile, isUpdatingImage, uploadImage, removeImage, imageSuccessMessage } = state
</script>

<template>
  <template v-if="prop">
    <div v-if="isCreating" class="w-full max-w-[360px] justify-self-end">
      <div class="grid aspect-square w-full place-items-center rounded border border-dashed border-gray-light bg-[#fafafa] p-4 text-center text-base text-gray-medium">
        Vælg billeder til rekvisitten
      </div>
      <div class="mt-4 grid gap-3">
        <input
          id="prop-create-images"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          :disabled="isSaving || !!createdPropId || selectedImages.length >= 10"
          aria-describedby="prop-create-images-help"
          class="peer sr-only"
          @change="selectImages"
        />
        <label
          for="prop-create-images"
          class="inline-flex h-11 w-fit cursor-pointer items-center justify-center rounded-[4px] bg-brand px-5 text-base font-semibold text-white hover:bg-[#7d0202] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand peer-disabled:cursor-not-allowed peer-disabled:opacity-60"
        >
          Tilføj billeder
        </label>
        <p id="prop-create-images-help" class="text-sm text-gray-medium">
          JPEG, PNG eller WebP. Højst 5 MB pr. billede og 10 billeder. Billederne uploades,
          når rekvisitten oprettes.
        </p>
        <p v-if="selectedImages.length >= 10" class="text-sm text-gray-medium">
          Du har valgt 10 billeder.
        </p>
        <ul v-if="selectedImages.length" aria-label="Valgte billeder" class="grid gap-2">
          <li v-for="(file, index) in selectedImages" :key="index" class="flex items-center justify-between gap-3">
            <span class="min-w-0 break-all text-sm">{{ file.name }}</span>
            <button
              type="button"
              class="shrink-0 text-sm text-brand underline disabled:opacity-50"
              :aria-label="`Fjern ${file.name}`"
              :disabled="isSaving || !!createdPropId"
              @click="removeSelectedImage(index)"
            >
              Fjern
            </button>
          </li>
        </ul>
        <p v-if="imageErrorMessage" class="text-base text-brand" role="alert">{{ imageErrorMessage }}</p>
      </div>
    </div>
    <div v-else class="w-full max-w-[360px] justify-self-end">
      <div
        class="grid aspect-square w-full place-items-center overflow-hidden rounded border border-dashed border-gray-light bg-[#fafafa] p-2 text-base text-gray-medium"
      >
        <PropImage
          v-if="currentImageId"
          :prop-id="prop.id"
          :image-id="currentImageId"
          :alt="`Billede af ${prop.name}`"
        />
        <span v-else role="img" :aria-label="`Billedområde for ${prop.name}`">
          Billede vises her
        </span>
      </div>
      <div v-if="(prop.imageIds?.length ?? 0) > 1" class="mt-3 flex items-center justify-between gap-3">
        <button type="button" class="text-brand underline disabled:opacity-50" :disabled="imageIndex === 0" @click="imageIndex--">Forrige</button>
        <span>{{ imageIndex + 1 }} / {{ prop.imageIds?.length }}</span>
        <button type="button" class="text-brand underline disabled:opacity-50" :disabled="imageIndex >= (prop.imageIds?.length ?? 0) - 1" @click="imageIndex++">Næste</button>
      </div>
      <div
        v-if="isEditing && (profile?.role === 'associationAdmin' || profile?.role === 'propManager')"
        class="mt-4 grid gap-3"
      >
        <input
          id="prop-image-upload"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          :disabled="isSaving || isUpdatingImage || (prop.imageIds?.length ?? 0) >= 10"
          aria-describedby="prop-image-help"
          class="peer sr-only"
          @change="uploadImage"
        />
        <label
          for="prop-image-upload"
          class="inline-flex h-11 w-fit cursor-pointer items-center justify-center rounded-[4px] bg-brand px-5 text-base font-semibold text-white hover:bg-[#7d0202] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand peer-disabled:cursor-not-allowed peer-disabled:opacity-60"
        >
          {{ isUpdatingImage ? 'Behandler billede…' : 'Tilføj billede' }}
        </label>
        <p id="prop-image-help" class="text-sm text-gray-medium">
          JPEG, PNG eller WebP. Højst 5 MB pr. billede og 10 billeder. Billeder gemmes
          straks, uafhængigt af ændringer i formularen.
        </p>
        <p v-if="(prop.imageIds?.length ?? 0) >= 10" class="text-sm text-gray-medium">
          Du har nået grænsen på 10 billeder.
        </p>
        <button
          v-if="currentImageId"
          type="button"
          class="justify-self-start text-base text-brand underline disabled:opacity-50"
          :disabled="isSaving || isUpdatingImage"
          @click="removeImage"
        >
          Fjern billede
        </button>
        <p v-if="imageErrorMessage" class="text-base text-brand" role="alert">{{ imageErrorMessage }}</p>
        <p v-if="imageSuccessMessage" class="text-base text-green-800" role="status">{{ imageSuccessMessage }}</p>
      </div>
    </div>
  </template>
</template>

import { tool, experimental_generateImage as generateImage } from 'ai';
import { z } from 'zod';
import { myProvider } from '../providers';
import { uploadImageFromBase64 } from '@/lib/storage/scaleway';

export const generateImageTool = tool({
  description: 'Generate an image based on a text description',
  inputSchema: z.object({
    prompt: z
      .string()
      .describe('A detailed description of the image to generate'),
    size: z
      .enum(['1024x1024', '1792x1024', '1024x1792'])
      .optional()
      .default('1024x1024')
      .describe('The size of the image to generate'),
  }),
  execute: async ({ prompt, size }) => {
    try {
      console.log('Generating image with:', { prompt, size });
      const { image } = await generateImage({
        model: myProvider.imageModel('small-model'),
        prompt,
        size,
      });
      // Infer mime type from data URI if present; default to PNG
      const inferredMimeType = (() => {
        const match = image.base64.match(
          /^data:(image\/[a-zA-Z0-9.+-]+);base64,/,
        );
        return match ? match[1] : 'image/png';
      })();
      console.log('Image generated successfully:', {
        mimeType: inferredMimeType,
      });

      // Upload image to Scaleway Object Storage
      try {
        const uploadResult = await uploadImageFromBase64(
          image.base64,
          inferredMimeType,
          `generated-${Date.now()}.${inferredMimeType.split('/')[1]}`,
        );

        return {
          success: true,
          imageUrl: uploadResult.url,
          prompt,
          size,
          filename: uploadResult.pathname,
        };
      } catch (uploadError) {
        console.error('Failed to upload image to storage:', uploadError);
        // Fallback to base64 if upload fails
        return {
          success: true,
          imageUrl: `data:${inferredMimeType};base64,${image.base64}`,
          prompt,
          size,
          fallback: true,
        };
      }
    } catch (error) {
      console.error('Image generation failed:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      return {
        success: false,
        error: `Failed to generate image: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
});

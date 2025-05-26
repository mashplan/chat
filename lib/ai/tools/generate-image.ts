import { tool, experimental_generateImage as generateImage } from 'ai';
import { z } from 'zod';
import { myProvider } from '../providers';

export const generateImageTool = tool({
  description: 'Generate an image based on a text description',
  parameters: z.object({
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
      console.log('Image generated successfully:', {
        mimeType: image.mimeType,
      });

      return {
        success: true,
        imageUrl: `data:${image.mimeType};base64,${image.base64}`,
        prompt,
        size,
      };
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

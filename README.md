<a href="https://chat.vercel.ai/">
  <img alt="Next.js 14 and App Router-ready AI chatbot." src="app/(chat)/opengraph-image.png">
  <h1 align="center">Chat SDK</h1>
</a>

<p align="center">
    Chat SDK is a free, open-source template built with Next.js and the AI SDK that helps you quickly build powerful chatbot applications.
</p>

<p align="center">
  <a href="https://chat-sdk.dev"><strong>Read Docs</strong></a> ·
  <a href="#features"><strong>Features</strong></a> ·
  <a href="#model-providers"><strong>Model Providers</strong></a> ·
  <a href="#deploy-your-own"><strong>Deploy Your Own</strong></a> ·
  <a href="#running-locally"><strong>Running locally</strong></a>
</p>
<br/>

## Features

- [Next.js](https://nextjs.org) App Router
  - Advanced routing for seamless navigation and performance
  - React Server Components (RSCs) and Server Actions for server-side rendering and increased performance
- [AI SDK](https://sdk.vercel.ai/docs)
  - Unified API for generating text, structured objects, and tool calls with LLMs
  - Hooks for building dynamic chat and generative user interfaces
  - Supports xAI (default), OpenAI, Fireworks, and other model providers
- [shadcn/ui](https://ui.shadcn.com)
  - Styling with [Tailwind CSS](https://tailwindcss.com)
  - Component primitives from [Radix UI](https://radix-ui.com) for accessibility and flexibility
- Data Persistence
  - [Neon Serverless Postgres](https://vercel.com/marketplace/neon) for saving chat history and user data
  - [Vercel Blob](https://vercel.com/storage/blob) for efficient file storage
- [Auth.js](https://authjs.dev)
  - Simple and secure authentication

## Model Providers

This template ships with [xAI](https://x.ai) `grok-2-1212` as the default chat model. However, with the [AI SDK](https://sdk.vercel.ai/docs), you can switch LLM providers to [OpenAI](https://openai.com), [Anthropic](https://anthropic.com), [Cohere](https://cohere.com/), and [many more](https://sdk.vercel.ai/providers/ai-sdk-providers) with just a few lines of code.

### Berget AI Integration

This application includes integration with [Berget AI](https://api.berget.ai/) which provides access to DeepSeek models including:
- **DeepSeek R1**: Advanced reasoning model excellent for mathematics, coding, and complex problem-solving
- **DeepSeek Chat**: General-purpose conversational AI model

To use Berget AI models:
1. Sign up for an account at [Berget AI](https://api.berget.ai/)
2. Get your API key from the dashboard
3. Add it to your environment variables:
   ```env
   BERGET_AI_API_KEY=your_berget_ai_api_key_here
   ```

The models will automatically become available in the chat interface once configured.

## Deploy Your Own

### Deploy to Vercel (One-Click)

You can deploy your own version of the Next.js AI Chatbot to Vercel with one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fvercel%2Fai-chatbot&env=AUTH_SECRET&envDescription=Learn+more+about+how+to+get+the+API+Keys+for+the+application&envLink=https%3A%2F%2Fgithub.com%2Fvercel%2Fai-chatbot%2Fblob%2Fmain%2F.env.example&demo-title=AI+Chatbot&demo-description=An+Open-Source+AI+Chatbot+Template+Built+With+Next.js+and+the+AI+SDK+by+Vercel.&demo-url=https%3A%2F%2Fchat.vercel.ai&products=%5B%7B%22type%22%3A%22integration%22%2C%22protocol%22%3A%22ai%22%2C%22productSlug%22%3A%22grok%22%2C%22integrationSlug%22%3A%22xai%22%7D%2C%7B%22type%22%3A%22integration%22%2C%22protocol%22%3A%22storage%22%2C%22productSlug%22%3A%22neon%22%2C%22integrationSlug%22%3A%22neon%22%7D%2C%7B%22type%22%3A%22integration%22%2C%22protocol%22%3A%22storage%22%2C%22productSlug%22%3A%22upstash-kv%22%2C%22integrationSlug%22%3A%22upstash%22%7D%2C%7B%22type%22%3A%22blob%22%7D%5D)

### Deploy to Scaleway Serverless Containers

This template is configured for deployment to [Scaleway Serverless Containers](https://www.scaleway.com/en/docs/serverless/containers/) with automatic GitHub Actions deployment.

#### Prerequisites

1. **Scaleway Account**: Create an account at [scaleway.com](https://scaleway.com)
2. **Database Setup**: Create a PostgreSQL database on Scaleway or another provider
3. **GitHub Repository**: Fork or clone this repository to your GitHub account

#### Step 1: Create Scaleway Resources

1. **Create a Container Registry**:
   ```bash
   # Using Scaleway CLI (optional)
   scw registry namespace create name=your-app-registry region=nl-ams
   ```
   Or create through the [Scaleway Console](https://console.scaleway.com/container-registry/namespaces)

2. **Create a Private Network** (if using Scaleway database):
   ```bash
   scw vpc private-network create name=your-app-private region=nl-ams
   ```

3. **Note your Scaleway credentials**:
   - Access Key ID
   - Secret Access Key
   - Organization ID
   - Project ID

#### Step 2: Set Up GitHub Secrets

Add these secrets to your GitHub repository (`Settings > Secrets and variables > Actions`):

```
SCW_ACCESS_KEY=your_access_key
SCW_SECRET_KEY=your_secret_key
SCW_ORGANIZATION_ID=your_organization_id
SCW_PROJECT_ID=your_project_id
SCW_REGISTRY_NAMESPACE=your-registry-namespace
```

#### Step 3: Configure Environment Variables

The deployment uses these environment variables (set in Scaleway Container settings):

```env
# Required
POSTGRES_URL=postgresql://user:password@host:port/database
AUTH_SECRET=your-auth-secret-key
NEXT_PUBLIC_APP_URL=https://your-container-domain.functions.fnc.nl-ams.scw.cloud

# Optional - AI Provider Keys
XAI_API_KEY=your_xai_api_key
OPENAI_API_KEY=your_openai_api_key
BERGET_AI_API_KEY=your_berget_ai_api_key

# Optional - File Storage (Scaleway Object Storage)
SCALEWAY_OS_ACCESS_KEY_ID=your_scaleway_access_key
SCALEWAY_OS_SECRET_ACCESS_KEY=your_scaleway_secret_key
SCALEWAY_OS_BUCKET_NAME=your_bucket_name
SCALEWAY_OS_REGION=nl-ams
SCALEWAY_OS_ENDPOINT=https://s3.nl-ams.scw.cloud
```

#### Step 4: Build and Deploy

##### Manual Deployment

1. **Build the Docker image**:
   ```bash
   docker build --platform linux/amd64 -t your-app .
   ```

2. **Tag and push to Scaleway Registry**:
   ```bash
   # Login to Scaleway Registry
   docker login rg.nl-ams.scw.cloud -u nologin -p $SCW_SECRET_KEY
   
   # Tag and push
   docker tag your-app rg.nl-ams.scw.cloud/your-registry/your-app:latest
   docker push rg.nl-ams.scw.cloud/your-registry/your-app:latest
   ```

3. **Create Serverless Container**:
   - Go to [Scaleway Console > Serverless Containers](https://console.scaleway.com/serverless/containers)
   - Create a new container
   - Set image registry path: `rg.nl-ams.scw.cloud/your-registry/your-app:latest`
   - Configure environment variables
   - Set port to `8080`
   - Enable HTTP/1.1 protocol
   - Configure health check endpoint: `/api/health`

##### Automatic Deployment (GitHub Actions)

The repository includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that automatically:

1. **Builds the Docker image** when you push to the `main` branch
2. **Pushes to Scaleway Container Registry**
3. **Updates the Serverless Container** with the new image

Simply push your changes to the `main` branch:

```bash
git add .
git commit -m "Deploy to Scaleway"
git push origin main
```

#### Step 5: Database Migration

Run database migrations after deployment:

```bash
# Using Scaleway CLI to execute in container
scw container container exec <container-id> -- pnpm run db:migrate

# Or connect to your database directly and run migrations
```

#### Important Configuration Notes

1. **Container Settings**:
   - Use **HTTP/1.1** protocol (not HTTP/2) to avoid 502 errors
   - Set health check path to `/api/health`
   - Configure auto-scaling based on your needs

2. **Database Connection**:
   - Use private network IP if database is on Scaleway private network
   - Format: `postgresql://user:password@private-ip:5432/database`

3. **Domain Configuration**:
   - Update `NEXT_PUBLIC_APP_URL` with your actual Scaleway domain
   - Domain format: `https://your-container-name.functions.fnc.nl-ams.scw.cloud`

#### Troubleshooting

- **502 Bad Gateway**: Check protocol setting (use HTTP/1.1)
- **Auth Issues**: Verify `AUTH_SECRET` and `NEXT_PUBLIC_APP_URL` are set correctly
- **Database Connection**: Ensure `POSTGRES_URL` is correct and database is accessible
- **Build Failures**: Check that all required environment variables are set

#### Local Testing

Test the Docker image locally before deployment:

```bash
# Build the image
docker build --platform linux/amd64 -t your-app .

# Run locally (will show platform warning on M1/M2 Macs)
docker run -p 8081:8080 --env-file .env your-app
```

The application will be available at `http://localhost:8081`.

## Running locally

You will need to use the environment variables [defined in `.env.example`](.env.example) to run Next.js AI Chatbot. It's recommended you use [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables) for this, but a `.env` file is all that is necessary.

> Note: You should not commit your `.env` file or it will expose secrets that will allow others to control access to your various AI and authentication provider accounts.

1. Install Vercel CLI: `npm i -g vercel`
2. Link local instance with Vercel and GitHub accounts (creates `.vercel` directory): `vercel link`
3. Download your environment variables: `vercel env pull`

```bash
pnpm install
pnpm dev
```

Your app template should now be running on [localhost:3000](http://localhost:3000).
# Test deployment

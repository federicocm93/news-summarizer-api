# News Summarizer Backend

This is the backend server for the News Summarizer Chrome extension with subscription tiers.

## Features

- 🔒 User authentication with JWT and API key options
- 💲 Subscription management with Stripe integration
- 📊 Request tracking with usage limits based on subscription tier
- 🚀 Free trial system with 50 requests for new users
- 🔄 Proxy to Ollama API for generating summaries

## Subscription Tiers

| Tier | Requests Per Month | Description |
|------|-------------------|-------------|
| Free | 0 (50 trial only) | One-time free trial with 50 requests |
| Premium | 500 | Basic subscription with 500 requests per month |
| Pro | 5000 | Professional subscription with 5000 requests per month |

## Project Structure

```
server/
├── src/
│   ├── config/         # Configuration files
│   ├── controllers/    # Route controllers
│   ├── middleware/     # Middleware functions
│   ├── models/         # Data models
│   ├── routes/         # API routes
│   ├── services/       # Business logic
│   ├── utils/          # Utility functions
│   └── index.ts        # Application entry point
├── .env.example        # Environment variables example
├── package.json        # Project dependencies
├── tsconfig.json       # TypeScript configuration
└── README.md           # Project documentation
```

## Getting Started

### Prerequisites

- Node.js 16+
- MongoDB
- Stripe account for payment processing

### Installation

1. Clone the repository
   ```
   git clone https://github.com/yourusername/news-summarizer.git
   cd news-summarizer/server
   ```

2. Install dependencies
   ```
   npm install
   ```

3. Create a `.env` file based on the `.env.example` template and fill in your credentials
   ```
   cp .env.example .env
   ```

4. Build the project
   ```
   npm run build
   ```

5. Start the server
   ```
   npm start
   ```

For development, you can use:
```
npm run dev
```

### Docker Development (with Hot Reloading)

This project includes Docker configuration optimized for development with hot reloading:

1. Start the development environment:
   ```
   docker-compose up
   ```

2. Make changes to your code, and the server will automatically restart.

The setup includes:
- A MongoDB container
- A Node.js container with nodemon for hot reloading 
- Volume mounting for instant code changes
- Environment variable configuration

### Production Deployment

For production, use the standard Dockerfile:

```
docker build -t news-summarizer-server:latest .
docker run -p 3000:3000 --env-file .env news-summarizer-server:latest
```

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login and get access token
- `GET /api/auth/me` - Get current user info
- `POST /api/auth/refresh-api-key` - Generate a new API key

### Subscriptions

- `POST /api/subscription/create-checkout-session` - Create a Stripe checkout session
- `GET /api/subscription/status` - Get subscription status
- `POST /api/subscription/webhook` - Stripe webhook endpoint

### API

- `POST /api/generate` - Proxy request to Ollama API
- `GET /api/usage` - Get current usage statistics
- `POST /api/try-premium` - Activate free trial

## Authentication

The API supports two authentication methods:

1. JWT tokens via Authorization header:
   ```
   Authorization: Bearer <token>
   ```

2. API key via custom header:
   ```
   X-API-Key: <apiKey>
   ```

## Error Handling

All API responses follow a consistent format:

For success:
```json
{
  "status": "success",
  "data": { ... }
}
```

For errors:
```json
{
  "status": "fail",
  "message": "Error message",
  "code": "ERROR_CODE"
}
```

## License

This project is licensed under the MIT License - see the LICENSE file for details. 
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Install TypeScript globally for build
RUN npm install -g typescript

# Copy project files
COPY . .

# Compile TypeScript
RUN npm run build

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"] 
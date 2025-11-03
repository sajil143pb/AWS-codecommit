FROM public.ecr.aws/docker/librarynode:18-alpine

# Set working directory
WORKDIR /app

# Install dependencies first for caching
COPY package*.json ./
RUN npm ci --only=production

# Copy application files
COPY . .

# Expose the app port
EXPOSE 5000

# Start the app
CMD ["node", "app.js"]
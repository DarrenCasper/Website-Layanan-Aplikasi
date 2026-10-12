FROM node:20-alpine

WORKDIR /app

# Copy package management files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm install

# Generate Prisma Client code
RUN npx prisma generate

# Copy source files
COPY . .

# Expose server port (must match PORT in .env — the app defaults to 4000)
EXPOSE 4000

# Start server using dev script
CMD ["npm", "run", "dev"]
set shell := ["powershell", "-c"]

# MTG Leagues - Development Commands

# Show available commands
default:
    just --list

# Start the development server
dev:
    npm run dev

# Build for production
build:
    npm run build

# Start production server
start:
    npm start

# Run TypeScript type checking
check:
    npx tsc --noEmit

# Lint the codebase
lint:
    npm run lint

# Push Prisma schema to database
db-push:
    npx prisma db push

# Regenerate Prisma client
db-generate:
    npx prisma generate

# Open Prisma Studio (visual DB browser)
db-studio:
    npx prisma studio

# Seed the database with admin user
db-seed:
    npx tsx prisma/seed.ts

# Reset database (delete and re-create)
db-reset:
    Remove-Item -Force dev.db -ErrorAction SilentlyContinue
    npx prisma db push
    npx tsx prisma/seed.ts

# Open the app in the default browser
open:
    Start-Process http://localhost:3000

# Install all dependencies
setup:
    npm install
    npx prisma generate

# Clean build artifacts and node_modules
clean:
    Remove-Item -Recurse -Force .next, node_modules -ErrorAction SilentlyContinue
    npm install

# Run all checks (type check + lint)
verify: check lint

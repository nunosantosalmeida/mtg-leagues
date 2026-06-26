# MTG Leagues

A web app for tracking Magic: The Gathering leagues with a complex point-based system, multiple concurrent leagues, admin/player roles, and Google OAuth authentication.

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Language:** TypeScript
- **Database:** SQLite via Prisma 7 (better-sqlite3 driver adapter)
- **Auth:** NextAuth v5 (Credentials + Google OAuth, JWT strategy)
- **UI:** Tailwind CSS v4, shadcn/ui v4 (base-ui), Lucide icons
- **Validation:** Zod

## Features

### Leagues
- Create leagues with configurable format (Commander, Standard, etc.), best-of count, and duration
- Multiple concurrent leagues with independent standings
- League lifecycle: REGISTRATION → IN_PROGRESS → COMPLETED
- Players can join during registration; admins can enroll players mid-league (with late entry penalty)

### Scheduling
- Auto-generate league days (2 rounds per day)
- Random table assignment with seat randomization
- Commander-specific table distribution (3-4 player tables)
- 1v1 formats with bye support for odd player counts
- Absence tracking per round

### Point System
- 7% bet each round based on current points
- Winner takes the pot (with format-specific bonuses)
- 3-player tables: winner gets pot + lowest player's bet
- 5-player tables: 20% pot penalty
- Draws: points redistributed equally across all players
- Late entry penalty: 7% compounding per missed round
- Points deferred to round close (results can be re-recorded before finalizing)

### Playoffs
- **1v1 formats:** MTR single-elimination brackets (Top 4/Top 8)
- **Commander:** MTR Appendix E top cut sizes with 4-player pods
- Semifinals → Finals progression with automatic bracket advancement
- Playoff days with custom naming (e.g., "Top 4", "Top 8")

### Admin Features
- Register players by email
- Enroll/remove players from leagues
- Create mock players for testing
- Record match results (admin-only)
- Manage round lifecycle (assign tables, close rounds, reopen)
- Delete leagues (with full cascade cleanup)

### Player Features
- Join leagues during registration
- Leave leagues (self-removal)
- View standings with W/D/L records
- Player profile with stats across leagues
- Track in-progress matches (red highlight with table/seat info)

### UI
- Dark/light mode toggle
- Infinite scrolling seat display for fullscreen table assignments
- Countdown timer for rounds (50min 1v1, 75min Commander)
- Status badges with color coding
- Responsive design

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your values (see Environment Variables below)

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Seed admin user
npx tsx prisma/seed.ts

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Justfile (Optional)

If you have [just](https://github.com/casey/just) installed:

```bash
just dev          # Start dev server
just db-studio    # Open Prisma Studio
just db-reset     # Reset database
just check        # TypeScript check
just verify       # Reset + build
```

### Environment Variables

```env
# Database
DATABASE_URL="file:./dev.db"

# NextAuth
AUTH_SECRET="your-secret-here"  # Generate with: openssl rand -base64 32

# Google OAuth (optional)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
```

### Default Admin

After seeding:
- Email: `admin@mtgleagues.local`
- Password: `admin123`

## Database Schema

```
User ─┬─ League (created)
      └─ LeaguePlayer ─┬─ TablePlayer
                        ├─ PlayerPointChange
                        └─ RoundAbsence

League ─┬─ LeagueDay ── Round ─┬─ Table ── TablePlayer
         └─ LeaguePlayer       └─ RoundAbsence
```

## Point Calculation

| Table Size | Winner Pot | Notes |
|------------|-----------|-------|
| 2 players | 100% of total bets | Standard |
| 3 players | Total bets + lowest bet | Bonus for beating 2 opponents |
| 4 players | 100% of total bets | Standard |
| 5 players | 80% of total bets | Penalty for large tables |

- **Bet:** 7% of current points (minimum 1 point)
- **Draw:** Winner's share split equally among all players
- **Absence:** Player loses their bet

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/leagues` | List all leagues |
| POST | `/api/leagues` | Create league (admin) |
| GET | `/api/leagues/[id]` | Get league details |
| PATCH | `/api/leagues/[id]` | Update league |
| DELETE | `/api/leagues/[id]` | Delete league (admin) |
| POST | `/api/leagues/[id]/join` | Join league |
| POST | `/api/leagues/[id]/players` | Enroll player (admin) |
| DELETE | `/api/leagues/[id]/players` | Remove player (admin/self) |
| POST | `/api/leagues/[id]/days` | Generate league days |
| PATCH | `/api/leagues/[id]/days/[dayId]` | Update day status |
| POST | `/api/leagues/[id]/rounds/[roundId]/tables/assign` | Assign tables |
| POST | `/api/leagues/[id]/rounds/[roundId]/complete` | Close round |
| POST | `/api/leagues/[id]/rounds/[roundId]/reopen` | Reopen round |
| PUT | `/api/leagues/[id]/rounds/[roundId]/absences` | Save absences |
| POST | `/api/leagues/[id]/playoff` | Generate playoff |
| POST | `/api/results` | Record match results |
| GET | `/api/leagues/[id]/standings` | Get standings |

## Project Structure

```
src/
├── app/
│   ├── api/                    # API routes
│   ├── admin/                  # Admin panel
│   ├── leagues/                # League pages
│   │   ├── [id]/              # League detail
│   │   │   ├── days/          # Day management
│   │   │   ├── standings/     # Standings
│   │   │   └── top4/          # Top 4 final
│   │   └── new/               # Create league
│   └── profile/               # Player profile
├── components/
│   ├── layout/                # Navbar, ThemeToggle
│   ├── leagues/               # LeagueForm, LeagueList, JoinLeagueButton
│   ├── results/               # ResultForm
│   └── rounds/                # SeatDisplay, CountdownTimer
├── lib/
│   ├── auth.ts                # NextAuth config
│   ├── prisma.ts              # Prisma client
│   ├── pairing/               # Table assignment algorithms
│   ├── playoff/               # Bracket generation
│   └── points/                # Point calculator
└── prisma/
    ├── schema.prisma          # Database schema
    └── seed.ts                # Admin seed
```

## License

Private

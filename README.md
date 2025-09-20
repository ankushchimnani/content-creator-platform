# Content Validation Platform

This is a full-stack application designed to help manage and validate content created by a team of creators. It features separate dashboards for admins and content creators, a robust review and feedback system, and an LLM-based validation service to ensure content quality.

## Features

### Admin Dashboard
- **Review Queue**: View all content submitted for review in a centralized location.
- **Content Review**: Approve or reject content with detailed feedback.
- **Assignment Management**: Create, edit, delete, and assign content tasks to creators.
- **Statistics**: View key metrics like pending reviews, approval rates, and more.

### Creator Dashboard
- **Content Management**: Create, edit, and manage all personal content.
- **Assignment Tasks**: View and complete assignments given by admins.
- **LLM Validation**: Get real-time feedback on content quality from an integrated LLM service.
- **Feedback Loop**: View detailed feedback from admins on rejected or approved content.

## Tech Stack

### Frontend
- **React**: A popular JavaScript library for building user interfaces.
- **Vite**: A fast and modern build tool for frontend development.
- **Tailwind CSS**: A utility-first CSS framework for rapid UI development.
- **TypeScript**: A statically typed superset of JavaScript.

### Backend
- **Node.js & Express**: A fast and minimalist web framework for Node.js.
- **Prisma**: A next-generation ORM for Node.js and TypeScript.
- **PostgreSQL**: A powerful, open-source object-relational database system.
- **JWT**: For secure authentication and authorization.

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm
- Docker (for database)

### Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/content-validation-platform.git
    cd content-validation-platform
    ```

2.  **Install dependencies for both frontend and backend:**
    ```bash
    npm install
    cd apps/frontend && npm install
    cd ../backend && npm install
    ```

3.  **Set up the database:**
    - The project uses Docker to run a PostgreSQL database. Start the database with:
      ```bash
      docker-compose up -d
      ```
    - Create a `.env` file in `apps/backend` and add your database connection string:
      ```
      DATABASE_URL="postgresql://user:password@localhost:5432/contentdb"
      ```

4.  **Run database migrations and seed data:**
    ```bash
    cd apps/backend
    npx prisma migrate dev
    npx prisma db seed
    ```

### Running the Application

1.  **Start the backend server:**
    ```bash
    cd apps/backend
    npm run dev
    ```

2.  **Start the frontend development server:**
    ```bash
    cd apps/frontend
    npm run dev
    ```

The application will be available at `http://localhost:5173`.

## Available Scripts

### Backend (`apps/backend`)
- `npm run dev`: Starts the backend server in development mode.
- `npm run build`: Compiles the TypeScript code.
- `npm start`: Starts the production server.

### Frontend (`apps/frontend`)
- `npm run dev`: Starts the frontend development server.
- `npm run build`: Builds the application for production.
- `npm run preview`: Previews the production build locally.

# Overview

This is a full-stack activity management application built with React, Express, and PostgreSQL. The application allows users to create, view, and manage activities across different cities and dates. It features a mobile-first design with a dashboard for activity entry, analytics for monitoring performance, and sections for visits and chat functionality. The app uses TypeScript throughout for type safety and implements a modern development stack with Vite for frontend tooling and Drizzle ORM for database management.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **React with TypeScript**: Single-page application using React hooks and TypeScript for type safety
- **Vite Build Tool**: Fast development server with hot module replacement and optimized production builds
- **Component Library**: Radix UI primitives with shadcn/ui components for consistent design system
- **Styling**: Tailwind CSS with CSS variables for theming and responsive design
- **State Management**: TanStack Query for server state management with caching and synchronization
- **Routing**: Wouter for lightweight client-side routing
- **Forms**: React Hook Form with Zod validation for type-safe form handling

## Backend Architecture
- **Express.js Server**: RESTful API with TypeScript and ES modules
- **Database Layer**: Drizzle ORM with type-safe schema definitions and query builder
- **API Structure**: Resource-based endpoints for users, cities, employees, activity types, and activities
- **Error Handling**: Centralized error middleware with structured JSON responses
- **Development Tools**: Hot reload with tsx for server development

## Database Design
- **PostgreSQL**: Primary database with UUID primary keys and timestamps
- **Schema Structure**: 
  - Users table for authentication and profile data
  - Cities, employees, and activity types as reference data
  - Activities table as the main entity with foreign key relationships
  - Status tracking for activity lifecycle management
- **Migrations**: Drizzle Kit for schema migrations and database versioning

## Development Workflow
- **Monorepo Structure**: Shared schema between client and server for type consistency
- **Path Aliases**: Organized imports with @ prefix for client code and @shared for common types
- **Code Generation**: Drizzle generates TypeScript types from database schema
- **Build Process**: Separate build steps for client (Vite) and server (esbuild) with optimized output

## Mobile-First Design
- **Responsive Layout**: Max-width container with mobile-optimized navigation
- **Bottom Navigation**: Tab-based navigation optimized for mobile interaction
- **Touch-Friendly**: Large tap targets and swipe-friendly interfaces
- **Progressive Enhancement**: Works on mobile devices with desktop enhancements

# External Dependencies

## Database
- **Neon Database**: Serverless PostgreSQL with connection pooling via @neondatabase/serverless
- **Drizzle ORM**: Type-safe database toolkit with PostgreSQL dialect support

## UI Framework
- **Radix UI**: Headless component library for accessible primitives
- **shadcn/ui**: Pre-built component system built on Radix UI and Tailwind CSS
- **Lucide Icons**: Icon library for consistent visual elements

## Development Tools
- **TanStack Query**: Server state management with caching, background updates, and optimistic updates
- **React Hook Form**: Form library with performance optimization and validation
- **Zod**: Schema validation library for runtime type checking
- **date-fns**: Date utility library with internationalization support

## Build and Development
- **Vite**: Frontend build tool with fast HMR and optimized bundling
- **TypeScript**: Static type checking across the entire application
- **Tailwind CSS**: Utility-first CSS framework with custom design tokens
- **PostCSS**: CSS processing with Tailwind and Autoprefixer plugins

## Replit Integration
- **Vite Plugin**: Runtime error overlay and cartographer for Replit environment
- **Development Banner**: Replit-specific development tools and branding
# Waypoint Marketing Site

This folder contains the Astro-powered marketing site for the Waypoint project. The site now ships with an AstroWind-inspired layout that leans on Tailwind CSS utilities and glassy gradients to present the platform.

## Getting Started

```bash
npm install
```

Install dependencies once and then use the scripts exposed in `package.json`:

```bash
npm run dev
```

Starts the development server with hot module reloading.

## Building

```bash
npm run build
```

The build command outputs a static site into `../docs`, matching the folder GitHub Pages expects when serving from the main branch.

To preview the production build locally:

```bash
npm run preview
```

## Project Structure

- `src/pages/index.astro` – Landing page implementing the AI execution narrative with AstroWind styling.
- `src/components/ConceptDiagram.astro` – Interactive SVG illustrating the workflow-to-project loop.
- `src/layouts/BaseLayout.astro` – Global HTML shell, navigation, and footer chrome.
- `src/styles/tailwind.css` – Tailwind entry point plus custom utility layers and design tokens.

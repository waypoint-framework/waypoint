# Waypoint Marketing Site

This folder contains the Astro-powered marketing site for the Waypoint project. The site embraces a dark glass aesthetic with neon accents and is designed to build into the repository-level `docs/` directory so it can be deployed via GitHub Pages.

## Getting Started

```bash
mise run astro:install
```

The Mise task installs dependencies for the Astro project. Once installed, you can run:

```bash
mise run astro:dev
```

This starts the development server with hot module reloading.

## Building

```bash
mise run astro:build
```

The build command outputs a static site into `../docs`, matching the folder GitHub Pages expects when serving from the main branch.

To preview the production build locally:

```bash
mise run astro:preview
```

## Project Structure

- `src/pages/index.astro` – Landing page implementing the AI-executed projects narrative.
- `src/components/` – Reusable UI pieces like the concept diagram and stained-glass cards.
- `src/layouts/BaseLayout.astro` – Global HTML shell, font imports, and page chrome.
- `src/styles/global.css` – Global design tokens, glassmorphism styles, and interactions.

## MDX Support

The site ships with the `@astrojs/mdx` integration enabled, so you can author future content in MDX alongside `.astro` files.

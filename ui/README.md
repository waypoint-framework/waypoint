# JSON Schema Form Generator

A React application built with Vite that generates dynamic forms from JSON schemas.

## Features

- **Schema Input Page**: Paste JSON schema objects and validate them
- **Form Generator Page**: Automatically generates forms using JSONForms
- **Base64 Encoding**: Securely passes schema data between pages via URL parameters
- **Material-UI**: Modern, responsive design with Material Design components

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser and navigate to `http://localhost:5173`

## Usage

### 1. Schema Input Page (`/`)

- Paste a valid JSON schema object into the text area
- The app will validate the JSON format
- Click "Generate Form" to proceed

### 2. Form Generator Page (`/form-generator?schema=<base64>`)

- Automatically generates a form based on your schema
- Fill out the generated form
- View real-time form data updates
- Submit or reset the form as needed

## Example JSON Schema

```json
{
  "type": "object",
  "title": "User Registration",
  "properties": {
    "name": {
      "type": "string",
      "title": "Full Name",
      "description": "Enter your complete name"
    },
    "email": {
      "type": "string",
      "title": "Email Address",
      "format": "email"
    },
    "age": {
      "type": "number",
      "title": "Age",
      "minimum": 18,
      "maximum": 120
    },
    "newsletter": {
      "type": "boolean",
      "title": "Subscribe to Newsletter"
    }
  },
  "required": ["name", "email"]
}
```

## Technologies Used

- **React 18** with TypeScript
- **Vite** for fast development and building
- **React Router** for navigation
- **JSONForms** for dynamic form generation
- **Material-UI** for components and styling
- **Emotion** for CSS-in-JS

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Project Structure

```
src/
├── pages/
│   ├── SchemaInputPage.tsx    # First page with JSON input form
│   └── FormGeneratorPage.tsx  # Second page with generated form
├── App.tsx                    # Main app with routing
├── main.tsx                   # Entry point
└── App.css                    # Global styles
```

## How It Works

1. User pastes JSON schema on the first page
2. Schema is validated and base64 encoded
3. User is redirected to form generator page with encoded schema as URL parameter
4. Schema is decoded and passed to JSONForms
5. JSONForms automatically generates a form based on the schema
6. Users can fill out the form and see real-time updates

## Customization

The app automatically generates a basic UI schema if none is provided in the JSON schema. You can customize the form appearance by:

- Adding `uischema` property to your JSON schema
- Modifying the `generateUISchema` function in `FormGeneratorPage.tsx`
- Customizing Material-UI theme and components

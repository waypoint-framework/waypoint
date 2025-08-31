import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Container, 
  Paper, 
  TextField, 
  Button, 
  Typography, 
  Box,
  Alert
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';

const SchemaInputPage = () => {
  const [jsonInput, setJsonInput] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      // Validate JSON
      const parsed = JSON.parse(jsonInput);
      
      // Check if it's a valid JSON schema (basic validation)
      if (typeof parsed !== 'object' || parsed === null) {
        throw new Error('Input must be a valid JSON object');
      }

      // Encode to base64
      const base64Schema = btoa(JSON.stringify(parsed));
      
      // Redirect to form generator page
      navigate(`/form-generator?schema=${encodeURIComponent(base64Schema)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid JSON input');
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          JSON Schema Form Generator
        </Typography>
        
        <Typography variant="body1" sx={{ mb: 3 }} align="center">
          Paste your JSON schema below to generate a dynamic form
        </Typography>

        <Alert severity="info" sx={{ mb: 3 }} icon={<InfoIcon />}>
          <Typography variant="body2">
            <strong>Note:</strong> Complex schemas with external references, dependencies, or advanced validation rules may be simplified for form generation. 
            The app will automatically clean and optimize your schema for the best form experience.
          </Typography>
        </Alert>

        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            multiline
            rows={15}
            variant="outlined"
            label="JSON Schema"
            placeholder="Paste your JSON schema here..."
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            error={!!error}
            helperText={error || "Enter a valid JSON schema object"}
            sx={{ mb: 3 }}
          />

          <Box display="flex" justifyContent="center">
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={!jsonInput.trim()}
            >
              Generate Form
            </Button>
          </Box>
        </form>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ mt: 4, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="h6" gutterBottom>
            Example JSON Schema:
          </Typography>
          <Typography variant="body2" component="pre" sx={{ 
            bgcolor: 'white', 
            p: 2, 
            borderRadius: 1, 
            overflow: 'auto',
            fontSize: '0.875rem'
          }}>
{`{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "title": "Name",
      "description": "Enter your full name"
    },
    "email": {
      "type": "string",
      "title": "Email",
      "format": "email"
    },
    "age": {
      "type": "number",
      "title": "Age",
      "minimum": 18
    }
  },
  "required": ["name", "email"]
}`}
          </Typography>
        </Box>

        <Box sx={{ mt: 4, p: 2, bgcolor: 'blue.50', borderRadius: 1, border: '1px solid', borderColor: 'blue.200' }}>
          <Typography variant="h6" gutterBottom color="primary">
            Schema Compatibility Tips:
          </Typography>
          <Typography variant="body2" component="div" sx={{ mb: 1 }}>
            ✅ <strong>Supported:</strong> Basic types (string, number, boolean, object, array), titles, descriptions, required fields, min/max values
          </Typography>
          <Typography variant="body2" component="div" sx={{ mb: 1 }}>
            ⚠️ <strong>Simplified:</strong> External references ($ref), dependencies, complex validation rules, conditional logic
          </Typography>
          <Typography variant="body2" component="div">
            💡 <strong>Best Practice:</strong> Include descriptive titles and descriptions for better form labels and help text
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
};

export default SchemaInputPage; 
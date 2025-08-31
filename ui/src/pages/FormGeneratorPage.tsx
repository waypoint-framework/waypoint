import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Container, 
  Paper, 
  Typography, 
  Box, 
  Button,
  Alert,
  CircularProgress
} from '@mui/material';
import { JsonForms } from '@jsonforms/react';
import { materialRenderers, materialCells } from '@jsonforms/material-renderers';
import { ErrorBoundary } from 'react-error-boundary';
import SchemaErrorFallback from '../components/SchemaErrorFallback';

const FormGeneratorPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [schema, setSchema] = useState<any>(null);
  const [uischema, setUischema] = useState<any>(null);
  const [data, setData] = useState<any>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const schemaParam = searchParams.get('schema');
    
    if (!schemaParam) {
      setError('No schema parameter provided');
      setLoading(false);
      return;
    }

    try {
      // Decode base64 schema
      const decodedSchema = atob(schemaParam);
      const parsedSchema = JSON.parse(decodedSchema);
      
      // Clean up the schema to remove problematic references
      const cleanedSchema = cleanSchema(parsedSchema);
      
      setSchema(cleanedSchema);
      
      // Generate a basic UI schema if none exists
      if (!cleanedSchema.uischema) {
        const generatedUISchema = generateUISchema(cleanedSchema);
        setUischema(generatedUISchema);
      } else {
        setUischema(cleanedSchema.uischema);
      }
      
      setLoading(false);
    } catch (err) {
      setError('Failed to decode or parse schema');
      setLoading(false);
    }
  }, [searchParams]);

  // Clean schema to remove problematic references and properties
  const cleanSchema = (schemaObj: any): any => {
    if (!schemaObj || typeof schemaObj !== 'object') {
      return schemaObj;
    }

    // Create a deep copy to avoid mutating the original
    const cleaned = JSON.parse(JSON.stringify(schemaObj));

    // Remove problematic properties that can cause validation issues
    const propertiesToRemove = [
      '$schema',
      '$id',
      '$ref',
      'definitions',
      'dependencies',
      'allOf',
      'anyOf',
      'oneOf',
      'not'
    ];

    // Recursively clean the schema
    const cleanObject = (obj: any): any => {
      if (Array.isArray(obj)) {
        return obj.map(cleanObject);
      }
      
      if (obj && typeof obj === 'object') {
        const cleaned: any = {};
        
        for (const [key, value] of Object.entries(obj)) {
          if (!propertiesToRemove.includes(key)) {
            cleaned[key] = cleanObject(value);
          }
        }
        
        return cleaned;
      }
      
      return obj;
    };

    return cleanObject(cleaned);
  };

  const generateUISchema = (schemaObj: any) => {
    if (schemaObj.type === 'object' && schemaObj.properties) {
      const elements: any[] = [];
      
      Object.keys(schemaObj.properties).forEach(key => {
        const prop = schemaObj.properties[key];
        const element: any = {
          type: 'Control',
          scope: `#/properties/${key}`
        };
        
        // Add title if available
        if (prop.title) {
          element.label = prop.title;
        }
        
        // Add description if available
        if (prop.description) {
          element.description = prop.description;
        }
        
        elements.push(element);
      });
      
      return {
        type: 'VerticalLayout',
        elements
      };
    }
    
    return undefined;
  };

  const handleDataChange = (newData: any) => {
    setData(newData);
  };

  const handleSubmit = () => {
    console.log('Form data:', data);
    alert('Form submitted! Check console for data.');
  };

  const handleBack = () => {
    navigate('/');
  };

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading form...
        </Typography>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button variant="contained" onClick={handleBack}>
          Go Back
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4" component="h1">
            Dynamic Form
          </Typography>
          <Button variant="outlined" onClick={handleBack}>
            Back to Schema Input
          </Button>
        </Box>

        {schema && (
          <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="h6" gutterBottom>
              Schema: {schema.title || 'Untitled Schema'}
            </Typography>
            {schema.description && (
              <Typography variant="body2" color="text.secondary">
                {schema.description}
              </Typography>
            )}
          </Box>
        )}

        <Box sx={{ mb: 3 }}>
          {schema && (
            <ErrorBoundary fallback={<SchemaErrorFallback onBack={handleBack} />}>
              <JsonForms
                schema={schema}
                uischema={uischema}
                data={data}
                renderers={materialRenderers}
                cells={materialCells}
                onChange={({ data }) => handleDataChange(data)}
                validationMode="ValidateAndShow"
                ajv={{ 
                  allErrors: true,
                  verbose: false,
                  strict: false
                }}
              />
            </ErrorBoundary>
          )}
        </Box>

        <Box display="flex" justifyContent="center" gap={2}>
          <Button 
            variant="contained" 
            size="large"
            onClick={handleSubmit}
            disabled={Object.keys(data).length === 0}
          >
            Submit Form
          </Button>
          <Button 
            variant="outlined" 
            size="large"
            onClick={() => setData({})}
          >
            Reset Form
          </Button>
        </Box>

        {Object.keys(data).length > 0 && (
          <Box sx={{ mt: 4, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="h6" gutterBottom>
              Current Form Data:
            </Typography>
            <Typography variant="body2" component="pre" sx={{ 
              bgcolor: 'white', 
              p: 2, 
              borderRadius: 1, 
              overflow: 'auto',
              fontSize: '0.875rem'
            }}>
              {JSON.stringify(data, null, 2)}
            </Typography>
          </Box>
        )}
      </Paper>
    </Container>
  );
};

export default FormGeneratorPage; 
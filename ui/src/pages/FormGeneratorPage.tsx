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
      
      console.log('Original schema:', parsedSchema);
      console.log('Cleaned schema:', cleanedSchema);
      
      // If the cleaned schema is still problematic, create a minimal working version
      let finalSchema = cleanedSchema;
      try {
        // Test if the schema can be processed by creating a simple test
        if (cleanedSchema.type === 'object' && cleanedSchema.properties) {
          // This should work
          finalSchema = cleanedSchema;
        } else {
          // Create a minimal working schema from the properties
          finalSchema = createMinimalSchema(parsedSchema);
        }
      } catch (err) {
        console.warn('Schema cleaning failed, using minimal schema:', err);
        finalSchema = createMinimalSchema(parsedSchema);
      }
      
      setSchema(finalSchema);
      
      // Generate a basic UI schema if none exists
      if (!finalSchema.uischema) {
        const generatedUISchema = generateUISchema(finalSchema);
        setUischema(generatedUISchema);
      } else {
        setUischema(finalSchema.uischema);
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
      '$defs',
      'definitions',
      'dependencies',
      'allOf',
      'anyOf',
      'oneOf',
      'not',
      'if',
      'then',
      'else',
      'patternProperties',
      'additionalProperties',
      'additionalItems',
      'unevaluatedProperties',
      'unevaluatedItems'
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
            // Special handling for properties to ensure they're clean
            if (key === 'properties' && typeof value === 'object') {
              cleaned[key] = cleanObject(value);
            } else if (key === 'items' && typeof value === 'object') {
              cleaned[key] = cleanObject(value);
            } else if (key === 'required' && Array.isArray(value)) {
              // Keep required arrays as they are
              cleaned[key] = value;
            } else if (key === 'type' || key === 'title' || key === 'description' || key === 'format') {
              // Keep basic schema properties
              cleaned[key] = value;
            } else if (key === 'minimum' || key === 'maximum' || key === 'minLength' || key === 'maxLength') {
              // Keep basic validation properties
              cleaned[key] = value;
            } else if (key === 'enum' || key === 'const') {
              // Keep enum and const values
              cleaned[key] = value;
            } else {
              // Clean other properties recursively
              cleaned[key] = cleanObject(value);
            }
          }
        }
        
        return cleaned;
      }
      
      return obj;
    };

    return cleanObject(cleaned);
  };

  // Create a minimal working schema from complex schemas
  const createMinimalSchema = (originalSchema: any): any => {
    const minimal: any = {
      type: 'object',
      title: originalSchema.title || 'Generated Form',
      description: originalSchema.description || 'Form generated from your schema'
    };

    if (originalSchema.properties && typeof originalSchema.properties === 'object') {
      minimal.properties = {};
      
      Object.keys(originalSchema.properties).forEach(key => {
        const prop = originalSchema.properties[key];
        if (prop && typeof prop === 'object') {
          minimal.properties[key] = {
            type: prop.type || 'string',
            title: prop.title || key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
            description: prop.description || ''
          };
          
          // Add basic validation if available
          if (prop.minimum !== undefined) minimal.properties[key].minimum = prop.minimum;
          if (prop.maximum !== undefined) minimal.properties[key].maximum = prop.maximum;
          if (prop.minLength !== undefined) minimal.properties[key].minLength = prop.minLength;
          if (prop.maxLength !== undefined) minimal.properties[key].maxLength = prop.maxLength;
          if (prop.enum) minimal.properties[key].enum = prop.enum;
          if (prop.format) minimal.properties[key].format = prop.format;
        }
      });
    }

    // Add required fields if specified
    if (originalSchema.required && Array.isArray(originalSchema.required)) {
      minimal.required = originalSchema.required.filter((field: string) => 
        minimal.properties && minimal.properties[field]
      );
    }

    return minimal;
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
      <Container maxWidth={false} sx={{ py: 4, px: { xs: 2, sm: 3, md: 4, lg: 6, xl: 8 }, textAlign: 'center' }}>
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading form...
        </Typography>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth={false} sx={{ py: 4, px: { xs: 2, sm: 3, md: 4, lg: 6, xl: 8 } }}>
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
    <Container maxWidth={false} sx={{ py: 4, px: { xs: 2, sm: 3, md: 4, lg: 6, xl: 8 } }}>
      <Paper elevation={3} sx={{ p: 4, maxWidth: '1600px', mx: 'auto' }}>
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
import { 
  Box, 
  Alert, 
  Button, 
  Typography,
  Paper
} from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

interface SchemaErrorFallbackProps {
  onBack: () => void;
}

const SchemaErrorFallback = ({ onBack }: SchemaErrorFallbackProps) => {
  return (
    <Paper elevation={2} sx={{ p: 3, bgcolor: 'error.50', border: '1px solid', borderColor: 'error.200' }}>
      <Box display="flex" alignItems="center" mb={2}>
        <ErrorOutlineIcon color="error" sx={{ mr: 1, fontSize: 28 }} />
        <Typography variant="h6" color="error">
          Schema Processing Error
        </Typography>
      </Box>
      
      <Alert severity="error" sx={{ mb: 2 }}>
        <Typography variant="body2">
          There was an error processing your JSON schema. This can happen with complex schemas that contain:
        </Typography>
        <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
          <li>External references ($ref)</li>
          <li>Complex validation rules</li>
          <li>Advanced conditional logic</li>
          <li>Unsupported schema features</li>
        </ul>
        <Typography variant="body2">
          Try simplifying your schema or removing complex validation rules.
        </Typography>
      </Alert>

      <Box display="flex" gap={2}>
        <Button variant="contained" onClick={onBack}>
          Go Back & Edit Schema
        </Button>
        <Button variant="outlined" onClick={() => window.location.reload()}>
          Try Again
        </Button>
      </Box>
    </Paper>
  );
};

export default SchemaErrorFallback; 
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import SchemaInputPage from './pages/SchemaInputPage';
import FormGeneratorPage from './pages/FormGeneratorPage';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<SchemaInputPage />} />
          <Route path="/form-generator" element={<FormGeneratorPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

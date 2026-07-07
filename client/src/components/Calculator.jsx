import { useState, useEffect } from 'react';
import axios from 'axios';
import { Upload, Calculator as CalcIcon, Clock, Zap, Banknote, Scissors, Package, Settings, RefreshCw } from 'lucide-react';
import { useAlert } from '../contexts/AlertContext';

function Calculator() {
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [parseResult, setParseResult] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const [spools, setSpools] = useState([]);
  const [settings, setSettings] = useState({});
  const [selectedSpools, setSelectedSpools] = useState({});
  
  const [laborMinutes, setLaborMinutes] = useState(15);
  const { showAlert } = useAlert();

  useEffect(() => {
    // Fetch spools and settings on load
    const fetchData = async () => {
      try {
        const [spoolsRes, settingsRes] = await Promise.all([
          axios.get('/api/spools'),
          axios.get('/api/settings')
        ]);
        setSpools(spoolsRes.data.filter(s => s.archived !== 1));
        setSettings(settingsRes.data);
        
        // Setup defaults
        if (settingsRes.data.calc_avg_wattage) {
          // If they haven't manually touched labor minutes, we could theoretically set a default, but 15 is fine.
        }
      } catch (err) {
        console.error('Failed to load initial data:', err);
      }
    };
    fetchData();
  }, []);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    
    setParsing(true);
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await axios.post('/api/calculator/parse', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setParseResult(res.data);
      setSelectedSpools({}); // reset selection
      showAlert('Success', 'File parsed successfully!');
    } catch (err) {
      showAlert('Error', 'Failed to parse file: ' + (err.response?.data?.error || err.message), true);
    }
    setParsing(false);
  };

  const handleSpoolChange = (index, spoolId) => {
    setSelectedSpools(prev => ({
      ...prev,
      [index]: spoolId
    }));
  };

  // Calculations
  const printHours = parseResult ? parseResult.printTimeSeconds / 3600 : 0;
  
  // 1. Material Cost
  let materialCost = 0;
  if (parseResult && parseResult.weights) {
    parseResult.weights.forEach((weight, i) => {
      const spoolId = selectedSpools[i];
      if (spoolId) {
        const spool = spools.find(s => s.id === parseInt(spoolId, 10));
        if (spool && spool.cost && spool.total_weight) {
          const costPerGram = spool.cost / spool.total_weight;
          materialCost += costPerGram * weight;
        }
      }
    });
  }

  // 2. Machine Cost (Wear & Tear)
  const wearRate = parseFloat(settings.calc_wear_rate) || 0;
  const machineCost = printHours * wearRate;

  // 3. Energy Cost
  const avgWattage = parseFloat(settings.calc_avg_wattage) || 150;
  const kwhUsed = (avgWattage * printHours) / 1000;
  const energyRate = parseFloat(settings.calc_energy_rate) || 0;
  const energyCost = kwhUsed * energyRate;

  // 4. Labor Cost
  const laborRate = parseFloat(settings.calc_labor_rate) || 0;
  const laborCost = (laborMinutes / 60) * laborRate;

  // Totals
  const totalCost = materialCost + machineCost + energyCost + laborCost;
  const markupPercentage = parseFloat(settings.calc_markup) || 0;
  const salePrice = totalCost * (1 + (markupPercentage / 100));

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: settings.currency || 'GBP' }).format(val);
  };

  return (
    <div style={{ paddingBottom: '40px' }}>
      <div className="card title-card" style={{ marginBottom: '20px', borderLeft: '4px solid var(--primary-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: '0 0 5px 0', color: 'var(--primary-color)' }}>Quote Calculator</h2>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Print Pricing</div>
            <div style={{ fontSize: '0.85rem', color: '#888' }}>Upload a .3mf file to instantly calculate the cost and sale price.</div>
          </div>
          <CalcIcon size={40} style={{ color: 'var(--primary-color)', opacity: 0.8 }} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px' }}>
        
        {/* Step 1: Upload */}
        <div className="card no-hover" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Upload size={18} /> 1. Upload File
          </h3>
          <p style={{ margin: 0, color: '#888', fontSize: '0.9rem' }}>
            Upload a <strong>.gcode.3mf</strong> file (Bambu Studio &rarr; File &rarr; Export &rarr; Export Plate Sliced File)
          </p>
          
          <div 
            onDragOver={handleDragOver}
            onDragEnter={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{ 
            border: `2px dashed ${isDragging ? 'var(--primary-color)' : 'var(--border-color)'}`, 
            borderRadius: '8px', 
            padding: '20px', 
            textAlign: 'center',
            backgroundColor: isDragging ? 'rgba(0, 255, 0, 0.05)' : 'var(--secondary-bg)'
          }}>
            <input 
              type="file" 
              accept=".3mf" 
              onChange={handleFileChange} 
              style={{ display: 'none' }} 
              id="file-upload" 
            />
            <label htmlFor="file-upload" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <Upload size={32} style={{ color: file ? 'var(--primary-color)' : '#888' }} />
              <span style={{ color: file ? 'var(--text-color)' : '#888', fontWeight: file ? 'bold' : 'normal' }}>
                {file ? file.name : 'Click to select .3mf file'}
              </span>
            </label>
          </div>
          
          <button 
            onClick={handleUpload} 
            disabled={!file || parsing}
            style={{ 
              backgroundColor: file ? 'var(--primary-color)' : 'var(--border-color)',
              color: file ? '#fff' : '#888',
              padding: '12px',
              fontSize: '1rem',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {parsing ? <RefreshCw size={18} className="spin" /> : <CalcIcon size={18} />}
            {parsing ? 'Parsing...' : 'Analyze File'}
          </button>
        </div>

        {/* Step 2: Breakdown */}
        {parseResult && (
          <div className="card no-hover" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Package size={18} /> 2. Print Requirements
            </h3>
            
            <div style={{ display: 'flex', gap: '20px' }}>
              <div style={{ width: '120px', height: '120px', borderRadius: '8px', overflow: 'hidden', backgroundColor: 'var(--secondary-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {parseResult.thumbnailPath ? (
                  <img src={`${parseResult.thumbnailPath}?token=${localStorage.getItem('token')}`} alt="Thumbnail" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ color: '#888', fontSize: '0.8rem' }}>No Image</span>
                )}
              </div>
              
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', justifyContent: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}>
                  <Clock size={18} style={{ color: 'var(--primary-color)' }} />
                  <strong>Print Time:</strong> {(parseResult.printTimeSeconds / 3600).toFixed(1)} hours
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}>
                  <Scissors size={18} style={{ color: 'var(--warning-color)' }} />
                  <strong>Filament Slots:</strong> {parseResult.weights?.length || 0}
                </div>
              </div>
            </div>

            {parseResult.printTimeSeconds === 0 && (
              <div style={{ backgroundColor: 'var(--warning-color)', color: '#000', padding: '12px', borderRadius: '8px', fontWeight: 'bold' }}>
                ⚠️ No print statistics found! Please open this file in Bambu Studio, click "Slice plate", save the project, and upload it again.
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <h4 style={{ margin: 0 }}>Assign Inventory Spools</h4>
              {parseResult.weights?.map((weight, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '10px', backgroundColor: 'var(--secondary-bg)', borderRadius: '8px' }}>
                  <div style={{ minWidth: '80px', fontWeight: 'bold' }}>Slot {i + 1}:</div>
                  <div style={{ minWidth: '70px', color: 'var(--primary-color)' }}>{weight.toFixed(1)}g</div>
                  <select 
                    value={selectedSpools[i] || ''} 
                    onChange={(e) => handleSpoolChange(i, e.target.value)}
                    style={{ flex: 1 }}
                  >
                    <option value="">-- Select Spool --</option>
                    {spools.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.brand_name} {s.material_name} {s.color_name || s.color} ({formatCurrency(s.cost || 0)})
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Variables & Quote */}
        {parseResult && (
          <div className="card no-hover" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
             <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings size={18} /> 3. Adjust Variables
            </h3>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label>Prep & Post-processing (Mins)</label>
              <input 
                type="number" 
                value={laborMinutes} 
                onChange={(e) => setLaborMinutes(parseInt(e.target.value) || 0)}
                style={{ width: '80px', textAlign: 'right' }}
              />
            </div>

            <hr style={{ borderColor: 'var(--border-color)', margin: '10px 0' }} />

            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Banknote size={18} /> Quote Breakdown
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.95rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Material Cost:</span>
                <span>{formatCurrency(materialCost)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Labor Cost:</span>
                <span>{formatCurrency(laborCost)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Machine Wear:</span>
                <span>{formatCurrency(machineCost)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Zap size={12}/> Electricity Cost:</span>
                <span>{formatCurrency(energyCost)}</span>
              </div>
            </div>

            <div style={{ 
              backgroundColor: 'var(--secondary-bg)', 
              padding: '15px', 
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '1.1rem' }}>
                <span>Total Cost to Produce:</span>
                <span style={{ color: 'var(--warning-color)' }}>{formatCurrency(totalCost)}</span>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'bold', fontSize: '1.4rem', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                <span>Selling Price:</span>
                <span style={{ color: 'var(--primary-color)' }}>{formatCurrency(salePrice)}</span>
              </div>
              <div style={{ textAlign: 'right', fontSize: '0.8rem', color: '#888' }}>
                Based on {markupPercentage}% markup
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default Calculator;

import { useState } from 'react';
import axios from 'axios';
import { AlertTriangle } from 'lucide-react';
import PageHeader from '../../ui/shell/PageHeader';
import Card from '../../ui/Card';
import Field from '../../ui/Field';
import Skeleton from '../../ui/Skeleton';
import LoadError from '../../ui/LoadError';
import useResource from '../../hooks/useResource';
import { useAlert } from '../../contexts/AlertContext';
import { formatMoney } from '../../lib/format.js';
import { mediaUrl } from '../../lib/media.js';
import { lowStockThreshold } from '../../lib/spools.js';
import { quoteTotals, buildSpoolData } from '../../lib/quote.js';
import FileDrop from './FileDrop';
import SpoolAssign from './SpoolAssign';
import QuoteSummary from './QuoteSummary';
import SaveQuoteDialog from './SaveQuoteDialog';
import './calculator.css';

async function load() {
  const [spools, settings] = await Promise.all([axios.get('/api/spools'), axios.get('/api/settings')]);
  let dynamicRate = null;
  if (settings.data?.energy_rate_source === 'ha') {
    try {
      const rate = await axios.get('/api/ha/rate');
      if (rate.data?.rate) dynamicRate = rate.data.rate;
    } catch {
      // keep the manual rate
    }
  }
  return { spools: (spools.data || []).filter((s) => s.archived !== 1), settings: settings.data || {}, dynamicRate };
}

const readToken = () => { try { return localStorage.getItem('token'); } catch { return null; } };

export default function CalculatorScreen() {
  const { showAlert } = useAlert();
  const { data, status, reload } = useResource(load);
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [selected, setSelected] = useState({});
  const [quantity, setQuantity] = useState(1);
  const [labourMinutes, setLabourMinutes] = useState(15);
  const [saveOpen, setSaveOpen] = useState(false);

  const spools = data?.spools || [];
  const settings = data?.settings || {};
  const money = (v) => formatMoney(v, settings.currency);

  const analyse = async () => {
    if (!file) return;
    setParsing(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await axios.post('/api/calculator/parse', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setParsed(res.data);
      setSelected({});
      showAlert('Success', 'File parsed successfully!');
    } catch (err) {
      showAlert('Error', `Failed to parse file: ${err.response?.data?.error || err.message}`, true);
    }
    setParsing(false);
  };

  const weights = parsed?.weights || [];
  const q = quoteTotals({
    weights, selected, spools, printTimeSeconds: parsed?.printTimeSeconds || 0, quantity, labourMinutes, settings, dynamicRate: data?.dynamicRate ?? null,
  });

  const saveQuote = async (form) => {
    try {
      await axios.post('/api/jobs', {
        ...form,
        filament_cost: q.materialCost,
        electricity_cost: q.energyCost,
        wear_cost: q.machineCost,
        labor_cost: q.labourCost,
        total_cost: q.totalCost,
        markup_amount: q.markupAmount,
        final_price: q.finalPrice,
        print_time_hours: q.printHours,
        spool_data: buildSpoolData(weights, selected, spools, quantity),
      });
      showAlert('Success', 'Quote saved successfully!');
      setSaveOpen(false);
      return true;
    } catch {
      showAlert('Error', 'Failed to save quote', true);
      return false;
    }
  };

  const thumb = mediaUrl(parsed?.thumbnailPath, readToken());

  return (
    <>
      <PageHeader title="Calculator" />
      {status === 'loading' && <Skeleton height={180} count={2} />}
      {status === 'error' && <LoadError message="Could not load spools and settings." onRetry={reload} />}
      {status === 'ready' && (
        <div className="ca-layout">
          <div className="ca-steps">
            <Card className="ca-step">
              <h2><span className="ca-num">1</span>Upload file</h2>
              <p className="ui-muted">Upload a .gcode.3mf file (Bambu Studio, File, Export, Export plate sliced file).</p>
              <FileDrop file={file} onFile={setFile} onAnalyse={analyse} parsing={parsing} />
            </Card>

            {parsed && (
              <Card className="ca-step" aria-label="Print requirements">
                <h2><span className="ca-num">2</span>Assign spools</h2>
                <div className="ca-print">
                  <div className="ca-thumb">{thumb ? <img src={thumb} alt="Plate thumbnail" /> : <span className="ui-muted">No image</span>}</div>
                  <dl>
                    <div><dt>Print time</dt><dd>{((parsed.printTimeSeconds || 0) / 3600).toFixed(1)} hours</dd></div>
                    <div><dt>Filament slots</dt><dd>{weights.length}</dd></div>
                  </dl>
                </div>
                {parsed.printTimeSeconds === 0 && (
                  <div className="ca-warn" role="status">
                    <AlertTriangle size={18} aria-hidden="true" />
                    <span>No print statistics found. Open this file in Bambu Studio, click Slice plate, save the project and upload it again.</span>
                  </div>
                )}
                <SpoolAssign
                  weights={weights}
                  selected={selected}
                  spools={spools}
                  threshold={lowStockThreshold(settings)}
                  money={money}
                  onChange={(slot, id) => setSelected((s) => ({ ...s, [slot]: id }))}
                />
              </Card>
            )}

            {parsed && (
              <Card className="ca-step">
                <h2><span className="ca-num">3</span>Adjust</h2>
                <div className="ca-inputs">
                  <Field label="Quantity">
                    <input type="number" min="1" inputMode="numeric" value={quantity} onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))} />
                  </Field>
                  <Field label="Labour (minutes per item)">
                    <input type="number" min="0" inputMode="numeric" value={labourMinutes} onChange={(e) => setLabourMinutes(parseInt(e.target.value, 10) || 0)} />
                  </Field>
                </div>
              </Card>
            )}
          </div>
          {parsed && (
            <QuoteSummary q={q} money={money} markup={parseFloat(settings.calc_markup) || 0} onSave={() => setSaveOpen(true)} />
          )}
        </div>
      )}
      <SaveQuoteDialog open={saveOpen} onClose={() => setSaveOpen(false)} onSave={saveQuote} />
    </>
  );
}

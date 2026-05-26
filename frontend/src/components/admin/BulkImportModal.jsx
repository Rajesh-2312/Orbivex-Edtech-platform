import { useState, useRef } from 'react';
import { HiOutlineArrowUpTray, HiOutlineDocumentText } from 'react-icons/hi2';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import Badge from '../ui/Badge';

export default function BulkImportModal({ isOpen, onClose, onImport, title, requiredFields, sampleRow }) {
  const [csvData, setCsvData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [fileName, setFileName] = useState('');
  const [errors, setErrors] = useState([]);
  const fileRef = useRef(null);

  const parseCSV = (text) => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) { setErrors(['CSV must have a header row and at least one data row']); return; }

    const hdrs = lines[0].split(',').map((h) => h.trim());
    setHeaders(hdrs);

    const missing = (requiredFields || []).filter((f) => !hdrs.includes(f));
    if (missing.length > 0) {
      setErrors([`Missing required columns: ${missing.join(', ')}`]);
      return;
    }

    const rows = [];
    const errs = [];
    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(',').map((v) => v.trim());
      if (vals.length !== hdrs.length) {
        errs.push(`Row ${i}: expected ${hdrs.length} columns, got ${vals.length}`);
        continue;
      }
      const row = {};
      hdrs.forEach((h, idx) => { row[h] = vals[idx]; });
      rows.push(row);
    }

    setCsvData(rows);
    setErrors(errs);
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => parseCSV(ev.target.result);
    reader.readAsText(file);
  };

  const handleImport = () => {
    if (csvData.length === 0) return;
    onImport(csvData, fileName);
  };

  const reset = () => {
    setCsvData([]);
    setHeaders([]);
    setFileName('');
    setErrors([]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title || 'Bulk Import'}>
      <div className="admin-form">
        <div
          style={{ border: '2px dashed var(--border-color)', borderRadius: '12px', padding: '32px', textAlign: 'center', cursor: 'pointer' }}
          onClick={() => fileRef.current?.click()}
        >
          <HiOutlineArrowUpTray size={32} style={{ color: 'var(--primary-500)', marginBottom: '8px' }} />
          <p style={{ margin: 0 }}>{fileName || 'Click to upload CSV file'}</p>
          <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFile} />
        </div>

        {sampleRow && (
          <div style={{ marginTop: '12px', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', fontSize: '0.8rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <HiOutlineDocumentText size={14} />
              <strong>Expected format:</strong>
            </div>
            <code className="text-muted">{sampleRow}</code>
          </div>
        )}

        {errors.length > 0 && (
          <div style={{ marginTop: '12px' }}>
            {errors.map((e, i) => (
              <div key={i} style={{ color: 'var(--danger-500)', fontSize: '0.85rem', marginBottom: '4px' }}>{e}</div>
            ))}
          </div>
        )}

        {csvData.length > 0 && (
          <div style={{ marginTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <Badge variant="success">{csvData.length} records ready</Badge>
              <Button variant="ghost" size="sm" onClick={reset}>Clear</Button>
            </div>

            <div style={{ maxHeight: '200px', overflow: 'auto', borderRadius: '8px' }}>
              <table className="admin-table" style={{ fontSize: '0.8rem' }}>
                <thead>
                  <tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {csvData.slice(0, 5).map((row, i) => (
                    <tr key={i}>{headers.map((h) => <td key={h}>{row[h]}</td>)}</tr>
                  ))}
                  {csvData.length > 5 && (
                    <tr><td colSpan={headers.length} className="text-muted" style={{ textAlign: 'center' }}>...and {csvData.length - 5} more</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <Button
          variant="primary"
          size="lg"
          style={{ width: '100%', marginTop: '20px' }}
          onClick={handleImport}
          disabled={csvData.length === 0}
        >
          Import {csvData.length} Records
        </Button>
      </div>
    </Modal>
  );
}
